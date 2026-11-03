// Self-check for day-flow.ts, run like Vercel does, in UTC: TZ=UTC node src/components/day-flow.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { FirstPick, Goal, MemoryGroup, Progress, Step, TalkAction } from "@/lib/day";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const flow = await import("./day-flow.ts");
const { asks, cardSize, clock, dayPart, doneLine, draftGoal, dueLabel, foundLine, greeting, groupFacts, isEmailStep, isNotes, laterBlock, laterMinutes } = flow;
const { nextScreen, openSteps, pickFits, quickReplies, replanOnCanvas, slotLabel, soonEvent, stepCard, streakLine, withStatus } = flow;

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

// A new or changed plan shows as the card; a started step goes to focus; talk during focus keeps the timer's card.
const fresh = goal(step("1", "todo"), step("2", "todo"));
assert.equal(nextScreen("talk", acts("goal-set"), fresh), "ready");
assert.equal(nextScreen("focus", acts("roadmap-changed"), fresh), "ready");
assert.equal(nextScreen("ready", acts("step-started"), goal(step("1", "doing"))), "focus");
assert.equal(nextScreen("focus", acts("step-finished"), goal(step("1", "done"))), "checkin");
assert.equal(nextScreen("ready", [], null), "talk");
assert.equal(nextScreen("wrap", [], null), "talk");
assert.equal(nextScreen("checkin", [], fresh), "talk", "talking after Done leaves the Done screen");
assert.equal(nextScreen("focus", acts("remembered"), fresh), "focus");
assert.equal(nextScreen("talk", acts("goal-set"), goal(step("1", "done"))), "talk");
assert.equal(nextScreen("focus", acts("forgot"), goal(step("1", "done"))), "talk");
// The card for a plan made in talk is its first open step.
assert.deepEqual(stepCard({ ...goal(step("1", "done"), step("2", "todo", { minutes: null })), due: "2026-11-06" }), {
  goal: "Essay",
  due: "2026-11-06",
  stepId: "2",
  steps: [{ title: "Step 2", minutes: 5 }],
  why: "",
});
assert.equal(stepCard(goal(step("1", "done"))), null);
// After Done: the next step and its minutes, or the end of the plan.
assert.equal(doneLine(goal(step("1", "done"), step("2", "todo", { minutes: 15 }))), "Nice. Next: Step 2, 15 min");
assert.equal(doneLine(goal(step("1", "done"), step("2", "todo", { minutes: null }))), "Nice. Next: Step 2");
assert.equal(doneLine(goal(step("1", "done"))), "Nice work. That was the last step.");
// An email to write gets "Draft it in Gmail".
for (const title of [
  "Email Prof Patel about an extension", "E-mail the TA", "write to the registrar", "Reply to Dana", "Message the study group",
  "Draft an email to Prof Patel", "Ask Prof Patel for an extension by email", "Send Ana a quick email",
]) {
  assert.equal(isEmailStep(title), true, title);
}
for (const title of ["Read the email from Dana", "Emailing list cleanup", "Draft the methods section", "Messages"]) assert.equal(isEmailStep(title), false, title);

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

// Connect Canvas re-plans the home card only when it found work still due; Disconnect (unlinked, []) always does, so the
// card drops a Canvas pick; neither touches any other screen.
const due = { submitted: false };
assert.equal(replanOnCanvas("ready", true, [{ submitted: true }, due]), true);
assert.equal(replanOnCanvas("ready", true, [{ submitted: true }]), false, "all of it handed in");
assert.equal(replanOnCanvas("ready", true, []), false, "nothing in the next 2 weeks");
assert.equal(replanOnCanvas("ready", false, []), true, "a Disconnect");
for (const screen of ["focus", "checkin", "talk", "wrap", "setup", null] as const) {
  assert.equal(replanOnCanvas(screen, true, [due]), false, String(screen));
  assert.equal(replanOnCanvas(screen, false, []), false, `${screen}, disconnected`);
}

// A new plan shows at once, step 1 running.
const now = new Date("2026-11-02T17:00:00Z");
const draft = draftGoal(pickNew, now);
assert.deepEqual(draft.steps.map((s) => [s.status, s.startedAt]), [["doing", now.toISOString()], ["todo", null]]);
// Starting one step puts any other running one back to todo, as the server does.
const started = withStatus(goal(step("1", "doing", { startedAt: "x" }), step("2", "todo")), "2", "doing", now);
assert.deepEqual(started.steps.map((s) => s.status), ["todo", "doing"]);
assert.equal(started.steps[1].startedAt, now.toISOString());
assert.equal(withStatus(goal(step("1", "doing")), "1", "done", now).steps[0].doneAt, now.toISOString());

assert.equal(dueLabel("2026-11-02", "2026-11-02"), "due today");
assert.equal(dueLabel("2026-11-03", "2026-11-02"), "due tomorrow");
assert.equal(dueLabel("2026-11-06", "2026-11-02"), "due Friday");
assert.equal(dueLabel("2026-11-06", ""), "", "no date before the browser's clock");
assert.equal(dueLabel("2026-11-20", "2026-11-02"), "due Nov 20");
assert.equal(dueLabel("2026-10-30", "2026-11-02"), "was due Oct 30");

// Stopping offers a block only for an hour or more left, at most two hours, never when the plan is already booked.
const big = goal(step("1", "done"), step("2", "doing", { minutes: 30 }), step("3", "todo", { minutes: 20 }), step("4", "todo", { minutes: null }));
assert.equal(laterMinutes(big), 60, "a step without minutes counts as 10");
assert.equal(laterMinutes(goal(step("1", "todo", { minutes: 50 }))), 0, "small next steps are never offered");
assert.equal(laterMinutes(goal(step("1", "todo", { minutes: 90 }), step("2", "todo", { minutes: 90 }))), 120);
assert.equal(laterMinutes(goal(step("1", "todo", { minutes: 90, scheduledAt: "2026-11-03T16:00:00Z" }))), 0);
assert.equal(laterMinutes(null), 0);
// The block: tomorrow's earliest room that fits, on a 5-minute start, linked to the first open step and named as it is
// saved, so the calendar and tomorrow's card say the same thing (Vi, Nov 2).
const LA = "America/Los_Angeles";
const slots = [
  { start: "2026-11-02T17:10:00Z", end: "2026-11-02T19:50:00Z" },
  { start: "2026-11-03T15:02:00Z", end: "2026-11-03T16:00:00Z" },
  { start: "2026-11-03T16:02:00Z", end: "2026-11-03T18:00:00Z" },
  { start: "2026-11-04T16:00:00Z", end: "2026-11-04T19:00:00Z" },
];
assert.deepEqual(laterBlock(big, 60, slots, LA, now), {
  title: "Step 2",
  kind: "step",
  start: "2026-11-03T16:05:00.000Z",
  end: "2026-11-03T17:05:00.000Z",
  stepId: "2",
});
assert.equal(laterBlock(big, 120, slots, LA, now), null, "no room tomorrow: nothing today or the day after");
assert.equal(laterBlock(big, 60, slots.slice(0, 1), LA, now), null);
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

// The streak row's words.
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
assert.equal(streakLine(progress({ stepsThisWeek: 1, streak: 1 })), "Day 1 · 1 step this week");
assert.equal(streakLine(progress({})), "Day 4 · 3 steps this week");

// Memory groups in their order with plain names; device facts sit in their group; empty groups are left out.
const grouped = groupFacts([
  { id: "1", text: "Works at the library.", group: "routines", device: false },
  { id: "2", text: "Mornings feel foggy lately.", group: "about", device: true },
  { id: "3", text: "Likes 5-minute starts.", group: "work-style", device: false },
]);
assert.deepEqual(grouped.map((g) => g.name), ["About you", "Routines", "How you work best"]);
assert.equal(grouped[0].facts[0].device, true);

// First sign-in says what the scan found, counting the projects facts that name a day as deadlines; nothing found says so.
const found = (...groups: MemoryGroup[]) =>
  groups.map((group) => ({ group, text: group === "projects" ? "Has the BIO 121 lab report due November 6." : "Is a junior biology major." }));
assert.equal(
  foundLine(found("routines", "projects", "projects", "about", "routines", "people", "projects", "work-style", "interests")),
  "I read your calendar and email and learned 9 things, including 3 deadlines.",
);
assert.equal(foundLine(found("projects")), "I read your calendar and email and learned 1 thing, including 1 deadline.");
assert.equal(foundLine(found("routines", "about")), "I read your calendar and email and learned 2 things.");
assert.equal(
  foundLine([{ group: "projects", text: "Is building a portfolio site with Jess." }, { group: "projects", text: "Has Midterm 2 on Nov 18." }]),
  "I read your calendar and email and learned 2 things, including 1 deadline.",
  "an undated project is no deadline",
);
assert.equal(foundLine([]), "I couldn't find much yet. I'll learn as you go.");

// Memory's Add box: one line is one memory; a line break or more than 200 characters is pasted notes.
assert.equal(isNotes("Works library shifts on Saturdays."), false);
assert.equal(isNotes("x".repeat(200)), false);
assert.equal(isNotes("📚".repeat(200)), false, "200 characters as /api/memory counts them, not UTF-16 units");
assert.equal(isNotes("x".repeat(201)), true);
assert.equal(isNotes("BIO 120 syllabus\nLab report due Nov 6"), true);

console.log("day-flow self-check passed");
