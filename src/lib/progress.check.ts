// Self-check for the week row, at-risk evenings and milestones in progress.ts (no database needed):
// node src/lib/progress.check.ts (streak.check.ts covers the streak rules)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// progress.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { progressFrom } = await import("./progress.ts");

const LA = "America/Los_Angeles";
const TOKYO = "Asia/Tokyo";
const at = (finished: Record<string, number>, now: string, zone = LA, justFinished = false) =>
  progressFrom(finished, zone, new Date(now), justFinished);
const future = ["future", "future", "future", "future", "future", "future"];

// Empty history, noon on Thursday Oct 29.
assert.deepEqual(
  at({}, "2026-10-29T19:00:00Z"),
  { streak: 0, best: 0, week: ["missed", "missed", "missed", "today", ...future.slice(3)], stepsThisWeek: 0, restDaysLeft: 1, atRisk: false, milestone: null },
  "empty history",
);

// Sun Oct 25 to Sat Oct 31 finished except Thursday (the week's rest day); several steps on some days.
const week = { "2026-10-25": 1, "2026-10-26": 2, "2026-10-27": 1, "2026-10-28": 3, "2026-10-30": 1, "2026-10-31": 1 };
// Noon on Sunday Nov 1, the day DST ends, just after the day's first step: the 7th day in a row.
assert.deepEqual(
  at({ ...week, "2026-11-01": 1 }, "2026-11-01T20:00:00Z", LA, true),
  {
    streak: 7, best: 7, week: ["done", "done", "done", "rest", "done", "done", "done"],
    stepsThisWeek: 9, restDaysLeft: 0, atRisk: false, milestone: 7,
  },
  "a full week with one rest day reaches 7",
);
const second = at({ ...week, "2026-11-01": 2 }, "2026-11-01T20:00:00Z", LA, true);
assert.deepEqual([second.milestone, second.stepsThisWeek], [null, 10], "the second step that day gets the normal stamp");
// The same counts after a request that finished nothing new (a page load, a skip, a repeated Done): no milestone.
assert.equal(at({ ...week, "2026-11-01": 1 }, "2026-11-01T20:05:00Z").milestone, null, "a later skip doesn't celebrate again");

// Evenings on the DST day: 01:30Z is 5:30 PM PST (6:30 PM in PDT), 02:30Z is 6:30 PM.
assert.equal(at(week, "2026-11-02T01:30:00Z").atRisk, false, "5:30 PM is not evening yet");
const evening = at(week, "2026-11-02T02:30:00Z");
assert.deepEqual([evening.atRisk, evening.streak, evening.week[6]], [true, 6, "today"], "6:30 PM with nothing finished");
assert.equal(at({ ...week, "2026-11-01": 1 }, "2026-11-02T02:30:00Z").atRisk, false, "a finished step saves the evening");
assert.equal(at({}, "2026-11-02T02:30:00Z").atRisk, false, "no streak, nothing at risk");
// 07:30Z on Nov 2 is still 11:30 PM Sunday in Los Angeles (it would be Monday in PDT).
assert.equal(at(week, "2026-11-02T07:30:00Z").week[6], "today", "late Sunday is still this week");

// A new week: last week's rest day is spent, this week's is fresh.
assert.deepEqual(
  at({ ...week, "2026-11-01": 1 }, "2026-11-02T20:00:00Z"),
  { streak: 7, best: 7, week: ["today", ...future], stepsThisWeek: 0, restDaysLeft: 1, atRisk: false, milestone: null },
  "Monday starts a new week",
);
// Clocks spring forward on Mar 8: 07:30Z on Mar 9 is 12:30 AM Monday PDT (still Sunday in PST).
const spring = at({ "2026-03-07": 1, "2026-03-08": 1 }, "2026-03-09T07:30:00Z");
assert.deepEqual([spring.week[0], spring.streak, spring.restDaysLeft], ["today", 2, 1], "DST starts on a Monday");

// Milestones at 3, 7, 14, 30, 50 and 100 only.
assert.equal(at({ "2026-10-29": 1, "2026-10-30": 1, "2026-10-31": 1 }, "2026-10-31T19:00:00Z", LA, true).milestone, 3, "3 days");
assert.equal(
  at({ "2026-10-28": 1, "2026-10-29": 1, "2026-10-30": 1, "2026-10-31": 1 }, "2026-10-31T19:00:00Z", LA, true).milestone,
  null,
  "4 days",
);
const hundred = Object.fromEntries(
  Array.from({ length: 100 }, (_, index) => [new Date(Date.UTC(2026, 9, 31 - 99 + index)).toISOString().slice(0, 10), 1]),
);
const day100 = at(hundred, "2026-10-31T19:00:00Z", LA, true);
assert.deepEqual([day100.streak, day100.milestone], [100, 100], "100 days");

// A person in Tokyo (UTC+9, no DST): their dates and evenings, not the server's.
const tokyo = { "2026-10-30": 1, "2026-10-31": 1 };
// 15:30Z on Oct 31 is 12:30 AM Sunday Nov 1 in Tokyo, while it is still Saturday morning in Los Angeles.
const sunday = at(tokyo, "2026-10-31T15:30:00Z", TOKYO);
assert.deepEqual([sunday.week.slice(4), sunday.streak, sunday.atRisk], [["done", "done", "today"], 2, false], "Tokyo's Sunday");
assert.deepEqual(at(tokyo, "2026-10-31T15:30:00Z").week.slice(4), ["done", "done", "future"], "the same instant in Los Angeles");
// 09:30Z on Nov 1 is 6:30 PM in Tokyo and 1:30 AM in Los Angeles.
assert.equal(at(tokyo, "2026-11-01T09:30:00Z", TOKYO).atRisk, true, "a Tokyo evening");
assert.equal(at(tokyo, "2026-11-01T09:30:00Z").atRisk, false, "a Los Angeles night");
// 15:30Z on Nov 1 is 12:30 AM Monday Nov 2 in Tokyo: Sunday was the old week's rest day.
assert.deepEqual(
  at(tokyo, "2026-11-01T15:30:00Z", TOKYO),
  { streak: 2, best: 2, week: ["today", ...future], stepsThisWeek: 0, restDaysLeft: 1, atRisk: false, milestone: null },
  "Tokyo's Monday",
);

console.log("progress self-check passed");
