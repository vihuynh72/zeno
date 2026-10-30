import { audioContext, levelOf } from "./speak";

type ListenError = "blocked" | "unsupported" | "network" | "no-speech";

// The adapter contract. The Meta realtime adapter has the same shape, so either can drive useVoice.
export type ListenHandlers = {
  onSpeechStart?: () => void;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (reason: ListenError) => void;
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  abort(): void;
  onspeechstart: (() => void) | null;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

// Chrome and Safari error codes; anything unlisted is treated as a connection problem.
const ERRORS: Record<string, ListenError> = {
  "not-allowed": "blocked",
  "service-not-allowed": "unsupported",
  "audio-capture": "unsupported",
  "language-not-supported": "unsupported",
  "no-speech": "no-speech",
  network: "network",
};

// Web Speech has no dependable keyword biasing, so opts.keywords is for the Meta adapter only.
export async function listenWeb(
  handlers: ListenHandlers,
  opts?: { keywords?: string[]; levelRef?: { current: number } },
): Promise<{ stop: () => void; pause: () => void; resume: () => void }> {
  const speech = window as unknown as Record<"SpeechRecognition" | "webkitSpeechRecognition", (new () => Recognition) | undefined>;
  const Speech = speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
  if (!Speech) {
    handlers.onError?.("unsupported");
    return { stop() {}, pause() {}, resume() {} };
  }
  const levelRef = opts?.levelRef;
  let turn = 0; // bumped on every stop, so events from an aborted recognition are ignored
  let release = () => {};

  const end = () => {
    turn++;
    release();
    release = () => {};
  };

  // Recognition starts before any await, so the gesture that called this still counts.
  const begin = () => {
    end();
    const mine = turn;
    const recognition = new Speech();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    let text = "";
    let failed = false;
    recognition.onspeechstart = () => handlers.onSpeechStart?.();
    recognition.onresult = (event) => {
      text = Array.from(event.results, (result) => result[0].transcript).join("");
      handlers.onPartial?.(text);
    };
    recognition.onerror = (event) => {
      if (mine !== turn || event.error === "aborted") return;
      failed = true;
      handlers.onError?.(ERRORS[event.error] ?? "network");
    };
    recognition.onend = () => {
      if (mine !== turn) return;
      end();
      if (!failed) handlers.onFinal(text.trim());
    };
    recognition.start();

    let stream: MediaStream | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let frame = 0;
    release = () => {
      recognition.abort();
      cancelAnimationFrame(frame);
      source?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      if (levelRef) levelRef.current = 0;
    };
    if (!levelRef || !navigator.mediaDevices) return;
    // A second mic stream only for the level meter; if it fails the meter stays at 0 and recognition goes on.
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((opened) => {
        if (mine !== turn) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        const ctx = audioContext();
        const analyser = ctx.createAnalyser();
        source = ctx.createMediaStreamSource(opened);
        source.connect(analyser);
        const tick = () => {
          levelRef.current += (levelOf(analyser) - levelRef.current) * 0.3;
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {});
  };

  begin();
  // Web Speech keeps nothing open between turns, so pause releases the mic just like stop.
  return { stop: end, pause: end, resume: begin };
}
