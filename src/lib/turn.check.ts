// Self-check for turn-taking: answerSoon, useVoice's wait for more words, and Web Speech listening on after a pause.
// Run: node src/lib/turn.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { answerSoon } from "./turn.ts";
import type { ListenHandlers } from "./listen.ts";

// ---- answerSoon. Meta's finals are punctuated ("Put the lab report on my calendar."); Chrome's are not, so there only a
// short reply goes soon.
const soon = [
  "What should I do next?",
  "Can you break it into smaller steps?",
  "Should I start with the outline or the intro?",
  "What's on my calendar?",
  "Yes.",
  "No thanks.",
  "Uh-huh.",
  "Mm-hmm.",
  "Let's do it.",
  "yes",
  "Yeah",
  "no",
  "done",
  "Done!",
  "next",
  "stop",
  "start",
  "skip",
  "skip it",
  "okay",
  "OK",
  "thank you",
  "got it",
  "not now",
  "I’m done",
  "all done",
  "next one",
  "  yes  ",
];
const later = [
  // A whole sentence: Vi pauses after one "to think about what to talk next".
  "Put the lab report on my calendar.",
  "I have an essay due Friday.",
  "I finished the outline!",
  "I want to work on the um the essay for history.",
  "Email Prof Patel about the group project.",
  "Book it for 3 p.m.",
  "Okay, let's do it.",
  "Let me think about the outline first.",
  "I can't wait for this weekend",
  "put the lab report on my calendar",
  "what should i do next",
  "i have a quiz at 3:30",
  // Trailing off.
  "",
  "   ",
  "...",
  "I want to work on the",
  "I want to work on the um",
  "Put it on my calendar and",
  "The essay is due Friday, but",
  "I need to email her because",
  "Should I start with the outline or",
  "And then",
  "I need to talk to",
  "a lot of",
  "Write the intro for",
  "it was like",
  "Start with the.",
  "Should I start with?",
  "Should I start with the outline or?",
  "I need to finish my essay,",
  "Okay,",
  "Yes,",
  "So I was thinking —",
  "So I was thinking -",
  "I was thinking...",
  "I was thinking…",
  "Here's my list:",
  "Um.",
  "Uh",
  "er",
  "Hmm.",
  "It's due Friday, I mean.",
  "it's hard you know",
  "Let me think.",
  "Okay, let me see.",
  "Hold on.",
  "hang on",
  "Wait.",
  "one sec",
  "the essay",
  "my lab report",
  "history essay first",
  "Put it on my",
];
for (const text of soon) assert.equal(answerSoon(text), true, `soon: ${JSON.stringify(text)}`);
for (const text of later) assert.equal(answerSoon(text), false, `later: ${JSON.stringify(text)}`);

// ---- useVoice. React, Zeno's voice and the clock are stand-ins; the hook and the adapter contract are real.
const stub = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    // useState calls in the hook's order: phase, partial, muted, error, the voice object.
    if (specifier === "react") {
      return stub(`const states = (globalThis.voiceStates = []);
        export function useState(init) {
          const i = states.length;
          states.push(typeof init === "function" ? init() : init);
          return [states[i], (value) => (states[i] = value)];
        }
        export const useRef = (current) => ({ current });
        export const useEffect = () => {};
        export const useSyncExternalStore = (subscribe, get) => get();`);
    }
    if (specifier === "./speak") {
      return stub(`export const playbackLevel = () => 0, unlockAudio = () => {}, stopSpeaking = () => {};
        export const audioContext = () => ({}), levelOf = () => 0;
        export async function speakText(text, onState) {
          globalThis.spoken.push(text);
          queueMicrotask(() => onState?.(false));
          return "server";
        }`);
    }
    return nextResolve(/^\.\/[\w-]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const spoken: string[] = [];
Object.assign(globalThis, { spoken });
Object.defineProperty(navigator, "mediaDevices", { value: {} }); // hands-free needs a mic to hand back

// A clock that moves only when told, so the 700 ms and 2,200 ms waits are exact.
let now = 0;
let lastId = 0;
const timers = new Map<number, { at: number; run: () => void }>();
Object.assign(globalThis, {
  setTimeout: (run: () => void, ms = 0) => (timers.set(++lastId, { at: now + ms, run }), lastId),
  clearTimeout: (id?: number) => timers.delete(id ?? 0),
});
async function after(ms: number) {
  const end = now + ms;
  for (;;) {
    await new Promise((resolve) => setImmediate(resolve));
    const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > end) break;
    timers.delete(next[0]);
    now = next[1].at;
    next[1].run();
  }
  now = end;
}

const { useVoice } = await import("./use-voice.ts");
const states = (globalThis as unknown as { voiceStates: unknown[] }).voiceStates;
const phase = () => states[0];
const partial = () => states[1];
const turns: string[] = [];
const calls: string[] = [];
let silences = 0;
let reply = "Got it.";
let h: ListenHandlers = { onFinal() {} };
// eslint-disable-next-line react-hooks/rules-of-hooks -- React is the stub above, so the hook runs once as a plain call
const voice = useVoice(
  {
    onUserTurn: async (text) => (turns.push(text), reply),
    listenAfter: (said) => said.endsWith("?"),
    onSilence: () => silences++,
  },
  {
    listen: async (handlers) => {
      h = handlers;
      calls.push("open");
      return { stop: () => calls.push("stop"), pause: () => calls.push("pause"), resume: () => calls.push("resume") };
    },
  },
);
async function talk() {
  voice.start();
  await after(0);
}

// A question goes 700 ms after its final, whole; the session pauses for Zeno's turn.
await talk();
h.onSpeechStart?.();
h.onPartial?.("What should I");
assert.equal(partial(), "What should I");
h.onSpeechEnd?.();
h.onFinal("What should I do next?");
assert.equal(partial(), "What should I do next?");
await after(699);
assert.deepEqual(turns, []);
await after(1);
assert.deepEqual(turns, ["What should I do next?"]);
assert.deepEqual(calls, ["open", "pause", "stop"]);
assert.deepEqual(spoken, ["Got it."]);
assert.equal(phase(), "idle");

// Words that trail off get 2,200 ms.
await talk();
h.onFinal("I want to work on the");
await after(2_199);
assert.equal(turns.length, 1);
await after(1);
assert.equal(turns.at(-1), "I want to work on the");

// So does a whole sentence (Vi: "I pause two seconds, just think about what to talk next"): two seconds of thought,
// then the next sentence joins the turn.
await talk();
h.onFinal("I have an essay due Friday.");
await after(2_000);
h.onSpeechStart?.();
h.onFinal("And a lab report.");
await after(2_199);
assert.equal(turns.length, 2);
await after(1);
assert.equal(turns.at(-1), "I have an essay due Friday. And a lab report.");

// A pause to think: new speech holds the turn, the next final joins it and waits again; the card shows it all.
await talk();
h.onFinal("I need to finish my essay,");
await after(1_500);
h.onSpeechStart?.();
await after(10_000); // Meta can hold a segment open through a long pause; its final decides
assert.equal(turns.length, 3);
h.onPartial?.("and email");
assert.equal(partial(), "I need to finish my essay, and email");
h.onFinal("And email my professor?");
await after(700);
assert.equal(turns.at(-1), "I need to finish my essay, And email my professor?");

// Speech with no words gets no final from Meta; its end starts the wait again.
await talk();
h.onFinal("Put it on my calendar.");
h.onSpeechStart?.();
await after(5_000);
assert.equal(turns.length, 4);
h.onSpeechEnd?.();
await after(2_200);
assert.equal(turns.at(-1), "Put it on my calendar.");

// Done talking: Talk sends what was heard at once, live words too; with nothing heard the caller stops instead.
await talk();
assert.equal(voice.finish(), false);
h.onFinal("Um,");
h.onPartial?.("the history essay");
assert.equal(voice.finish(), true);
await after(0);
assert.equal(turns.at(-1), "Um, the history essay");
assert.equal(voice.finish(), false);

// Stop drops the words, and the next turn starts empty.
await talk();
h.onFinal("Cancel that and");
voice.stop();
await after(5_000);
assert.equal(turns.length, 6);
await talk();
h.onFinal("Yes.");
await after(700);
assert.equal(turns.at(-1), "Yes.");

// Hands-free: after Zeno asks, the mic reopens on the same session and the same rules apply.
reply = "Want to start the outline?";
await talk();
h.onFinal("What's next?");
await after(700);
assert.equal(turns.at(-1), "What's next?");
assert.equal(calls.at(-1), "resume");
assert.equal(phase(), "listening");
reply = "Got it.";
h.onFinal("Okay,");
await after(2_199);
assert.equal(turns.length, 8);
h.onSpeechStart?.();
h.onFinal("let's do it.");
await after(2_200);
assert.equal(turns.at(-1), "Okay, let's do it.");

// The listen limit: nothing said in 30 s is silence; words still being said by then go as they are.
await talk();
await after(30_000);
assert.equal(silences, 1);
assert.equal(phase(), "idle");
await talk();
h.onFinal("First the reading,");
h.onSpeechStart?.();
h.onPartial?.("then the");
await after(30_000);
assert.equal(turns.at(-1), "First the reading, then the");
assert.equal(silences, 1);
// A long turn runs on while words come: the limit counts from the last final, not the tap.
await talk();
h.onFinal("This week I have the history essay.");
h.onSpeechStart?.();
await after(20_000);
h.onFinal("And the lab report.");
h.onSpeechStart?.();
await after(20_000);
assert.equal(turns.length, 10);
h.onFinal("Which one first?");
await after(700);
assert.equal(turns.at(-1), "This week I have the history essay. And the lab report. Which one first?");

// Web Speech ends a recognition with an empty final: silence when nothing was said, the usual wait after words.
await talk();
h.onFinal("");
assert.equal(silences, 2);
await talk();
h.onFinal("put the essay on my calendar");
h.onSpeechStart?.();
h.onFinal("");
await after(2_199);
assert.equal(turns.length, 11);
await after(1);
assert.equal(turns.at(-1), "put the essay on my calendar");

// Errors still end the listen and drop the words.
await talk();
h.onFinal("Put it on");
h.onError?.("network");
await after(5_000);
assert.equal(turns.length, 12);
assert.equal(states[3], "network");
assert.equal(phase(), "idle");

// ---- listenWeb: after words a new recognition listens on, so a pause doesn't end the turn; pause stops it.
class Recognition {
  static made: Recognition[] = [];
  aborted = false;
  onspeechstart: (() => void) | null = null;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    Recognition.made.push(this);
  }
  abort() {
    this.aborted = true;
  }
}
Object.assign(globalThis, { window: { webkitSpeechRecognition: Recognition }, cancelAnimationFrame: () => {} });
const { listenWeb } = await import("./listen.ts");
const finals: string[] = [];
const web = await listenWeb({ onFinal: (text) => finals.push(text) });
const [first] = Recognition.made;
first.onresult?.({ results: [[{ transcript: "put the essay " }]] });
first.onend?.();
assert.deepEqual(finals, ["put the essay"]);
assert.equal(Recognition.made.length, 2);
Recognition.made[1].onend?.(); // nothing more said: no restart
assert.deepEqual(finals, ["put the essay", ""]);
assert.equal(Recognition.made.length, 2);
web.resume();
web.pause();
assert.equal(Recognition.made[2].aborted, true);
Recognition.made[2].onresult?.({ results: [[{ transcript: "late words" }]] });
Recognition.made[2].onend?.(); // an aborted recognition's end is ignored
assert.deepEqual(finals, ["put the essay", ""]);
assert.equal(Recognition.made.length, 3);

console.log("turn-check: ok");
