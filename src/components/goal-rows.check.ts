// Self-check for goal-rows.ts: node src/components/goal-rows.check.ts (made-up goals and a made-up week, any server zone)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { Deadline, DoneStep, Goal, Step } from "@/lib/day";

// goal-rows.ts imports desk-rows.ts and tz.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { comingCaption, deskPlans, doneCaption, doneSteps, dueShort, duration, freeMinutes, leftCaption, mergeDone, sameGoal, segments, weekPlan } =
  await import("./goal-rows.ts");

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
// A goal that keeps going stays with no session left: its next few are planned when it opens (Nov 4).
const rolling = { ...goal("g-run", "Run a 5K", null, [step("done", 20)]), rhythm: "3 runs a week" };
assert.deepEqual(ids(deskPlans(rolling, undefined)), ["g-run:done"]);
assert.equal(leftCaption(rolling), "Next few to plan");

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

// What is left: the steps not done (the running one too) and their planned minutes.
assert.equal(
  leftCaption(goal("g", "G", null, [step("done", 5), step("doing", 10), step("todo", 25), step("todo", 30), step("todo", 25), step("skipped", 15)])),
  "4 steps left · about 1 h 30 min",
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

// Coming up counts days from today.
assert.equal(comingCaption(goal("g", "Thesis chapter 2", "2026-12-15", [step("done"), step("todo"), step("todo"), step("doing")]), "2026-11-03"), "42 days · 3 steps left");
assert.equal(comingCaption(goal("g", "Quiz", "2026-11-09"), "2026-11-08"), "1 day · 1 step left");

// The week from Monday Nov 2, today Tuesday Nov 3 in Los Angeles: every open plan shows once. Plans and deadlines on their
// days (a deadline merged into its plan), a plan due before the week on Today, later ones under Coming up, undated ones
// under Ongoing, and each day's finished steps on the person's clock, newest first.
const essay = goal("g-essay", "History essay", "2026-11-06");
const lab = goal("g-lab", "Lab report", null);
const notes = goal("g-notes", "Reading notes", "2026-11-03");
const taxes = goal("g-tax", "Send the tax papers", "2026-10-30");
const thesis = goal("g-thesis", "Thesis chapter 2", "2026-12-15");
const run = { ...goal("g-run", "Run a 5K", null), rhythm: "3 runs a week" };
const quiz = goal("g-quiz", "CS 146 exam", "2026-11-09");
const plans = [notes, essay, lab, taxes, thesis, run, quiz];
const deadline = (title: string, date: string): Deadline => ({ title, date, daysLeft: 0 });
const deadlines = [
  deadline("History essay", "2026-11-06"),
  deadline("Lab report draft", "2026-11-05"),
  deadline("Problem set 4", "2026-11-05"),
  deadline("Quiz 3", "2026-11-10"), // next week
];
const doneStep = (title: string, doneAt: string, minutes: number | null = null): DoneStep => ({ title, goal: "Find a job", doneAt, minutes });
const done = [
  doneStep("Read ch 4", "2026-11-03T20:00:00Z"),
  doneStep("Pick a role", "2026-11-03T17:05:00Z", 5),
  doneStep("Put shoes out", "2026-11-03T07:30:00Z", 1), // 11:30 PM Monday in Los Angeles, Tuesday in UTC
  doneStep("Old step", "2026-10-30T18:00:00Z"), // last week
];
const shape = ({ days, comingUp, ongoing }: ReturnType<typeof weekPlan>) => ({
  days: days.map(({ date, done, items }) => [
    date,
    done.map((step) => step.title),
    items.map((item) => [item.title, item.goal?.id ?? null, item.deadline?.title ?? null]),
  ]),
  comingUp: comingUp.map((plan) => plan.id),
  ongoing: ongoing.map((plan) => plan.id),
});
assert.deepEqual(shape(weekPlan("2026-11-02", "2026-11-03", plans, deadlines, done, LA)), {
  days: [
    ["2026-11-02", ["Put shoes out"], []],
    [
      "2026-11-03",
      ["Read ch 4", "Pick a role"],
      [
        ["Reading notes", "g-notes", null],
        ["Send the tax papers", "g-tax", null],
      ],
    ],
    ["2026-11-04", [], []],
    [
      "2026-11-05",
      [],
      [
        ["Lab report", "g-lab", "Lab report draft"],
        ["Problem set 4", null, "Problem set 4"],
      ],
    ],
    ["2026-11-06", [], [["History essay", "g-essay", "History essay"]]],
    ["2026-11-07", [], []],
    ["2026-11-08", [], []],
  ],
  // The lab report sits on Thursday with its deadline, so it is not Ongoing as well.
  comingUp: ["g-quiz", "g-thesis"],
  ongoing: ["g-run"],
});
// In UTC the 11:30 PM step is Tuesday's.
assert.deepEqual(
  weekPlan("2026-11-02", "2026-11-03", [], [], done, "UTC").days.map((day) => day.done.length),
  [0, 3, 0, 0, 0, 0, 0],
);
// Next week: its own plans and deadlines; the late plan stays on this week's Today; nothing finished yet.
assert.deepEqual(shape(weekPlan("2026-11-09", "2026-11-03", plans, deadlines, done, LA)), {
  days: [
    ["2026-11-09", [], [["CS 146 exam", "g-quiz", null]]],
    ["2026-11-10", [], [["Quiz 3", null, "Quiz 3"]]],
    ["2026-11-11", [], []],
    ["2026-11-12", [], []],
    ["2026-11-13", [], []],
    ["2026-11-14", [], []],
    ["2026-11-15", [], []],
  ],
  comingUp: ["g-thesis"],
  ongoing: ["g-lab", "g-run"],
});
// Last week only looks back: what was due and what was finished then, nothing coming up.
assert.deepEqual(shape(weekPlan("2026-10-26", "2026-11-03", plans, deadlines, done, LA)), {
  days: [
    ["2026-10-26", [], []],
    ["2026-10-27", [], []],
    ["2026-10-28", [], []],
    ["2026-10-29", [], []],
    ["2026-10-30", ["Old step"], [["Send the tax papers", "g-tax", null]]],
    ["2026-10-31", [], []],
    ["2026-11-01", [], []],
  ],
  comingUp: [],
  ongoing: [],
});
// On Sunday the week still looks ahead; no plans at all is seven empty days.
assert.deepEqual(shape(weekPlan("2026-11-02", "2026-11-08", [thesis, run], [], [], LA)).comingUp, ["g-thesis"]);
assert.deepEqual(shape(weekPlan("2026-11-02", "2026-11-03", [], [], [], LA)), {
  days: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"].map((date) => [date, [], []]),
  comingUp: [],
  ongoing: [],
});

console.log("goal-rows self-check passed");
