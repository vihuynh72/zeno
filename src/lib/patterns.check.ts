// Self-check for the patterns in patterns.ts (no database needed): node src/lib/patterns.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// patterns.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { kindOf, patternsIn } = await import("./patterns.ts");

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

// Long steps skipped: 3 skips or more of steps planned at 30 minutes or more.
assert.deepEqual(
  patternsIn([skipped(la(10, 9), 30), skipped(la(11, 9), 45), skipped(la(12, 9), 60)], LA),
  ["You often skip steps of 30 minutes or more."],
  "three long skips",
);
assert.deepEqual(patternsIn([skipped(la(10, 9), 30), skipped(la(11, 9), 45), skipped(la(12, 9), 25)], LA), [], "25 minutes is not long");

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

console.log("patterns self-check passed");
