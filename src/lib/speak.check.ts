// Self-check for the sentence splitter and the Done sound in speak.ts: node src/lib/speak.check.ts
import assert from "node:assert/strict";
import { playDone, splitSentences } from "./speak.ts";

// A browser that can't make the Done sound still finishes the step (no context is kept, so this runs first).
globalThis.AudioContext = class {
  constructor() {
    throw new Error("no audio");
  }
} as unknown as typeof AudioContext;
assert.doesNotThrow(playDone);

// The Done sound, on a fake AudioContext: two quiet sine notes a fifth apart, all over within 250 ms of the tap.
const notes: { hz: number; start: number; stop: number }[] = [];
const levels: number[] = [];
let resumed = 0;
globalThis.AudioContext = class {
  currentTime = 7;
  destination = {};
  resume = async () => void resumed++;
  createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime: (level: number) => levels.push(level) }, connect: (to: unknown) => to });
  createOscillator = () => {
    const note = { hz: 0, start: 0, stop: 0 };
    notes.push(note);
    return { frequency: { set value(hz: number) { note.hz = hz; } }, connect: (to: unknown) => to, start: (at: number) => (note.start = at), stop: (at: number) => (note.stop = at) };
  };
} as unknown as typeof AudioContext;
playDone();
assert.equal(resumed, 1, "a context still suspended since page load runs on the Done tap");
assert.deepEqual(notes.map((note) => note.hz), [660, 880]);
assert.equal(notes[0].start, 7);
assert.ok(Math.max(...notes.map((note) => note.stop)) - 7 <= 0.25 && Math.max(...levels) <= 0.1, "short and quiet");

// Times, titles, decimals, e.g., p.m. and U.S. stay inside their sentence; a short opener joins the next one.
assert.deepEqual(
  splitSentences(
    "It's 4:30. Dr. Lee moved your call to 5:15 p.m. today. That leaves 2.5 hours, e.g. enough for the U.S. history essay. Want to start with the outline, or with the reading?",
  ),
  [
    "It's 4:30. Dr. Lee moved your call to 5:15 p.m. today.",
    "That leaves 2.5 hours, e.g. enough for the U.S. history essay.",
    "Want to start with the outline, or with the reading?",
  ],
);

// A short last sentence joins the one before it.
assert.deepEqual(splitSentences("Your essay is due Friday at noon. Ready?"), ["Your essay is due Friday at noon. Ready?"]);

// Quotes after the stop stay with their sentence; "!" ends one too, and the short "Nice!" joins the next.
assert.deepEqual(splitSentences('Mr. Ortiz wrote "see you at 9." Nice! Should I add it to your calendar for today?'), [
  'Mr. Ortiz wrote "see you at 9."',
  "Nice! Should I add it to your calendar for today?",
]);

// Line breaks end a piece even without punctuation.
assert.deepEqual(splitSentences("First, open the draft you saved\nThen write one sentence about the main idea"), [
  "First, open the draft you saved",
  "Then write one sentence about the main idea",
]);

assert.deepEqual(splitSentences("Okay."), ["Okay."]);
assert.deepEqual(splitSentences("   "), []);

console.log("speak self-check passed");
