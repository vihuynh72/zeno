// Self-check for goal-rows.ts: node src/components/goal-rows.check.ts (made-up goals and a made-up week, any server zone)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { Deadline, Goal, Step } from "@/lib/day";

// goal-rows.ts imports desk-rows.ts and tz.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { deskPlans, doneCaption, dueShort, duration, freeMinutes, leftCaption, sameGoal, segments, weekItems } = await import("./goal-rows.ts");

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

// The Desk's plans: the page's current plan first and fresh, then the day's other open plans; finished ones drop out.
const ids = (plans: Goal[]) => plans.map((plan) => `${plan.id}:${plan.steps.map((s) => s.status).join(",")}`);
const listed = [goal("g-essay", "History essay", null, [step("todo"), step("todo")]), goal("g-lab", "Lab report", null)];
const fresh = goal("g-essay", "History essay", null, [step("done"), step("doing")]);
assert.deepEqual(ids(deskPlans(fresh, listed)), ["g-essay:done,doing", "g-lab:todo"]);
assert.deepEqual(ids(deskPlans(goal("g-essay", "History essay", null, [step("done"), step("done")]), listed)), ["g-lab:todo"]);
assert.deepEqual(ids(deskPlans(goal("g-new", "Reading notes", null), listed)), ["g-new:todo", "g-essay:todo,todo", "g-lab:todo"]);
assert.deepEqual(ids(deskPlans(null, listed)), ["g-essay:todo,todo", "g-lab:todo"]);
// A day saved before Nov 3 has no list: only the current plan, when it has a step left.
assert.deepEqual(ids(deskPlans(fresh, undefined)), ["g-essay:done,doing"]);
assert.deepEqual(deskPlans(goal("g", "G", null, [step("skipped")]), undefined), []);
assert.deepEqual(deskPlans(null, undefined), []);

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

assert.deepEqual([5, 45, 60, 90, 135].map(duration), ["5 min", "45 min", "1 h", "1 h 30", "2 h 15"]);

// What is left: the steps not done (the running one too) and their planned minutes.
assert.equal(
  leftCaption(goal("g", "G", null, [step("done", 5), step("doing", 10), step("todo", 25), step("todo", 30), step("todo", 25), step("skipped", 15)])),
  "4 steps left · about 1 h 30",
);
assert.equal(leftCaption(goal("g", "G", null, [step("done"), step("todo", 5)])), "1 step left · about 5 min");
assert.equal(leftCaption(goal("g", "G", null, [step("todo", null), step("todo", null)])), "2 steps left");
assert.equal(leftCaption(goal("g", "G", null, [step("done"), step("skipped")])), "All steps done");

// Free time between 8 AM and 10 PM in Los Angeles, whatever the server's zone. Now is Tuesday Nov 3, 2:07 PM PST.
const LA = "America/Los_Angeles";
const now = Date.parse("2026-11-03T22:07:00Z");
const timed = (date: string, from: string, to: string) => ({ start: `${date}T${from}:00-08:00`, end: `${date}T${to}:00-08:00`, allDay: false });
const thursday = [
  timed("2026-11-05", "09:00", "09:50"),
  timed("2026-11-05", "12:00", "13:00"),
  { start: "2026-11-05", end: "2026-11-06", allDay: true }, // all day takes no time
  timed("2026-11-05", "14:00", "15:00"),
  timed("2026-11-05", "15:10", "16:00"), // the 10 minutes between these two don't count
];
// 8:00–9:00, 9:50–12:00, 13:00–14:00 and 16:00–22:00: 60 + 130 + 60 + 360 = 610, so 10 h.
assert.equal(freeMinutes(thursday, "2026-11-05", LA, now), 600);
assert.equal(freeMinutes([], "2026-11-05", LA, now), 14 * 60);
// Today counts from now: 2:07 to 3:00, then 4:15 to 10 PM, 398 minutes, so 6 h 30.
assert.equal(freeMinutes([timed("2026-11-03", "15:00", "16:15")], "2026-11-03", LA, now), 390);
// Events past either end of the window only trim it; a day booked through is 0.
assert.equal(freeMinutes([timed("2026-11-05", "07:00", "08:30"), timed("2026-11-05", "21:00", "23:00")], "2026-11-05", LA, now), 750);
assert.equal(freeMinutes([timed("2026-11-05", "07:00", "23:00")], "2026-11-05", LA, now), 0);
// Yesterday, and today after 10 PM, have no free time left to show.
assert.equal(freeMinutes([], "2026-11-02", LA, now), null);
assert.equal(freeMinutes([], "2026-11-03", LA, Date.parse("2026-11-04T06:30:00Z")), null);

// The week from Monday Nov 2: plans by their due date, deadlines by theirs, a deadline merged into its plan.
const essay = goal("g-essay", "History essay", "2026-11-06");
const lab = goal("g-lab", "Lab report", null);
const notes = goal("g-notes", "Reading notes", "2026-11-03");
const deadline = (title: string, date: string): Deadline => ({ title, date, daysLeft: 0 });
const week = weekItems(
  "2026-11-02",
  [essay, lab, notes],
  [
    deadline("History essay", "2026-11-06"),
    deadline("Lab report draft", "2026-11-05"),
    deadline("Problem set 4", "2026-11-05"),
    deadline("Quiz 3", "2026-11-10"), // next week
  ],
);
assert.deepEqual(
  week.map(({ date, items }) => [date, items.map((item) => [item.title, item.goal?.id ?? null, item.deadline?.title ?? null])]),
  [
    ["2026-11-02", []],
    ["2026-11-03", [["Reading notes", "g-notes", null]]],
    ["2026-11-04", []],
    [
      "2026-11-05",
      [
        ["Lab report", "g-lab", "Lab report draft"],
        ["Problem set 4", null, "Problem set 4"],
      ],
    ],
    ["2026-11-06", [["History essay", "g-essay", "History essay"]]],
    ["2026-11-07", []],
    ["2026-11-08", []],
  ],
);
assert.deepEqual(
  weekItems("2026-11-02", [], []).map((day) => day.items.length),
  [0, 0, 0, 0, 0, 0, 0],
);

console.log("goal-rows self-check passed");
