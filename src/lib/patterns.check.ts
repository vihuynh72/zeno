// Self-check for the patterns in patterns.ts (no database needed): node src/lib/patterns.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// patterns.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { alreadySaid, kindOf, patternsIn, reconcile } = await import("./patterns.ts");

const LA = "America/Los_Angeles";
// A local time in Los Angeles in October (PDT, UTC-7); Date.UTC rolls a late hour into the next day.
const la = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 9, day, hour + 7, minute)).toISOString();
const done = (doneAt: string, minutes: number | null = null, startedAt: string | null = null) =>
  ({ status: "done" as const, minutes, startedAt, doneAt });
const skipped = (doneAt: string, minutes: number | null = null) => ({ status: "skipped" as const, minutes, startedAt: null, doneAt });
const fiveDays = [10, 11, 12, 13, 14];

assert.deepEqual(patternsIn([], LA), [], "no steps, no patterns");

// Time of day: 5 finished steps or more, 60% in one part of the day.
const nights = [la(10, 23, 30), la(11, 0, 30), la(12, 1)];
assert.deepEqual(patternsIn([...nights, la(13, 22)].map((time) => done(time)), LA), [], "4 finished steps are too few");
assert.deepEqual(patternsIn([...nights, la(13, 14), la(14, 15)].map((time) => done(time)), LA), ["You finish most steps late at night."], "3 of 5");
assert.deepEqual(patternsIn([la(10, 23), la(11, 1), la(12, 14), la(13, 15), la(14, 9)].map((time) => done(time)), LA), [], "2 of 5");
assert.deepEqual(patternsIn([...nights, la(13, 23), la(14, 23)].map((time) => skipped(time)), LA), [], "skipped steps don't count");
for (const [hour, minute, part] of [
  [21, 59, "in the evening"], [22, 0, "late at night"], [4, 59, "late at night"], [5, 0, "in the morning"],
  [11, 59, "in the morning"], [12, 0, "in the afternoon"], [16, 59, "in the afternoon"], [17, 0, "in the evening"],
] as const) {
  const steps = fiveDays.map((day) => done(la(day, hour, minute)));
  assert.deepEqual(patternsIn(steps, LA), [`You finish most steps ${part}.`], `${hour}:${minute}`);
}
// The same instants on another clock: 10 PM in Los Angeles is 2 PM the next day in Tokyo.
const tenPm = fiveDays.map((day) => done(la(day, 22)));
assert.deepEqual(patternsIn(tenPm, "Asia/Tokyo"), ["You finish most steps in the afternoon."], "Tokyo");

// Real length versus the estimate: 4 started steps with an estimate, by the median, rounded to the half.
const took = (day: number, planned: number | null, real: number) =>
  done(la(day, 9), planned, new Date(Date.parse(la(day, 9)) - real * 60_000).toISOString());
assert.deepEqual(
  patternsIn([took(10, 10, 20), took(11, 10, 20), took(12, 10, 15), took(13, 10, 25)], LA),
  ["Steps take you about 2x as long as you plan."],
  "twice as long",
);
assert.deepEqual(
  patternsIn([took(10, 10, 16), took(11, 10, 16), took(12, 10, 18), took(13, 10, 18)], LA),
  ["Steps take you about 1.5x as long as you plan."],
  "1.7 rounds to 1.5",
);
assert.deepEqual(patternsIn([took(10, 10, 20), took(11, 10, 20), took(12, 10, 15)], LA), [], "3 are too few");
assert.deepEqual(
  patternsIn([took(10, 10, 5), took(11, 20, 10), took(12, 10, 6), took(13, 30, 15)], LA),
  ["Steps take you less time than you plan."],
  "faster",
);
assert.deepEqual(patternsIn([took(10, 10, 12), took(11, 10, 12), took(12, 10, 12), took(13, 10, 12)], LA), [], "1.2x is close enough");
assert.deepEqual(
  patternsIn([took(10, 10, 20), took(11, 10, 20), took(12, null, 20), done(la(13, 9), 10)], LA),
  [],
  "steps without an estimate or never started don't count",
);
// Spans that say nothing about the person: timers left running overnight, and Start then Done 20 seconds later.
assert.deepEqual(patternsIn([took(10, 5, 5), took(11, 5, 5), took(12, 5, 1440), took(13, 5, 1440)], LA), [], "left running");
assert.deepEqual(patternsIn([10, 11, 12, 13].map((day) => took(day, 5, 1 / 3)), LA), [], "two quick taps");
// The longest span that counts is 3x the plan or 2 hours, whichever is longer.
const tens = [10, 11, 12].map((day) => took(day, 5, 10));
assert.deepEqual(patternsIn([...tens, took(13, 5, 120)], LA), ["Steps take you about 2x as long as you plan."], "2 hours counts");
assert.deepEqual(patternsIn([...tens, took(13, 5, 121)], LA), [], "past 2 hours doesn't");
assert.deepEqual(
  patternsIn([10, 11, 12, 13].map((day) => took(day, 10, 40)), LA),
  ["Steps take you 3x as long as you plan, or more."],
  "4x is said as 3x or more",
);

// Long steps skipped: 3 skips or more of steps planned at 30 minutes or more, and at least half of those steps.
const longSkips = [skipped(la(10, 9), 30), skipped(la(11, 9), 45), skipped(la(12, 9), 60)];
assert.deepEqual(patternsIn(longSkips, LA), ["You often skip steps of 30 minutes or more."], "three long skips");
assert.deepEqual(patternsIn([skipped(la(10, 9), 30), skipped(la(11, 9), 45), skipped(la(12, 9), 25)], LA), [], "25 minutes is not long");
const longDone = (count: number) => Array.from({ length: count }, (_, index) => done(la(13 + index, 15), 30));
assert.deepEqual(patternsIn([...longSkips, ...longDone(3)], LA), ["You often skip steps of 30 minutes or more."], "3 of 6 skipped");
assert.deepEqual(patternsIn([...longSkips, ...longDone(4)], LA), [], "3 of 7 is not often");
const mornings = Array.from({ length: 37 }, (_, index) => done(la(10 + (index % 5), 9, index), 30));
assert.deepEqual(patternsIn([...mornings, ...longSkips], LA), ["You finish most steps in the morning."], "3 skips among 40");

// Tiny starts: 3 finished steps or more of 10 minutes or less, finished more often than longer ones.
const tiny = [done(la(10, 9), 5), done(la(11, 9), 10), done(la(12, 9), 5)];
assert.deepEqual(
  patternsIn([...tiny, done(la(13, 9), 20), skipped(la(14, 9), 30)], LA),
  ["Steps of 10 minutes or less work best for you."],
  "tiny starts work",
);
assert.deepEqual(patternsIn([...tiny, done(la(13, 9), 20)], LA), [], "longer steps get finished just as often");
assert.deepEqual(patternsIn([...tiny.slice(0, 2), skipped(la(13, 9), 30)], LA), [], "2 tiny steps are too few");
assert.deepEqual(patternsIn(tiny, LA), [], "nothing longer to compare with");

// All four at once, in order: 10-minute steps that took 20 minutes late at night, and three long skips.
const all = patternsIn(
  [...fiveDays.map((day) => done(la(day, 23), 10, la(day, 22, 40))), ...[15, 16, 17].map((day) => skipped(la(day, 15), 30))],
  LA,
);
assert.deepEqual(all, [
  "You finish most steps late at night.",
  "Steps take you about 2x as long as you plan.",
  "You often skip steps of 30 minutes or more.",
  "Steps of 10 minutes or less work best for you.",
]);
// Every pattern has its own kind, and a changed pattern keeps the kind of the one it replaces.
assert.equal(new Set(all.map(kindOf)).size, 4, "four kinds");
assert.ok(all.every((text) => kindOf(text) !== null), "every pattern has a kind");
assert.equal(kindOf("You finish most steps in the morning."), kindOf(all[0]), "a new time of day replaces the old one");
assert.equal(kindOf("Steps take you less time than you plan."), kindOf(all[1]), "faster replaces slower");
assert.equal(kindOf("Maya has bio lab on Tuesdays."), null, "other memories are never replaced");

// What was already said stays: the same sentence, or a real-length multiple half a step away.
const times = (multiple: number) => `Steps take you about ${multiple}x as long as you plan.`;
assert.ok(alreadySaid(times(2), [{ text: times(1.5) }]) && alreadySaid(times(1.5), [{ text: times(2) }]), "half a step is noise");
assert.ok(alreadySaid("Steps take you 3x as long as you plan, or more.", [{ text: times(2.5) }]), "2.5x to 3x is noise too");
assert.ok(!alreadySaid(times(2.5), [{ text: times(1.5) }]), "a whole 1x is news");
assert.ok(!alreadySaid("Steps take you less time than you plan.", [{ text: times(1.5) }]), "faster replaces slower");
assert.ok(!alreadySaid(all[0], [{ text: "You finish most steps in the morning." }]), "a new time of day replaces the old one");
assert.ok(alreadySaid(all[0], [{ text: all[0] }]), "the same sentence");
// A median that wobbles around 1.75 (17 and 18 minutes for 10-minute steps), one step at a time, as learnFromSteps sees it.
let said: { text: string }[] = [];
let rewrites = 0;
const wobble = [17, 18, 17, 18, 17, 18, 17].map((real, index) => took(10 + index, 10, real));
for (let count = 4; count <= wobble.length; count++) {
  for (const text of patternsIn(wobble.slice(0, count), LA).filter((found) => kindOf(found) === kindOf(times(2)))) {
    if (alreadySaid(text, said)) continue;
    said = [{ text }];
    rewrites++;
  }
}
assert.equal(rewrites, 1, "said once, then kept");

// reconcile: a saved pattern that no longer holds is removed (Vi, 2026-11-01), a changed one is replaced, and one
// the person removed (Undo or Forget) is never saved again, even a wobble away.
const night = all[0];
const morning = "You finish most steps in the morning.";
const skips = all[2];
const rows = (...texts: string[]) => texts.map((text, index) => ({ id: `p${index}`, text }));
assert.deepEqual(reconcile([night, skips], rows(night, skips), []), { stale: [], fresh: [] }, "still holds and already said");
assert.deepEqual(reconcile([night], rows(night, skips), []).stale, [{ id: "p1", text: skips }], "stopped holding: removed");
assert.deepEqual(reconcile([], rows(night), []).stale.length, 1, "no steps left in the 30 days, nothing holds");
assert.deepEqual(reconcile([morning], rows(night), []), { stale: rows(night), fresh: [morning] }, "a new time of day replaces the old one");
assert.deepEqual(reconcile([times(2.5)], rows(times(2)), []), { stale: [], fresh: [] }, "a wobble keeps what was said");
const thrice = "Steps take you 3x as long as you plan, or more.";
assert.deepEqual(reconcile([thrice], rows(times(2)), []), { stale: rows(times(2)), fresh: [thrice] }, "a whole 1x is news");
assert.deepEqual(reconcile([night, skips], [], [night]).fresh, [skips], "removed by the person: never saved again");
assert.deepEqual(reconcile([times(2.5)], [], [times(2)]).fresh, [], "not even a wobble away");
assert.deepEqual(reconcile([morning], [], [night]).fresh, [morning], "another finding of the same kind is news");
assert.deepEqual(reconcile([night], [], ["Has bio lab on Tuesdays."]).fresh, [night], "other removed facts never block a pattern");

// A saved pattern holds on a looser line than a new one, so it is said once, not again on every wobble.
const halves = "MMMAAA".split("").map((part, index) => done(la(10 + index, part === "M" ? 9 : 15)));
assert.deepEqual(patternsIn(halves, LA), [], "half the steps is not most of them");
assert.deepEqual(patternsIn(halves, LA, [morning]), [morning], "but keeps the morning once it was said");
assert.deepEqual(patternsIn([...halves, ...[16, 17].map((day) => done(la(day, 15)))], LA, [morning]), ["You finish most steps in the afternoon."], "3 of 8 drops it for the afternoon");
assert.deepEqual(patternsIn([...longSkips, ...longDone(4)], LA, [all[2]]), [all[2]], "3 of 7 long skips keeps it");
assert.deepEqual(patternsIn([...tiny, done(la(13, 9), 20)], LA, [all[3]]), [all[3]], "an even finish rate keeps tiny starts");
const slowish = [10, 11, 12, 13].map((day) => took(day, 10, 13));
assert.deepEqual(patternsIn(slowish, LA), [], "1.3x is close enough for a new pattern");
assert.deepEqual(patternsIn(slowish, LA, [times(2)]), [times(1.5)], "but keeps a saved slower one, a wobble away");
// The review's sequence, one step at a time as learnFromSteps sees it: morning, morning, morning, afternoon x3, ...
let kept: { id: string; text: string }[] = [];
let saves = 0;
const wobbly = "MMMAAAMMAMAM".split("").map((part, index) => done(la(1 + index, part === "M" ? 9 : 15)));
for (let count = 1; count <= wobbly.length; count++) {
  const { stale, fresh } = reconcile(patternsIn(wobbly.slice(0, count), LA, kept.map((row) => row.text)), kept, []);
  kept = [...kept.filter((row) => !stale.includes(row)), ...fresh.slice(0, 1).map((text) => ({ id: `w${count}`, text }))];
  saves += fresh.length > 0 ? 1 : 0;
}
assert.equal(saves, 1, "the morning is saved once, not three times");
assert.deepEqual(kept.map((row) => row.text), [morning]);

console.log("patterns self-check passed");
