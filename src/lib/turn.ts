// Endings that leave a turn hanging: connectors, articles, prepositions, fillers, and asking for a moment.
const HANGING = [
  "and", "but", "so", "because", "or", "then", "if",
  "the", "a", "an", "my", "your", "our", "their",
  "to", "with", "of", "for",
  "like", "um", "umm", "uh", "uhh", "uhm", "er", "erm", "hmm", "i mean", "you know",
  "let me think", "let me see", "hold on", "hang on", "one sec", "wait",
];
// A whole turn that is complete on its own, even unpunctuated (Chrome's Web Speech adds no punctuation).
const REPLIES = new Set([
  "yes", "yeah", "yep", "yes please", "mm hmm", "uh huh", "no", "nope", "no thanks", "not now", "later",
  "done", "all done", "i'm done", "finished", "i finished", "i'm finished", "next", "next one", "what's next",
  "stop", "start", "start it", "skip", "skip it", "okay", "ok", "sure", "got it", "sounds good", "all right",
  "alright", "thanks", "thank you", "ready", "i'm ready", "let's go", "do it", "book it", "cancel", "never mind",
  "that's it", "that's all", "help", "help me", "i'm stuck",
]);

// Whether a spoken turn sounds finished, so Zeno can answer soon, or trails off, so Zeno leaves room to think.
export function soundsFinished(text: string): boolean {
  const said = text.trim();
  const words = (said.toLowerCase().replace(/’/g, "'").match(/[a-z0-9']+/g) ?? []).join(" ");
  if (!words || /([,;:\-–—]|\.\.\.|…)$/.test(said)) return false;
  if (REPLIES.has(words)) return true;
  if (HANGING.some((ending) => words === ending || words.endsWith(` ${ending}`))) return false;
  return /[.?!]$/.test(said) || words.split(" ").length >= 4;
}
