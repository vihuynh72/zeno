// Self-check for day-flow.ts, run like Vercel does, in UTC: TZ=UTC node src/components/day-flow.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { DayEmail, Goal, MemoryGroup, Progress, Step, TalkAction } from "@/lib/day";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const flow = await import("./day-flow.ts");
const { addHeard, asks, canvasFor, cardSize, checkinMinute, clock, dayPart, doneLine, dueLabel, FOCUS, foundLine, greeting, groupFacts } = flow;
const { isEmailStep, isNotes, laterBlock, laterMinutes, nextScreen, openingReusable, openingSig, openSteps, quickReplies } = flow;
const { replanOnCanvas, slotLabel, soonEvent, streakLine, withStatus } = flow;
const { addedStep, barCaption, duration, followPlan, goalRow, mailPlan, namedStep, nextProposal, openPlans, proposedStep, realMinutes, resumePlan, runningStep } = flow;
const { sameTitle, spoken, stoppedLine, todayLine, untilNext } = flow;
const { asksBig, extraReplies, goalLine, isResearchStep, keepClock, nextFewLine, splitLater } = flow;

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

// The home's hello (Vi, Nov 3), by the hour: still the night before until 5 AM.
assert.equal(greeting(9, "Maya"), "Morning, Maya.");
assert.equal(greeting(11, null), "Morning.");
assert.equal(greeting(12, "Maya"), "Hey Maya.");
assert.equal(greeting(16, null), "Hey.");
assert.equal(greeting(17, "Maya"), "Evening, Maya.");
assert.equal(greeting(23, null), "Evening.");
assert.equal(greeting(1, "Maya"), "Still up, Maya?");
assert.equal(greeting(4, null), "Still up?");
assert.equal(greeting(5, null), "Morning.");

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
// A change to the steps after a running one keeps Focus and its clock (live, Nov 3: the timer stopped); a running step
// that went back in line for the change (Make it smaller) leaves Focus for the card.
const runningPlan = goal(step("1", "doing", { startedAt: "2026-11-03T17:00:00Z" }), step("2", "todo"));
assert.equal(nextScreen("focus", acts("roadmap-changed"), runningPlan), "focus");
assert.equal(nextScreen("focus", acts("step-finished"), goal(step("1", "done"), step("2", "doing"))), "checkin");
assert.equal(nextScreen("ready", acts("roadmap-changed"), runningPlan), "ready", "only Focus holds on");
// On a goal's desk a plain reply keeps the step card, with Zeno's line under it (Nov 4); with nothing open, talk.
assert.equal(nextScreen("ready", [], fresh, true), "ready");
assert.equal(nextScreen("ready", acts("remembered"), fresh, true), "ready");
assert.equal(nextScreen("ready", [], goal(step("1", "done")), true), "talk");
assert.equal(nextScreen("ready", [], fresh), "talk", "the home's card still turns into talk");
assert.equal(nextScreen("focus", [], fresh, true), "focus");
// After Done: the next step and its minutes, or the end of the plan.
assert.equal(doneLine(goal(step("1", "done"), step("2", "todo", { minutes: 15 }))), "Nice. Next: Step 2, 15 min.");
assert.equal(doneLine(goal(step("1", "done"), step("2", "todo", { minutes: null }))), "Nice. Next: Step 2.");
assert.equal(doneLine(goal(step("1", "done"), step("2", "todo", { title: "Read it out loud.", minutes: null }))), "Nice. Next: Read it out loud.");
assert.equal(doneLine(goal(step("1", "done"))), "That's all of Essay.");
assert.equal(doneLine({ ...goal(step("1", "done")), title: "Lab report!" }), "That's all of Lab report.");
// A skip is never praised as a Done.
assert.equal(doneLine(goal(step("1", "skipped"), step("2", "todo", { minutes: 15 })), true), "Skipped. Next: Step 2, 15 min.");
assert.equal(doneLine(goal(step("1", "skipped")), true), "Skipped. That's all of Essay.");
// A goal that keeps going is never "all of" it: its next few are being planned.
const runs = { ...goal(step("1", "done"), step("2", "done")), title: "Run a 5K", rhythm: "3 runs a week" };
assert.equal(doneLine(runs), "Nice. Planning your next few…");
assert.equal(doneLine(runs, true), "Skipped. Planning your next few…");
assert.equal(doneLine({ ...runs, rhythm: null }), "That's all of Run a 5K.");
assert.equal(doneLine({ ...runs, steps: [...runs.steps, step("3", "todo", { title: "Run 20 min easy", minutes: 20 })] }), "Nice. Next: Run 20 min easy, 20 min.");
// Its next few: the next one named, the rest counted.
const more = (...titles: string[]) => ({ ...runs, steps: [...runs.steps, ...titles.map((title, i) => step(`n${i}`, "todo", { title }))] });
assert.equal(nextFewLine(runs, more("Run 20 min easy.")), "Planned your next few: Run 20 min easy.");
assert.equal(nextFewLine(runs, more("Run 1 min, walk 1 min, 6 rounds", "Rest day stretch")), "Planned your next few: Run 1 min, walk 1 min, 6 rounds, then 1 more.");
assert.equal(nextFewLine(runs, more("A", "B", "C")), "Planned your next few: A, then 2 more.");
assert.equal(nextFewLine(runs, runs), "Planned your next few.");
// Said aloud, the minutes and hours are words.
assert.equal(spoken("Nice. Next: Step 2, 15 min."), "Nice. Next: Step 2, 15 minutes.");
assert.equal(spoken("Next: Step 2, 1 min. You have 1 h 25 min until BIO 101."), "Next: Step 2, 1 minute. You have 1 hour 25 minutes until BIO 101.");
assert.equal(spoken("You have 2 h until CS 146. Today: 2 steps, 41 min."), "You have 2 hours until CS 146. Today: 2 steps, 41 minutes.");
assert.equal(spoken("Read the 11 min-max notes"), "Read the 11 min-max notes", "only a count of minutes");
// An email to write gets "Draft it in Gmail".
for (const title of [
  "Email Prof Patel about an extension", "E-mail the TA", "write to the registrar", "Reply to Dana", "Message the study group",
  "Draft an email to Prof Patel", "Ask Prof Patel for an extension by email", "Send Ana a quick email",
  // An asking email's plan (mailPlan) gets it too.
  mailPlan({ from: "Prof. Lin <lin@school.edu>", subject: "Office hours?", snippet: "", unread: true }).steps[0].title,
  mailPlan(null).steps[0].title,
  // And a follow-up for mail nobody answered (followPlan, Nov 4).
  followPlan('"Patel, Ana" <ana@school.edu>', "Lab 3 slides").steps[0].title,
]) {
  assert.equal(isEmailStep(title), true, title);
}
assert.deepEqual(followPlan('"Patel, Ana" <ana@school.edu>', "Lab 3 slides"), {
  title: "Follow up with Patel, Ana",
  steps: [{ title: "Email Patel, Ana to follow up on Lab 3 slides", minutes: 2 }],
});
assert.deepEqual(followPlan("dana@school.edu", "").steps, [{ title: "Email dana to follow up", minutes: 2 }]);
for (const title of ["Read the email from Dana", "Emailing list cleanup", "Draft the methods section", "Messages"]) assert.equal(isEmailStep(title), false, title);
// Helpful links are laid out for a step that reads or looks things up, never for a run or a reply.
for (const title of ["Find two course readings with page numbers", "Look up Etsy fees", "Research venues near home", "Read chapter 3", "Find examples of toasts", "Compare 3 album sizes"]) {
  assert.equal(isResearchStep(title), true, title);
}
for (const title of ["Put shoes out", "Reply to landlord", "Pick 20 favorite phone photos", "Jot 3 quick brother memories", "Spread the figures out"]) {
  assert.equal(isResearchStep(title), false, title);
}

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
// On a step's screen Zeno's answers never repeat its own Start, Done, Stop for now or Stuck?, or only put it off
// (live, Nov 3: "Start now" reset a timer, "Done sorting" was a second Done).
assert.deepEqual(
  extraReplies(["Start now", "Not now", "Done", "Done sorting", "Stop for now", "Yes, let's go!", "I'm stuck", "Need help", "Maybe later", "Finished it"]),
  [],
);
assert.deepEqual(extraReplies(["Found one", "TikTok", "Yes", "Help me pick one", "Later tonight", "Skip it"]), ["Found one", "TikTok", "Yes", "Help me pick one", "Later tonight", "Skip it"]);
assert.deepEqual(extraReplies(["Start with the intro", "OK, start", "Okay"]), ["Start with the intro", "Okay"], "a choice that begins with start stays");
// The big button is the yes ("Done?" in Focus, "Start now?" on the desk): a bare yes would be a second one (Nov 4).
assert.equal(asksBig("Nice paragraph. Done?", true), true);
assert.equal(asksBig("Done. Friday is the line. Find the number next. Start now?", false), true);
assert.equal(asksBig("Want me to add a step for the playlist?", false), false);
assert.equal(asksBig("Start with the intro. It's short.", false), false, "no question");
assert.equal(asksBig("Ready to start?", true), false, "Focus's big button is Done");
assert.equal(asksBig("Ready to start?", false), true);
assert.equal(asksBig("Looks good. All done?", true), true);
// A question about more than the button keeps its yes (review, Nov 4).
assert.equal(asksBig("Want me to split it so it is easier to get done?", true), false);
assert.equal(asksBig("Want to start with the outline instead?", false), false);
assert.equal(asksBig("Want a 2-minute piece before you start?", false), false);
assert.deepEqual(extraReplies(["Yes", "Not yet", "One more paragraph"], true), ["One more paragraph"]);
assert.deepEqual(extraReplies(["I'm finished", "Mark it done", "Let's begin", "Start over", "Restart"]), []);

// Hands-free listens only after a question.
assert.equal(asks("Want to start the outline?"), true);
assert.equal(asks('Ready for "the next one?"'), true);
assert.equal(asks("Planned 5 min. I'll stay quiet."), false);
assert.equal(asks("Done? Nice work."), false);

assert.equal(cardSize("Good afternoon, Vi."), "l");
assert.equal(cardSize("x".repeat(120)), "m");
assert.equal(cardSize("x".repeat(200)), "s");
// The stopwatch counts up in whole seconds, past the hour as minutes.
assert.equal(clock(0), "0:00");
assert.equal(clock(65.9), "1:05");
assert.equal(clock(4503), "75:03");
assert.equal(clock(-0.7), "0:00", "a start a moment ahead of the clock");

// Focus's one check-in: the planned minutes at the person's pace, never under 3; 1 when the pace is unknown or junk.
assert.equal(checkinMinute(15), 15);
assert.equal(checkinMinute(15, 1.3), 20, "19.5 rounds up");
assert.equal(checkinMinute(10, 0.75), 8);
assert.equal(checkinMinute(2), 3);
assert.equal(checkinMinute(5, 0.75), 4);
assert.equal(checkinMinute(3, 0.75), 3, "never under 3");
for (const junk of [NaN, 0, -1, Infinity]) assert.equal(checkinMinute(15, junk), 15, String(junk));
// The line under the card by state: calm (the card shows the planned minutes), the check-in at its moment, welcome back.
assert.equal(FOCUS.calm, "I'll stay quiet.");
assert.equal(FOCUS.checkin(15), "15 min in. Finish the line you're on, then Done.");
assert.equal(FOCUS.checkin(16), "16 min in. Wrap up this bit, then Done.");
assert.equal(FOCUS.checkin(20), "20 min in. Get it to a stopping point, then Done.");
assert.equal(FOCUS.checkin(checkinMinute(15, 1.3)), FOCUS.checkin(20), "the same step always gets the same line");
const startedAt = "2026-11-03T17:00:00.000Z";
assert.equal(FOCUS.back(startedAt, Date.parse(startedAt) + 23.9 * 60_000), "Back. 23 min on this.");
assert.equal(FOCUS.back(startedAt, Date.parse(startedAt) + 125 * 60_000), "Back. 125 min on this.");
for (const line of [FOCUS.calm, FOCUS.checkin(15), FOCUS.back(startedAt, Date.parse(startedAt))]) assert.equal(asks(line), false, line);

// A saved model opening shows again on load, with no model call, while under 20 minutes old and its day is unchanged:
// the plan's id, each step's id, status, title and minutes, and the Canvas list's assignments and due times.
const plan = { ...goal(step("1", "done"), step("2", "todo")), due: "2026-11-06" };
const list = [{ id: "c1", due: "2026-11-06T06:59:00Z" }, { id: "c2", due: null }];
const sig = openingSig(plan, list);
const at0 = Date.parse("2026-11-03T17:00:00Z");
assert.equal(openingSig(structuredClone(plan), structuredClone(list)), sig, "the same day");
assert.equal(openingSig({ ...plan, title: "Renamed", due: null }, list), sig, "the goal's own title and due date don't count");
for (const [changed, why] of [
  [openingSig(withStatus(plan, "2", "doing", new Date(at0)), list), "a Start"],
  [openingSig(withStatus(plan, "2", "done", new Date(at0)), list), "a Done"],
  [openingSig({ ...plan, id: "g2" }, list), "another plan"],
  [openingSig({ ...plan, steps: [...plan.steps, step("3", "todo")] }, list), "a step added"],
  [openingSig({ ...plan, steps: plan.steps.slice(0, 1) }, list), "a step removed"],
  // "Make it smaller" in talk keeps the step's id (replaceRemainingSteps) but not its title or minutes.
  [openingSig({ ...plan, steps: [plan.steps[0], { ...plan.steps[1], title: "Try three practice limits" }] }, list), "a step reworded"],
  [openingSig({ ...plan, steps: [plan.steps[0], { ...plan.steps[1], minutes: 5 }] }, list), "a step made shorter"],
  [openingSig(null, list), "no plan"],
  [openingSig(plan, null), "Canvas disconnected"],
  [openingSig(plan, []), "nothing due on Canvas"],
  [openingSig(plan, [...list, { id: "c3", due: null }]), "a new assignment"],
  [openingSig(plan, [{ ...list[0], due: "2026-11-07T06:59:00Z" }, list[1]]), "a moved due date"],
] as const) {
  assert.notEqual(changed, sig, why);
}
const opening = { at: new Date(at0).toISOString(), sig };
assert.equal(openingReusable(opening, sig, at0 + 19 * 60_000, []), true);
assert.equal(openingReusable(opening, sig, at0 + 20 * 60_000, []), false, "20 minutes old");
assert.equal(openingReusable(opening, openingSig(plan, null), at0, []), false, "the day changed");
// Submitted on Canvas since: this load's sync drops it from the list, so the opening that offered it is asked for again.
assert.equal(openingReusable(opening, openingSig(plan, list.slice(1)), at0 + 15 * 60_000, []), false, "submitted since");
assert.equal(openingReusable(opening, sig, at0 - 60_000, []), false, "saved in the future: the clock moved");
assert.equal(openingReusable({ sig }, sig, at0, []), false, "saved before it had a time");
assert.equal(openingReusable({ at: opening.at }, sig, at0, []), false, "saved before it had a signature");
assert.equal(openingReusable(null, sig, at0, []), false);
// Written at 9:00 (at0) and read at 9:18: an event that began or ended in between makes it stale; one still to come, one
// already on before it was written, or an all-day one doesn't.
const event = (start: number, end: number, allDay = false) => ({ title: "CS 146", start: new Date(at0 + start * 60_000).toISOString(), end: new Date(at0 + end * 60_000).toISOString(), allDay });
assert.equal(openingReusable(opening, sig, at0 + 18 * 60_000, [event(15, 90)]), false, "the lecture began");
assert.equal(openingReusable(opening, sig, at0 + 18 * 60_000, [event(-60, 10)]), false, "the lecture ended");
assert.equal(openingReusable(opening, sig, at0 + 18 * 60_000, [event(30, 90), event(-30, 60), event(5, 6, true)]), true);
assert.equal(openingReusable(opening, sig, at0 + 18 * 60_000, [event(18, 90)]), false, "beginning right now");

// The pattern ids an opening named join this device's heard list once, newest last, the last 20 kept.
assert.deepEqual(addHeard(["a", "b"], ["c"]), ["a", "b", "c"]);
assert.deepEqual(addHeard(["a", "b"], ["a"]), ["b", "a"], "said again: moves to the end, never twice");
assert.deepEqual(addHeard(["a"], undefined), ["a"]);
assert.deepEqual(addHeard([], ["a", 7, null, "b"]), ["a", "b"], "storage or a reply can hold anything");
assert.deepEqual(addHeard([], "a"), []);
const many = Array.from({ length: 20 }, (_, i) => `p${i}`);
assert.deepEqual(addHeard(many, ["new"]), [...many.slice(1), "new"]);

// The Canvas item a plan is for: its title holds the item's as whole words, any case; an empty title never matches.
const items = [{ title: " ", url: "a" }, { title: "Essay 2", url: "b" }, { title: "Quiz 4 (Ch. 4)", url: "c" }];
assert.equal(canvasFor({ ...plan, title: "HIST 110: essay 2" }, items)?.url, "b");
assert.equal(canvasFor({ ...plan, title: "Study for Quiz 4 (Ch. 4)" }, items)?.url, "c");
assert.equal(canvasFor({ ...plan, title: "Quiz 4 (Ch. 4): the first five" }, items)?.url, "c");
assert.equal(canvasFor({ ...plan, title: "Lab report" }, items), undefined);
assert.equal(canvasFor({ ...plan, title: "Essay 20 outline" }, items), undefined, "not part of a longer number");
assert.equal(canvasFor(null, items), undefined);
// Never inside another word: "Lab" in "syllabus", "Exam" in "example".
assert.equal(canvasFor({ ...plan, title: "Read the syllabus" }, [{ course: "BIO 101", title: "Lab", url: "lab" }]), undefined);
assert.equal(canvasFor({ ...plan, title: "Work the example problems" }, [{ course: "CS 47", title: "Exam 2", url: "exam" }]), undefined);
// A title kept as its bare kind ("Quiz") never takes a plan for another quiz; the plan's course decides between equals.
const quizzes = [
  { course: "BIO 101", title: "Quiz", url: "bio" },
  { course: "CS 146", title: "Quiz 7 (Ch. 7)", url: "cs" },
  { course: "HIST 110", title: "Reading response 7", url: "hist" },
  { course: "ENGL 1A", title: "Reading response 7", url: "engl" },
];
assert.equal(canvasFor({ ...plan, title: "CS 146: Quiz 7 (Ch. 7)" }, quizzes)?.url, "cs");
assert.equal(canvasFor({ ...plan, title: "Quiz 7 (Ch. 7)" }, quizzes)?.url, "cs");
assert.equal(canvasFor({ ...plan, title: "BIO 101: Quiz" }, quizzes)?.url, "bio");
assert.equal(canvasFor({ ...plan, title: "ENGL 1A: Reading response 7" }, quizzes)?.url, "engl");
assert.equal(canvasFor({ ...plan, title: "Reading response 7" }, quizzes)?.url, "hist", "the sooner one when nothing else tells");
assert.equal(quizzes[0].url, "bio", "the list keeps its order");
// A bare "Quiz" links only a plan that names its course: never another course's quiz that isn't on Canvas.
assert.equal(canvasFor({ ...plan, title: "CS 47: Quiz 3 prep" }, quizzes), undefined);
assert.equal(canvasFor({ ...plan, title: "Quiz review" }, quizzes), undefined);

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

const now = new Date("2026-11-02T17:00:00Z");
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
assert.equal(dueLabel("2026-11-06", "2026-11-02", "short"), "due Fri", "the option cards' short weekday");
assert.equal(dueLabel("2026-11-20", "2026-11-02", "short"), "due Nov 20");

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

// Warnings: a timed event starting within 10 minutes, never one already on, all day or booked by Zeno.
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
const events = [
  { title: "Birthday", start: "2026-11-02", end: "2026-11-03", allDay: true },
  { title: "Standup", start: at(-5), end: at(10), allDay: false },
  { title: "CS 146 exam prep", start: at(5), end: at(60), allDay: false, zeno: true },
  { title: "Bio lab", start: at(9), end: at(60), allDay: false },
];
assert.equal(soonEvent(events, now.getTime())?.title, "Bio lab");
assert.equal(soonEvent(events.slice(0, 3), now.getTime()), null);
assert.equal(soonEvent([{ ...events[3], start: at(11) }], now.getTime()), null);

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
assert.equal(foundLine([]), "Nothing to read yet, so let's start with what you want to do.", "no apology on a first run (Nov 4)");

// Memory's Add box: one line is one memory; a line break or more than 200 characters is pasted notes.
assert.equal(isNotes("Works library shifts on Saturdays."), false);
assert.equal(isNotes("x".repeat(200)), false);
assert.equal(isNotes("📚".repeat(200)), false, "200 characters as /api/memory counts them, not UTF-16 units");
assert.equal(isNotes("x".repeat(201)), true);
assert.equal(isNotes("BIO 120 syllabus\nLab report due Nov 6"), true);

// ---------- The home and a goal's desk (Vi, Nov 3) ----------
// Titles match as lowercase words with punctuation as spaces, when either holds the other.
assert.equal(sameTitle("HIST 110: Essay 2", "essay 2"), true);
assert.equal(sameTitle("SOC-15 Field report #2", "soc 15: field report 2"), true);
assert.equal(sameTitle("Lab report", "Essay 2"), false);
assert.equal(sameTitle("!!!", "Essay"), false, "a title of only symbols matches nothing");

// Plans for the open-plans list and an asking email for its reply plan.
const hToday = "2026-11-02"; // a Monday
const mk = (id: string, title: string, due: string | null, ...steps: Step[]): Goal => ({ id, title, due, steps });
const current = mk("p1", "SOC 15: Field report", "2026-11-06", step("a", "done"), step("b", "todo", { title: "Outline the findings", minutes: 10 }));
const other = mk("p2", "Essay 2", "2026-11-04", step("c", "todo", { title: "Read the prompt", minutes: 5 }));
const undated = mk("p3", "Portfolio site", null, step("d", "todo"));
const finished = mk("p4", "Lab 5", "2026-11-03", step("e", "done"));
const asking: DayEmail = { from: "Prof. Lin <lin@school.edu>", subject: "Does Wednesday at 2 work?", snippet: "", unread: true, id: "m1", address: "lin@school.edu", asks: true };
const plans = [other, undated, finished, current];
// The Desk's Goals: the same open plans, the current one first.
assert.deepEqual(openPlans(current, plans).map((plan) => plan.id), ["p1", "p2", "p3"]);
assert.deepEqual(openPlans(finished, [undated]).map((plan) => plan.id), ["p3"]);
assert.deepEqual(openPlans(null, []), []);
// A goal that keeps going stays listed with no session left (its next few are planned when it opens), and says so.
const rolling = { ...finished, id: "p5", rhythm: "3 runs a week" };
assert.deepEqual(openPlans(rolling, [finished]).map((plan) => plan.id), ["p5"]);
assert.equal(goalRow(rolling, hToday).line, "Next: plan your next few");
assert.equal(goalRow(finished, hToday).line, "");

// An asking email's plan: one 2-minute reply; a long subject is cut at a word, within 40 characters.
assert.deepEqual(mailPlan(asking), { title: "Answer Prof. Lin", steps: [{ title: "Reply to Prof. Lin about Does Wednesday at 2 work?", minutes: 2 }] });
const long = mailPlan({ ...asking, subject: "Meeting time for office hours next week and the week after" }).steps[0].title;
assert.equal(long, "Reply to Prof. Lin about Meeting time for office hours next week");
assert.equal(mailPlan({ ...asking, subject: "x".repeat(60) }).steps[0].title, `Reply to Prof. Lin about ${"x".repeat(40)}`);
assert.equal(mailPlan({ ...asking, subject: "  " }).steps[0].title, "Reply to Prof. Lin");
assert.equal(mailPlan({ ...asking, from: "dana@school.edu" }).title, "Answer dana", "a title never holds an address");
assert.equal(mailPlan({ ...asking, from: "<registrar@school.edu>" }).steps[0].title, "Reply to registrar about Does Wednesday at 2 work?");
assert.deepEqual(mailPlan(null), { title: "Answer an email", steps: [{ title: "Reply to the email", minutes: 2 }] });

// Coming back: her last goal, unless another of hers is due within 2 days and sooner; a never-started goal says Start here.
{
  const paper = mk("pp", "PHIL 134 paper", "2026-11-04", step("p1", "done"), step("p2", "todo", { title: "Outline", minutes: 15 }));
  const exam = mk("ex", "CS 146 exam", "2026-11-12", step("e1", "todo", { title: "List topics", minutes: 5 }));
  const run = mk("rn", "Run a 5K", null, step("r1", "todo"));
  const back = (current: Goal | null, list: Goal[], left: string | null = null) => {
    const found = resumePlan(current, list, hToday, left);
    return found && [found.plan.id, found.step.id, found.started];
  };
  assert.deepEqual(back(exam, [paper, exam]), ["pp", "p2", true], "the paper due in 2 days leads the exam she last opened");
  assert.deepEqual(back(exam, [exam, run]), ["ex", "e1", false], "nothing urgent: her last goal, never started");
  assert.deepEqual(back(run, [run, exam]), ["rn", "r1", false]);
  assert.equal(back(paper, [paper, exam], "pp"), null, "never the goal she just left: she picks another on the left");
  assert.equal(back(null, []), null);
  assert.deepEqual(back(null, [exam, paper]), ["pp", "p2", true], "no current goal: the urgent one");
  assert.equal(back(null, [exam]), null, "no current goal and nothing urgent: pick on the left");
}

// The step Zeno's last sentence names leads, so the line and the big button agree (round 5).
{
  const shop = mk("sh", "Open my Etsy shop", null, step("k1", "todo", { title: "Set shop policies" }), step("k2", "todo", { title: "List the 10 products" }), step("k3", "done", { title: "Pick a shop name" }));
  assert.equal(namedStep("Digital it is. Start with List the 10 products?", shop)?.id, "k2");
  assert.equal(namedStep("Start with list the 10 products!", shop)?.id, "k2", "any case and punctuation");
  assert.equal(namedStep("List the 10 products comes later. Ready?", shop), null, "only the last sentence");
  assert.equal(namedStep("Pick a shop name again?", shop), null, "a done step never leads");
  assert.equal(namedStep("Start now?", shop), null);
}

// The desk proposes the first open step, or the one she tapped; Another step goes round the open ones.
const desk = goal(step("1", "done"), step("2", "todo"), step("3", "todo"), step("4", "skipped"), step("5", "todo"));
assert.equal(proposedStep(desk, null)?.id, "2");
assert.equal(proposedStep(desk, "3")?.id, "3");
assert.equal(proposedStep(desk, "1")?.id, "2", "a done step is never proposed");
assert.equal(proposedStep(null, null), null);
assert.equal(nextProposal(desk, null), "3");
assert.equal(nextProposal(desk, "3"), "5");
assert.equal(nextProposal(desk, "5"), "2", "round again");
assert.equal(nextProposal(desk, "gone"), "3");
assert.equal(nextProposal(goal(step("1", "todo")), "1"), "1");
assert.equal(nextProposal(goal(step("1", "done")), null), null);
// Something smaller: the plan's first new step is proposed.
const smaller = { ...desk, steps: [desk.steps[0], step("n1", "todo"), step("n2", "todo"), ...desk.steps.slice(2)] };
assert.equal(addedStep(desk, smaller), "n1");
assert.equal(addedStep(desk, desk), null);
assert.equal(addedStep(null, desk), "2", "a new plan: its first step");
// The step renamed into the small piece is proposed, never the bigger rest added after it (live, Nov 3: Dana).
const renamed = { ...desk, steps: [desk.steps[0], step("2", "todo", { title: "Pick one story angle", minutes: 3 }), step("n9", "todo"), ...desk.steps.slice(2)] };
assert.equal(addedStep(desk, renamed), "2");
// A step that was running and went back in line for the change is not new: the piece Zeno added before it is.
const running = goal(step("1", "done"), step("2", "doing", { startedAt: "2026-11-03T17:00:00Z" }), step("3", "todo"));
assert.equal(addedStep(running, goal(step("1", "done"), step("p", "todo", { minutes: 3 }), step("2", "todo"), step("3", "todo"))), "p");

// The steps list: done ones and the next 5 open ones; the rest under Later (N), unless the marked one is further on.
const tall = goal(step("d", "done"), ...["a", "b", "c", "e", "f", "g", "h"].map((id) => step(id, "todo")));
assert.deepEqual(splitLater(tall.steps).shown.map((s) => s.id), ["d", "a", "b", "c", "e", "f"]);
assert.equal(splitLater(tall.steps).later, 2);
assert.deepEqual(splitLater(tall.steps, "g").shown.map((s) => s.id), ["d", "a", "b", "c", "e", "f", "g"], "the marked step stays in view");
assert.equal(splitLater(tall.steps, "g").later, 1);
assert.equal(splitLater(desk.steps).later, 0);
assert.deepEqual(splitLater(desk.steps).shown, desk.steps);

// Nothing resets a running clock: the same running step keeps its earlier start, whatever a save answers.
const t9 = "2026-11-03T17:00:00.000Z";
const later = "2026-11-03T17:04:12.000Z";
const kept = keepClock(goal(step("1", "doing", { startedAt: t9 })), goal(step("1", "doing", { startedAt: later }), step("2", "todo")));
assert.equal(kept?.steps[0].startedAt, t9);
assert.equal(kept?.steps[1].status, "todo");
const moved = goal(step("2", "doing", { startedAt: later }));
assert.equal(keepClock(goal(step("1", "doing", { startedAt: t9 })), moved), moved, "another step starts its own clock");
assert.equal(keepClock(goal(step("1", "todo")), moved), moved, "a step started fresh");
const sooner = goal(step("2", "doing", { startedAt: t9 }));
assert.equal(keepClock(goal(step("2", "doing", { startedAt: later })), sooner), sooner, "an earlier start wins either way");
assert.equal(keepClock(goal(step("2", "doing", { startedAt: t9 })), null), null);
// A step left running yesterday and started again opens fresh: the old start is kept only within one run (3 h).
const yesterday = "2026-11-02T20:00:00.000Z";
const restarted = goal(step("1", "doing", { startedAt: t9 }));
assert.equal(keepClock(goal(step("1", "doing", { startedAt: yesterday })), restarted), restarted, "a stale start never stays");

// A step still running when the page opens goes to Focus, unless it was left 3 hours ago or more.
const t0 = Date.parse("2026-11-03T17:00:00Z");
const run = (minutes: number) => goal(step("1", "done"), step("2", "doing", { startedAt: new Date(t0 - minutes * 60_000).toISOString() }));
assert.equal(runningStep(run(20), t0)?.id, "2");
assert.equal(runningStep(run(179), t0)?.id, "2");
assert.equal(runningStep(run(180), t0), null, "left running 3 hours ago");
assert.equal(runningStep(run(-5), t0), null, "started in the future: the clock moved");
assert.equal(runningStep(goal(step("1", "doing")), t0), null, "no start time");
assert.equal(runningStep(goal(step("1", "todo")), t0), null);

// Real minutes and how long, said short.
assert.equal(realMinutes(step("1", "done", { startedAt: "2026-11-03T17:00:00Z", doneAt: "2026-11-03T17:12:20Z" })), 12);
assert.equal(realMinutes(step("1", "done", { startedAt: "2026-11-03T17:00:00Z", doneAt: "2026-11-03T17:00:10Z" })), 1, "never 0");
assert.equal(realMinutes(step("1", "done", { doneAt: "2026-11-03T17:00:00Z" })), null);
assert.equal(realMinutes(step("1", "done", { startedAt: "2026-11-03T17:00:00Z", doneAt: "2026-11-03T16:00:00Z" })), null);
assert.equal(duration(45), "45 min");
assert.equal(duration(120), "2 h");
assert.equal(duration(85.9), "1 h 25 min");
assert.equal(duration(0.2), "1 min");

// The goal strip's caption: over halfway only right after a Done that took it past half.
assert.equal(barCaption(3, 7), "3 of 7 done");
assert.equal(barCaption(4, 7, true), "4 of 7 · over halfway");
assert.equal(barCaption(4, 7), "4 of 7 done");
assert.equal(barCaption(3, 7, true), "3 of 7 done", "not over half yet");
assert.equal(barCaption(2, 4, true), "2 of 4 done", "half is not over half");
assert.equal(barCaption(7, 7, true), "7 of 7 done");
// None done is said in words (the font's slashed zero read as "Ø of 5 done").
assert.equal(barCaption(0, 5), "None of 5 done yet");
assert.equal(barCaption(5, 9, true, true), "5 done · 4 planned", "a goal that keeps going is never halfway");
assert.equal(barCaption(0, 4, false, true), "None done · 4 planned");
assert.equal(barCaption(5, 5, true, true), "5 done");
assert.equal(barCaption(0, 1), "Not done yet");
for (const total of [1, 5, 10]) assert.equal(/\b0\b/.test(barCaption(0, total, true)), false, String(total));

// The goal strip's line: the due date with the days left, or a goal's rhythm and week (Tuesday, Nov 3).
const g0 = (extra: Partial<Goal>): Goal => ({ ...goal(step("1", "todo")), ...extra });
assert.equal(goalLine(g0({ due: "2026-11-12" }), "2026-11-03", LA), "due Thu Nov 12 · 9 days left");
assert.equal(goalLine(g0({ due: "2026-11-05" }), "2026-11-03", LA), "due Thu Nov 5 · 2 days left");
assert.equal(goalLine(g0({ due: "2026-11-04" }), "2026-11-03", LA), "due tomorrow");
assert.equal(goalLine(g0({ due: "2026-11-03" }), "2026-11-03", LA), "due today");
assert.equal(goalLine(g0({ due: "2026-10-30" }), "2026-11-03", LA), "was due Fri Oct 30");
assert.equal(goalLine(g0({}), "2026-11-03", LA), "");
assert.equal(goalLine(g0({ due: "2026-11-12" }), "", LA), "", "not before the browser's clock");
assert.equal(goalLine(g0({ rhythm: "3 runs a week" }), "2026-11-03", LA), "3 runs a week · week 1", "nothing finished yet");
// Week 2: the first run was last week (Thursday, Oct 29, in Los Angeles), so Monday Nov 2 starts week 2.
const ran = (iso: string) => step("r", "done", { doneAt: iso, startedAt: iso });
assert.equal(goalLine(g0({ rhythm: "3 runs a week", steps: [ran("2026-10-30T02:00:00Z"), step("2", "todo")] }), "2026-11-03", LA), "3 runs a week · week 2");
assert.equal(goalLine(g0({ rhythm: "3 runs a week", steps: [ran("2026-11-02T18:00:00Z")] }), "2026-11-03", LA), "3 runs a week · week 1", "first run this Monday");
assert.equal(goalLine(g0({ rhythm: " 3 runs a week ", due: "2027-01-10", steps: [ran("2026-10-30T02:00:00Z")] }), "2026-11-03", LA), "3 runs a week · week 2 · 68 days left");
assert.equal(goalLine(g0({ rhythm: "", due: "2026-11-04" }), "2026-11-03", LA), "due tomorrow", "a blank rhythm is none");

// Where you stopped: the newest done step, by the person's day (Tuesday, Nov 3, in Los Angeles).
const t1 = new Date("2026-11-03T18:00:00Z"); // 10 AM in Los Angeles
const tue = "2026-11-03";
const doneStep = (iso: string, minutes: number | null, id = "x", title = "Draft the thesis") =>
  step(id, "done", { title, doneAt: iso, startedAt: minutes === null ? null : new Date(Date.parse(iso) - minutes * 60_000).toISOString() });
assert.equal(stoppedLine(goal(doneStep("2026-11-03T17:30:00Z", 12)), LA, tue), "Draft the thesis · done today in 12 min");
assert.equal(stoppedLine(goal(doneStep("2026-11-03T06:30:00Z", null)), LA, tue), "Draft the thesis · done yesterday", "10:30 PM in Los Angeles");
assert.equal(stoppedLine(goal(doneStep("2026-10-31T18:00:00Z", 5)), LA, tue), "Draft the thesis · done Saturday in 5 min");
assert.equal(stoppedLine(goal(doneStep("2026-10-20T18:00:00Z", 5)), LA, tue), "Draft the thesis · done Oct 20 in 5 min");
assert.equal(
  stoppedLine(goal(doneStep("2026-11-02T18:00:00Z", 5, "a"), doneStep("2026-11-03T17:00:00Z", 9, "b", "Find two quotes"), step("c", "todo")), LA, tue),
  "Find two quotes · done today in 9 min",
);
assert.equal(stoppedLine(goal(step("1", "todo")), LA, tue), null);
assert.equal(stoppedLine(null, LA, tue), null);
assert.equal(stoppedLine(goal(doneStep("2026-11-03T17:30:00Z", 12)), LA, ""), null, "not before the browser's clock");
// 10:30 PM on Nov 2 in Los Angeles is 3:30 PM on Nov 3 in Tokyo: the person's own zone decides.
assert.equal(stoppedLine(goal(doneStep("2026-11-03T06:30:00Z", null)), "Asia/Tokyo", tue), "Draft the thesis · done today");

// The wrap line counts today's finished steps across the plans, each once, with the minutes they really took.
const g1 = goal(doneStep("2026-11-03T17:30:00Z", 12, "a"), doneStep("2026-11-03T16:00:00Z", 29, "b"), doneStep("2026-11-02T18:00:00Z", 30, "c"), step("d", "todo"));
const g2 = { ...goal(doneStep("2026-11-03T15:00:00Z", null, "e")), id: "g2" };
assert.equal(todayLine([g1], LA, t1), "Today: 2 steps, 41 min.");
assert.equal(todayLine([g1, g2, g1], LA, t1), "Today: 3 steps, 41 min.", "a step counted once; an untimed one adds no minutes");
assert.equal(todayLine([g2], LA, t1), "Today: 1 step.");
assert.equal(todayLine([null, goal(step("1", "todo"))], LA, t1), null);

// After a Done: the free time left before the next event, when now is in a free slot that event ends.
const t2 = Date.parse("2026-11-03T18:00:00Z");
const ev = (title: string, from: number, to: number, extra: { allDay?: boolean; zeno?: boolean } = {}) => ({
  title,
  start: new Date(t2 + from * 60_000).toISOString(),
  end: new Date(t2 + to * 60_000).toISOString(),
  allDay: false,
  ...extra,
});
const freeNow = [{ start: new Date(t2 - 30 * 60_000).toISOString(), end: new Date(t2 + 85 * 60_000).toISOString() }];
assert.equal(untilNext([ev("BIO 101", 85, 160)], freeNow, t2), "You have 1 h 25 min until BIO 101.");
assert.equal(untilNext([ev("Write", 85, 95, { zeno: true }), ev("BIO 101", 85, 160)], freeNow, t2), "You have 1 h 25 min until BIO 101.", "never Zeno's own block");
assert.equal(untilNext([ev("Write", 85, 95, { zeno: true })], freeNow, t2), null);
assert.equal(untilNext([ev("BIO 101", 85, 160)], [{ ...freeNow[0], start: new Date(t2 + 5 * 60_000).toISOString() }], t2), null, "busy now");
assert.equal(untilNext([ev("BIO 101", 200, 260)], freeNow, t2), null, "the slot ends with the waking day");
assert.equal(untilNext([ev("Birthday", 85, 160, { allDay: true })], freeNow, t2), null);
assert.equal(untilNext([ev("BIO 101", 85, 160)], [], t2), null);
assert.equal(untilNext([ev("CS 146", 85.5, 160)], freeNow, t2 + 84 * 60_000), "You have 1 min until CS 146.");

console.log("day-flow self-check passed");
