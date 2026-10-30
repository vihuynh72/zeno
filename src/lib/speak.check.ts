// Self-check for the sentence splitter in speak.ts: node src/lib/speak.check.ts
import assert from "node:assert/strict";
import { splitSentences } from "./speak.ts";

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
