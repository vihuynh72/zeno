// Self-check for day-flow.ts, run like Vercel does, in UTC: TZ=UTC node src/components/day-flow.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { FirstPick, Goal, Progress, Step, TalkAction } from "@/lib/day";
import type { Fact } from "@/components/day-flow";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const flow = await import("./day-flow.ts");
const { asks, cardSize, clock, dayPart, doneLine, draftGoal, dueLabel, greeting, groupFacts, laterBlock, nextScreen, openSteps } = flow;
const { pickFits, planBlocks, quickReplies, SETUP, slotLabel, soonEvent, streakLine, withStatus } = flow;

const step = (id: string, status: Step["status"], extra: Partial<Step> = {}): Step => ({
  id,
  title: `Step ${id}`,
  minutes: 10,
  status,
  startedAt: null,
  doneAt: null,
  ...extra,
});
const goal = (...steps: Step[]): Goal => ({ id: "g", title: "Essay", steps });
const acts = (...types: TalkAction["type"][]) => types.map((type) => ({ type, label: type }));

assert.equal(greeting(9, "Vi"), "Good morning, Vi.");
assert.equal(greeting(15, "Vi"), "Good afternoon, Vi.");
assert.equal(greeting(17, null), "Good evening.");
assert.equal(greeting(1, "Vi"), "Still up, Vi?");
assert.equal(greeting(5, null), "Good morning.");

// A step already started comes before earlier ones still to do; done and skipped drop out.
const mixed = goal(step("1", "done"), step("2", "todo"), step("3", "doing"), step("4", "skipped"), step("5", "todo"));
assert.deepEqual(openSteps(mixed).map((s) => s.id), ["3", "2", "5"]);
assert.deepEqual(openSteps(null), []);

// A new roadmap shows the plan; a started step goes to focus; small talk stays put.
const fresh = goal(step("1", "todo"), step("2", "todo"));
assert.equal(nextScreen("talk", acts("goal-set"), fresh), "plan");
assert.equal(nextScreen("focus", acts("roadmap-changed"), fresh), "plan");
assert.equal(nextScreen("plan", acts("step-started"), goal(step("1", "doing"))), "focus");
assert.equal(nextScreen("focus", acts("step-finished"), goal(step("1", "done"))), "checkin");
assert.equal(nextScreen("ready", [], null), "talk");
assert.equal(nextScreen("wrap", [], null), "talk");
assert.equal(nextScreen("focus", acts("remembered"), fresh), "focus");
assert.equal(nextScreen("talk", acts("goal-set"), goal(step("1", "done"))), "talk");
assert.equal(nextScreen("plan", [], null), "talk");
assert.equal(nextScreen("focus", acts("forgot"), goal(step("1", "done"))), "talk");

// A saved line is reused within the same date and part of the day, never across them.
assert.equal(dayPart(new Date(2026, 9, 31, 9)), dayPart(new Date(2026, 9, 31, 11, 59)));
assert.notEqual(dayPart(new Date(2026, 9, 31, 11)), dayPart(new Date(2026, 9, 31, 12)));
assert.notEqual(dayPart(new Date(2026, 9, 30, 9)), dayPart(new Date(2026, 9, 31, 9)));
assert.notEqual(dayPart(new Date(2026, 9, 31, 4)), dayPart(new Date(2026, 9, 31, 5)));

assert.deepEqual(quickReplies(["Start the essay", " ", 3, " Plan my day ", "a", "b"]), ["Start the essay", "Plan my day", "a"]);
assert.deepEqual(quickReplies(undefined), []);
// The model's own "Something else" (its prompt even suggests it) and repeats would duplicate a chip's key.
assert.deepEqual(quickReplies(["Start it", "Something else", "Start it", "Set up tomorrow", "something else."]), ["Start it", "Set up tomorrow"]);
assert.equal(quickReplies(["x".repeat(200)])[0].length, 80);
// Beside a booking offer (live, Nov 1): the offer chip is the one way to book, and three chips at most sit beside it.
assert.deepEqual(quickReplies(["Yes, book it", "Pick later time", "Not now"], true), ["Pick later time", "Not now"]);
assert.deepEqual(
  quickReplies(["Sounds good!", "Do it", "Book it", "Yes", "Let's do it", "Sure, block it", "OK, sounds good, book it.", "Lock it in", "Add it to my calendar"], true),
  [],
);
assert.deepEqual(quickReplies(["Yes, but later", "Not on my calendar", "Do it now"], true), ["Yes, but later", "Not on my calendar"], "not just a yes");
assert.deepEqual(quickReplies(["Book 9 AM instead", "Book a later time"], true), ["Book 9 AM instead", "Book a later time"], "another time");
assert.deepEqual(quickReplies(["Earlier", "Later tonight", "Not now"], true), ["Earlier", "Later tonight"]);
assert.deepEqual(quickReplies(["Book 9:30", "9 works", "Yes"], true), ["Book 9:30", "9 works"], "a time in digits is more than yes");
assert.deepEqual(quickReplies(["Yes, book it", "Not now"]), ["Yes, book it", "Not now"], "no offer: a yes is the answer");
assert.ok(SETUP.every((card) => card.answers.length >= 2 && card.answers.length <= 4));

// Hands-free listens only after a question.
assert.equal(asks("Want to start the outline?"), true);
assert.equal(asks('Ready for "the next one?"'), true);
assert.equal(asks("Timer's on. Just five minutes."), false);
// A shorter timer says its real length.
assert.equal(flow.CHECKINS.start(5), "Timer's on. Just five minutes.");
assert.equal(flow.CHECKINS.start(3), "Timer's on. 3 minutes, one thing.");
assert.equal(flow.CHECKINS.start(1), "Timer's on. 1 minute, one thing.");
assert.equal(asks("Done? Nice work."), false);

assert.equal(cardSize("Good afternoon, Vi."), "l");
assert.equal(cardSize("x".repeat(120)), "m");
assert.equal(cardSize("x".repeat(200)), "s");
assert.equal(clock(600), "10:00");
assert.equal(clock(65.2), "1:06");
assert.equal(clock(-3), "0:00");

// A saved first card is shown again only while it still fits the day's plan.
const pickStep: FirstPick = { goal: "Essay", due: null, stepId: "2", steps: [{ title: "Step 2", minutes: 5 }], why: "Next." };
const pickNew: FirstPick = { goal: "Lab report", due: "2026-11-04", stepId: null, steps: [{ title: "Open it", minutes: 5 }, { title: "Draft", minutes: 15 }], why: "Due Wednesday." };
assert.equal(pickFits(pickStep, goal(step("1", "done"), step("2", "todo"))), true);
assert.equal(pickFits(pickStep, goal(step("2", "done"))), false, "its step is finished");
assert.equal(pickFits(pickNew, null), true);
assert.equal(pickFits(pickNew, goal(step("1", "todo"))), false, "a plan is open now");
assert.equal(pickFits(null, null), false);

// A new plan shows at once, step 1 running when the tap was Start.
const now = new Date("2026-11-02T17:00:00Z");
const draft = draftGoal(pickNew, true, now);
assert.deepEqual(draft.steps.map((s) => [s.status, s.startedAt]), [["doing", now.toISOString()], ["todo", null]]);
assert.equal(draftGoal(pickNew, false, now).steps[0].status, "todo");
// Starting one step puts any other running one back to todo, as the server does.
const started = withStatus(goal(step("1", "doing", { startedAt: "x" }), step("2", "todo")), "2", "doing", now);
assert.deepEqual(started.steps.map((s) => s.status), ["todo", "doing"]);
assert.equal(started.steps[1].startedAt, now.toISOString());
assert.equal(withStatus(goal(step("1", "doing")), "1", "done", now).steps[0].doneAt, now.toISOString());

assert.equal(dueLabel("2026-11-02", "2026-11-02"), "Due today");
assert.equal(dueLabel("2026-11-03", "2026-11-02"), "Due tomorrow");
assert.equal(dueLabel("2026-11-06", "2026-11-02"), "Due Friday");
assert.equal(dueLabel("2026-11-06", "2026-11-02", true), "Due Fri");
assert.equal(dueLabel("2026-11-06", ""), "", "no date before the browser's clock");
assert.equal(dueLabel("2026-11-20", "2026-11-02"), "Due Nov 20");
assert.equal(dueLabel("2026-10-30", "2026-11-02"), "Was due Oct 30");

// Booking offers: never overlapping, at least half an hour out, 5-minute starts, booked steps skipped.
const LA = "America/Los_Angeles";
const slots = [
  { start: "2026-11-02T17:10:00Z", end: "2026-11-02T17:50:00Z" },
  { start: "2026-11-02T19:00:00Z", end: "2026-11-02T19:20:00Z" },
  { start: "2026-11-03T16:00:00Z", end: "2026-11-03T18:00:00Z" },
];
const blocks = planBlocks([step("a", "todo"), step("b", "todo", { scheduledAt: "2026-11-02T20:00:00Z" }), step("c", "todo", { minutes: 15 }), step("d", "todo", { minutes: 15 })], slots, now);
assert.deepEqual(
  blocks.map((b) => [b.stepId, b.start, b.end]),
  [
    ["a", "2026-11-02T17:30:00.000Z", "2026-11-02T17:40:00.000Z"],
    ["c", "2026-11-02T19:00:00.000Z", "2026-11-02T19:15:00.000Z"],
    ["d", "2026-11-03T16:00:00.000Z", "2026-11-03T16:15:00.000Z"],
  ],
);
assert.deepEqual(planBlocks([step("x", "todo", { minutes: 240 })], slots, now), [], "fits nowhere");
assert.equal(planBlocks([step("x", "done")], slots, now).length, 0);
// "Stop for now" offers tomorrow when tomorrow has room, else the earliest.
assert.equal(laterBlock(step("n", "todo"), slots, LA, now)?.start, "2026-11-03T16:00:00.000Z");
assert.equal(laterBlock(step("n", "todo"), slots.slice(0, 2), LA, now)?.start, "2026-11-02T17:30:00.000Z");
// 9 AM PST Nov 2 is 17:00Z.
assert.equal(slotLabel("2026-11-02T17:30:00.000Z", "2026-11-02T17:40:00.000Z", LA, now), "9:30–9:40 AM");
assert.equal(slotLabel("2026-11-03T19:55:00.000Z", "2026-11-03T20:05:00.000Z", LA, now), "tomorrow 11:55 AM–12:05 PM");
assert.equal(slotLabel("2026-11-05T17:30:00.000Z", "2026-11-05T17:40:00.000Z", LA, now), "Thu 9:30–9:40 AM");

// Warnings: a timed event starting within 10 minutes, never one already on or all day.
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
const events = [
  { title: "Birthday", start: "2026-11-02", end: "2026-11-03", allDay: true },
  { title: "Standup", start: at(-5), end: at(10), allDay: false },
  { title: "Bio lab", start: at(9), end: at(60), allDay: false },
];
assert.equal(soonEvent(events, now.getTime())?.title, "Bio lab");
assert.equal(soonEvent(events.slice(0, 2), now.getTime()), null);
assert.equal(soonEvent([{ ...events[2], start: at(11) }], now.getTime()), null);

// Streak words: milestones, a restart after a break without shame, the day's first and later Dones.
const progress = (over: Partial<Progress>): Progress => ({
  streak: 4,
  best: 9,
  week: ["done", "done", "today", "future", "future", "future", "future"],
  stepsThisWeek: 3,
  restDaysLeft: 1,
  atRisk: false,
  milestone: null,
  ...over,
});
const doneToday = progress({ week: ["done", "done", "done", "future", "future", "future", "future"] });
assert.equal(streakLine(progress({ stepsThisWeek: 1, streak: 1 })), "Day 1 · 1 step this week");
assert.equal(streakLine(doneToday), "Day 4 · 3 steps this week");
assert.equal(doneLine(progress({}), progress({ milestone: 7, streak: 7 }), true), "7 days in a row. That's a real habit now.");
assert.equal(doneLine(progress({ streak: 0 }), progress({ streak: 1, best: 9 }), true), "Day 1 again. Your best is 9.");
assert.equal(doneLine(progress({}), doneToday, true), "Nice. That's day 4. Next one's ready.");
assert.equal(doneLine(doneToday, doneToday, false), "Nice, another one down.");
assert.equal(doneLine(null, undefined, true), "Nice. Next one's ready.");
assert.equal(doneLine(null, progress({ streak: 1, best: 1 }), false), "Day 1. That's how it starts.");

// Memory groups in their order with plain names; device facts sit in their group; empty groups are left out.
const grouped = groupFacts([
  { id: "1", text: "Works at the library.", group: "routines", device: false },
  { id: "2", text: "Mornings feel foggy lately.", group: "about", device: true },
  { id: "3", text: "Likes 5-minute starts.", group: "work-style", device: false },
]);
assert.deepEqual(grouped.map((g) => g.name), ["About you", "Routines", "How you work best"]);
assert.equal(grouped[0].facts[0].device, true);
// Setup's summary leads with what helps plan (projects, routines, how you work); About you last; ties keep their order.
const fact = (id: string, group: string) => ({ id, text: id, group, device: false }) as Fact;
assert.deepEqual(
  flow.forPlanning([fact("a1", "about"), fact("p1", "people"), fact("r1", "routines"), fact("x", "nope"), fact("j1", "projects"), fact("w1", "work-style"), fact("i1", "interests"), fact("j2", "projects")]).map((f) => f.id),
  ["j1", "j2", "r1", "w1", "i1", "p1", "a1", "x"],
);

console.log("day-flow self-check passed");
