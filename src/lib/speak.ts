export type SpeakResult = "server" | "browser" | "unavailable";

// 10 ms of silence. iOS Safari lets an element play later only if it was played inside a gesture.
const SILENCE =
  "data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
// Periods that do not end a sentence: titles, and letter runs like U.S., e.g. and p.m.
const TITLE = /\b(?:Dr|Mr|Mrs|Ms|Mx|Prof|Sr|Jr|St|vs)\.$/i;
const LETTERS = /(?:\b[a-z]\.){2,}$/i;
// Shared by both analysers, which keep the default fftSize of 2048.
const samples = new Float32Array(2048);

let context: AudioContext | null = null;
let audio: HTMLAudioElement | null = null;
let analyser: AnalyserNode | null = null;
let run: AbortController | null = null; // one per speakText call; aborting it cancels queued sentences
let done: (() => void) | null = null;
let utterances: SpeechSynthesisUtterance[] = []; // held so Chrome does not collect them before they end

// One request per sentence starts audio sooner; fragments under 20 characters join a neighbour.
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  const add = (piece: string) => {
    if (!piece) return;
    if (sentences.length && sentences[sentences.length - 1].length < 20) sentences[sentences.length - 1] += ` ${piece}`;
    else sentences.push(piece);
  };
  let start = 0;
  for (const match of text.matchAll(/[.!?]+["')\]]*\s+|\n+/g)) {
    const end = match.index + match[0].length;
    const piece = text.slice(start, end).trim();
    if (TITLE.test(piece) || LETTERS.test(piece)) continue;
    add(piece);
    start = end;
  }
  add(text.slice(start).trim());
  if (sentences.length > 1 && sentences[sentences.length - 1].length < 20) {
    const tail = sentences.pop();
    sentences[sentences.length - 1] += ` ${tail}`;
  }
  return sentences;
}

export function audioContext() {
  context ??= new AudioContext();
  return context;
}

// RMS of the analyser's latest window, scaled so ordinary speech reads about 0.3 to 0.8.
export function levelOf(node: AnalyserNode) {
  node.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.min(1, Math.sqrt(sum / samples.length) * 5);
}

export function playbackLevel() {
  return analyser ? levelOf(analyser) : 0;
}

function player() {
  if (!audio) {
    const ctx = audioContext();
    audio = new Audio();
    analyser = ctx.createAnalyser();
    ctx.createMediaElementSource(audio).connect(analyser).connect(ctx.destination);
  }
  return audio;
}

// Call inside a click or key handler, before any await.
export function unlockAudio() {
  audioContext().resume().catch(() => {});
  const element = player();
  element.src = SILENCE;
  element.play().catch(() => {});
}

function finish() {
  const callback = done;
  done = null;
  callback?.();
}

export function stopSpeaking() {
  run?.abort();
  run = null;
  audio?.pause();
  window.speechSynthesis?.cancel();
  finish();
}

async function fetchSpeech(text: string, signal: AbortSignal) {
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    return response.ok ? await response.blob() : null;
  } catch {
    return null; // offline, or stopped
  }
}

// Resolves true when the sentence ends, false when it fails or is stopped.
function play(blob: Blob, signal: AbortSignal, onStart: () => void) {
  const element = player();
  const url = URL.createObjectURL(blob);
  element.src = url;
  return new Promise<boolean>((resolve) => {
    const end = (ok: boolean) => {
      element.onended = element.onerror = null;
      signal.removeEventListener("abort", stopped);
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    const stopped = () => end(false);
    signal.addEventListener("abort", stopped);
    element.onended = () => end(true);
    element.onerror = () => end(false);
    element.play().then(onStart, () => end(false));
  });
}

// shortcut: the browser voice has no level to read, so levelRef stays 0 while it talks; fake a pulse if the still orb confuses testers
function browserSay(sentences: string[], signal: AbortSignal, begin: (voice: SpeakResult) => void) {
  return new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window)) {
      begin("unavailable");
      return resolve();
    }
    signal.addEventListener("abort", () => resolve());
    // One utterance per sentence: Chrome's network voices go silent on long ones and never fire end.
    utterances = sentences.map((sentence) => new SpeechSynthesisUtterance(sentence));
    const last = utterances[utterances.length - 1];
    last.onend = last.onerror = () => resolve();
    begin("browser");
    for (const utterance of utterances) window.speechSynthesis.speak(utterance);
  });
}

async function sayAll(sentences: string[], signal: AbortSignal, begin: (voice: SpeakResult) => void) {
  const requests: Promise<Blob | null>[] = [];
  for (let i = 0; i < sentences.length; i++) {
    // Up to 3 sentences in flight, so the next one is ready when this one ends.
    while (requests.length < Math.min(i + 3, sentences.length)) {
      requests.push(fetchSpeech(sentences[requests.length], signal));
    }
    const blob = await requests[i];
    if (signal.aborted) return;
    if (blob && (await play(blob, signal, () => begin("server")))) continue;
    if (signal.aborted) return;
    return browserSay(sentences.slice(i), signal, begin);
  }
}

// Resolves with the voice used once speech starts. onState(false) fires at the end or on stopSpeaking(),
// but not when a newer speakText call replaces this one.
export function speakText(
  text: string,
  onState?: (speaking: boolean, source: SpeakResult | null) => void,
): Promise<SpeakResult> {
  done = null; // the old cards key their labels on this, so a replaced speaker ends quietly, as before
  stopSpeaking();
  unlockAudio();
  const current = new AbortController();
  run = current;
  let source: SpeakResult | null = null;
  done = () => onState?.(false, source);
  onState?.(true, null);
  return new Promise((started) => {
    const begin = (voice: SpeakResult) => {
      source = voice;
      started(voice);
    };
    void sayAll(splitSentences(text), current.signal, begin).finally(() => {
      if (!current.signal.aborted) finish();
    });
  });
}
