// Self-check for goal-rows.ts: node src/components/goal-rows.check.ts (made-up goals, any server zone)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { Goal, Step } from "@/lib/day";

// goal-rows.ts imports desk-rows.ts and tz.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { deskPlans, doneCaption, doneSteps, dueShort, duration, mergeDone, nextCaption, sameGoal, segments } = await import("./goal-rows.ts");

const step = (status: Step["status"], minutes: number | null = 10): Step => ({
  id: `s-${Math.random()}`,
  title: "A step",
  minutes,
  status,
  startedAt: null,
  doneAt: null,
});
const goal = (id: string, title: string, due: string | null, steps: Step[] = [step("todo")]): Goal => ({ id, title, due, steps });

// Titles match when either contains the other, in lowercase, with punctuation and spacing evened out (Vi, Nov 3).
assert.ok(sameGoal("History essay", "history-essay draft"));
assert.ok(sameGoal("SOC 15: Field report", "soc 15   field report"));
assert.ok(sameGoal("Due: Lab 3 (Enzymes)", "LAB 3 enzymes"));
assert.ok(sameGoal("Café notes", "CAFÉ NOTES"));
assert.ok(!sameGoal("Lab report", "Reading notes"));
// A title with no letters or digits never matches, even itself.
assert.ok(!sameGoal("!!!", "Lab report"));
assert.ok(!sameGoal("", ""));

// The Desk's plans: the page's current plan fresh, with the day's other open plans in the sidebar's order (by due date,
// undated last, then by title); finished ones drop out.
const ids = (plans: Goal[]) => plans.map((plan) => `${plan.id}:${plan.steps.map((s) => s.status).join(",")}`);
const listed = [goal("g-essay", "History essay", null, [step("todo"), step("todo")]), goal("g-lab", "Lab report", null)];
const fresh = goal("g-essay", "History essay", null, [step("done"), step("doing")]);
assert.deepEqual(ids(deskPlans(fresh, listed)), ["g-essay:done,doing", "g-lab:todo"]);
assert.deepEqual(ids(deskPlans(goal("g-essay", "History essay", null, [step("done"), step("done")]), listed)), ["g-lab:todo"]);
assert.deepEqual(ids(deskPlans(goal("g-new", "Reading notes", null), listed)), ["g-essay:todo,todo", "g-lab:todo", "g-new:todo"]);
// Due soonest first, as the sidebar lists them (round 2, Nov 4), the current plan included.
const dated = [goal("g-exam", "CS 146 exam", "2026-11-12"), goal("g-paper", "PHIL 134 paper", "2026-11-06")];
assert.deepEqual(ids(deskPlans(goal("g-lab", "Lab report", null), dated)), ["g-paper:todo", "g-exam:todo", "g-lab:todo"]);
assert.deepEqual(ids(deskPlans(null, listed)), ["g-essay:todo,todo", "g-lab:todo"]);
// A day saved before Nov 3 has no list: only the current plan, when it has a step left.
assert.deepEqual(ids(deskPlans(fresh, undefined)), ["g-essay:done,doing"]);
assert.deepEqual(deskPlans(goal("g", "G", null, [step("skipped")]), undefined), []);
assert.deepEqual(deskPlans(null, undefined), []);
// A goal that keeps going stays with no session left: its next few are planned when it opens (Nov 4).
const rolling = { ...goal("g-run", "Run a 5K", null, [step("done", 20)]), rhythm: "3 runs a week" };
assert.deepEqual(ids(deskPlans(rolling, undefined)), ["g-run:done"]);
assert.equal(nextCaption(rolling), "Next few to plan");
assert.equal(nextCaption(goal("g", "G", null, [step("done", 5), step("todo", 20)])), "Next: A step · 20 min");

// The bar: done in ink, the running step (else the next to do) in red, the rest (skipped too) in the track color.
assert.deepEqual(segments(goal("g", "G", null, [step("done"), step("done"), step("doing"), step("todo"), step("skipped")])), [
  "done",
  "done",
  "next",
  "todo",
  "todo",
]);
assert.deepEqual(segments(goal("g", "G", null, [step("skipped"), step("done"), step("todo"), step("todo")])), ["todo", "done", "next", "todo"]);
assert.deepEqual(segments(goal("g", "G", null, [step("done"), step("done")])), ["done", "done"]);
assert.equal(doneCaption(goal("g", "G", null, [step("done"), step("done"), step("doing"), step("todo"), step("skipped")])), "2 of 5 done");
// No lone 0: the fonts slash it, and "Ø of 3 done" was misread (Nov 4).
assert.equal(doneCaption(goal("g", "G", null, [step("doing"), step("todo"), step("todo")])), "None of 3 done");

// Due dates from Tuesday Nov 3: today, tomorrow, a weekday within a week, else the date; past ones say "was due".
const due = (date: string) => dueShort(date, "2026-11-03");
assert.equal(due("2026-11-03"), "due today");
assert.equal(due("2026-11-04"), "due tomorrow");
assert.equal(due("2026-11-06"), "due Fri");
assert.equal(due("2026-11-09"), "due Mon");
assert.equal(due("2026-11-10"), "due Nov 10");
assert.equal(due("2026-11-02"), "was due Mon");
assert.equal(due("2026-10-20"), "was due Oct 20");
assert.equal(due("soon"), "");

// Durations always end in a unit (Kenji's Week read "about 2 h 5", Nov 3).
assert.deepEqual([5, 45, 60, 90, 125, 135].map(duration), ["5 min", "45 min", "1 h", "1 h 30 min", "2 h 5 min", "2 h 15 min"]);

// The Week's finished steps from the plans' own steps: real minutes from Start to Done when believable, else none.
const finished = (title: string, startedAt: string | null, doneAt: string | null, status: Step["status"] = "done"): Step => ({
  ...step(status, 25),
  title,
  startedAt,
  doneAt,
});
assert.deepEqual(
  doneSteps([
    goal("g-run", "Run a 5K", null, [
      finished("Put shoes out", "2026-11-03T07:28:40Z", "2026-11-03T07:30:00Z"), // 1 min 20 s
      finished("Easy run", null, "2026-11-03T15:00:00Z"), // finished by talk, never started
      finished("Stretch", "2026-11-03T15:00:00Z", "2026-11-03T15:00:20Z"), // 20 s
      finished("Long run", "2026-11-02T01:00:00Z", "2026-11-02T09:00:00Z"), // left running overnight
      finished("Next run", "2026-11-03T16:00:00Z", null, "doing"),
      finished("Skipped run", null, "2026-11-03T16:00:00Z", "skipped"),
    ]),
    goal("g-job", "Find a job", null, [finished("Pick a role", "2026-11-03T17:00:00Z", "2026-11-03T17:05:00Z")]),
  ]),
  [
    { title: "Put shoes out", goal: "Run a 5K", doneAt: "2026-11-03T07:30:00Z", minutes: 1 },
    { title: "Easy run", goal: "Run a 5K", doneAt: "2026-11-03T15:00:00Z", minutes: null },
    { title: "Stretch", goal: "Run a 5K", doneAt: "2026-11-03T15:00:20Z", minutes: null },
    { title: "Long run", goal: "Run a 5K", doneAt: "2026-11-02T09:00:00Z", minutes: null },
    { title: "Pick a role", goal: "Find a job", doneAt: "2026-11-03T17:05:00Z", minutes: 5 },
  ],
);

// The day's list and the page's plans merge, each step once (the same instant written two ways is one step), the day's
// entry and minutes kept; a step finished since the day loaded joins.
const ran = { title: "Easy run", goal: "Run a 5K", doneAt: "2026-11-03T15:00:00.000Z", minutes: 24 };
assert.deepEqual(
  mergeDone(
    [ran, { title: "Write the toast", goal: "Wedding toast", doneAt: "2026-11-02T18:00:00Z", minutes: 15 }],
    [
      { ...ran, doneAt: "2026-11-03T15:00:00Z", minutes: 23 },
      { title: "Long run", goal: "Run a 5K", doneAt: "2026-11-03T16:00:00Z", minutes: null },
    ],
  ).map((step) => `${step.title} ${step.minutes}`),
  ["Easy run 24", "Write the toast 15", "Long run null"],
);
assert.deepEqual(mergeDone([], []), []);

console.log("goal-rows self-check passed");
