// Self-check for goal-match.ts: node src/components/goal-match.check.ts (made-up goals, mail and events, any server zone)
import assert from "node:assert/strict";
import type { DayEmail, DayEvent, Goal, Step } from "@/lib/day";
import { forGoal, goalEvent, nextBlock, words } from "./goal-match.ts";

const step = (id: string, title: string, extra: Partial<Step> = {}): Step => ({ id, title, minutes: 20, status: "todo", startedAt: null, doneAt: null, ...extra });
const run: Goal = { id: "g1", title: "Run a 5K", due: "2027-01-15", rhythm: "3 runs a week", steps: [step("r1", "Run-walk, 20 min"), step("r2", "Stretch after the run")] };
const paper: Goal = { id: "g2", title: "PHIL 134 paper", due: "2026-11-12", steps: [step("p1", "Find three sources on free will"), step("p2", "Write the intro")] };
const mail = (from: string, subject: string, snippet = ""): DayEmail => ({ from, subject, snippet, unread: true });
const text = (one: DayEmail) => `${one.from} ${one.subject} ${one.snippet}`;

assert.deepEqual(words("Couch-to-5K: 3 runs, PHIL 134"), ["couch", "5k", "run", "phil", "134"]);

const inbox = [
  mail("Newsletter", "Write better emails this week"),
  mail("Coach Sam", "Sat 8?", "Long run at the lake"),
  mail("Prof. Patel", "PHIL 134 paper: outline due"),
  mail("Race HQ", "Your 5K bib is ready"),
  mail("Mom", "Dinner Sunday"),
];
// A title word is enough; filler like "write" or "this week" never matches.
assert.deepEqual(forGoal(run, inbox, text).map((one) => one.from), ["Coach Sam", "Race HQ"]);
assert.deepEqual(forGoal(paper, inbox, text).map((one) => one.from), ["Prof. Patel"]);
// Two step words match without a title word; one doesn't.
assert.deepEqual(forGoal(paper, [mail("Library", "Sources on free will"), mail("Gym", "Free class")], text).map((one) => one.from), ["Library"]);
// At most 3, best first.
assert.equal(forGoal(run, [mail("A", "5K run"), mail("B", "run"), mail("C", "5K"), mail("D", "5K run walk")], text).map((one) => one.from).join(""), "DAB");

// The next event: a booked step or today's matching event, whichever is sooner and not over.
const now = Date.parse("2026-11-04T17:00:00Z");
const event = (title: string, start: string, end: string, allDay = false): DayEvent => ({ title, start, end, allDay });
const today = [
  event("Run club", "2026-11-04T15:00:00Z", "2026-11-04T16:00:00Z"),
  event("5K group run", "2026-11-05T01:00:00Z", "2026-11-05T02:00:00Z"),
  event("Dentist", "2026-11-04T18:00:00Z", "2026-11-04T19:00:00Z"),
  event("Due: Run a 5K", "2026-11-04", "2026-11-05", true),
];
assert.equal(goalEvent(run, today, now)?.title, "5K group run");
const booked = { ...run, steps: [step("r1", "Run-walk, 20 min", { scheduledAt: "2026-11-04T23:00:00Z" }), run.steps[1]] };
assert.equal(goalEvent(booked, today, now)?.title, "Run-walk, 20 min");
assert.equal(goalEvent(paper, today, now), null);

// Free time: from 10 minutes out on a 5-minute mark, the first gap the step fits.
const slots = [
  { start: "2026-11-04T17:02:00Z", end: "2026-11-04T17:25:00Z" },
  { start: "2026-11-04T18:00:00Z", end: "2026-11-04T19:00:00Z" },
];
assert.deepEqual(nextBlock(run.steps[0], slots, now), {
  title: "Run-walk, 20 min",
  kind: "step",
  start: "2026-11-04T18:00:00.000Z",
  end: "2026-11-04T18:20:00.000Z",
  stepId: "r1",
});
assert.equal(nextBlock({ ...run.steps[0], minutes: 10 }, slots, now)?.start, "2026-11-04T17:10:00.000Z");
assert.equal(nextBlock({ ...run.steps[0], minutes: 90 }, slots, now), null);

console.log("goal-match: all checks passed");
