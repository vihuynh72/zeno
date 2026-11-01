// Self-check for the streak and best-streak rules in progress.ts (no database needed): node src/lib/streak.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// progress.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { progressFrom } = await import("./progress.ts");

const LA = "America/Los_Angeles";
// One finished step on each local date.
const days = (...dates: string[]) => Object.fromEntries(dates.map((date) => [date, 1]));
const streak = (dates: string[], now: string) => progressFrom(days(...dates), LA, new Date(now)).streak;

// Noon on Saturday Oct 31 in Los Angeles (PDT). That week runs from Mon Oct 26 to Sun Nov 1.
const sat = "2026-10-31T19:00:00Z";
assert.equal(streak([], sat), 0, "none");
assert.equal(streak(["2026-10-31"], sat), 1, "only today");
assert.equal(streak(["2026-10-29", "2026-10-31", "2026-10-30"], sat), 3, "today, yesterday and the day before, in any order");
assert.equal(streak(["2026-10-30", "2026-10-29"], sat), 2, "nothing yet today: the run ends yesterday");

// Rest days: the first missed day of a week keeps the streak alive without adding to it.
assert.equal(streak(["2026-10-31", "2026-10-30", "2026-10-28", "2026-10-27"], sat), 4, "a missed Thursday is the week's rest day");
assert.equal(streak(["2026-10-29", "2026-10-28"], sat), 2, "a missed yesterday is the rest day, so the streak is live today");
assert.equal(streak(["2026-10-31", "2026-10-28", "2026-10-27"], sat), 1, "a second miss in the same week ends it");
assert.equal(streak(["2026-10-28", "2026-10-27"], sat), 0, "two missed days before today end it");
assert.equal(streak(["2026-10-28", "2026-10-30", "2026-10-31"], sat), 3, "days before the first step never spend the rest day");
// Each Mon–Sun week has its own: a missed Sunday and the missed Monday after it are two weeks' rest days.
assert.equal(streak(["2026-10-30", "2026-10-31", "2026-11-03", "2026-11-04"], "2026-11-04T20:00:00Z"), 4, "Sunday and Monday rests");

// US clocks fall back on Nov 1 (a 25-hour day) and spring forward on Mar 8 (23 hours).
assert.equal(streak(["2026-10-31", "2026-11-01", "2026-11-02"], "2026-11-02T20:00:00Z"), 3, "DST ends");
assert.equal(streak(["2026-03-07", "2026-03-08"], "2026-03-09T19:00:00Z"), 2, "DST starts, ending yesterday");
assert.equal(streak(["2025-12-31", "2026-01-01"], "2026-01-01T20:00:00Z"), 2, "across the new year");

// Best: the longest run over the whole history, far past 60 days.
const august = Array.from({ length: 9 }, (_, index) => `2026-08-0${index + 1}`);
const after = progressFrom(days(...august, "2026-10-30", "2026-10-31"), LA, new Date(sat));
assert.deepEqual([after.streak, after.best], [2, 9], "a 9-day run in August stays the best");
const run = Array.from({ length: 20 }, (_, index) => `2026-10-${String(12 + index).padStart(2, "0")}`);
const current = progressFrom(days(...run), LA, new Date(sat));
assert.deepEqual([current.streak, current.best], [20, 20], "the current run is the best");
assert.equal(progressFrom({}, LA, new Date(sat)).best, 0, "no history, no best");

console.log("streak self-check passed");
