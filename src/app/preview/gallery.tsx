"use client";

import { useRef, useSyncExternalStore } from "react";
import type { CalendarBlock, Goal, Memory, Progress, Step } from "@/lib/day";
import type { VaultFact } from "@/lib/vault";
import type { VoiceError, VoicePhase } from "@/lib/use-voice";
import { checkinMinute, feedStack, FOCUS, foundLine, slotLabel, suggestionRow, type StackInput } from "@/components/day-flow";
import type { Booking } from "@/components/booking-chip";
import DayView, { type DayViewProps, type Today } from "@/components/day-view";
import { CANVAS_DEADLINES, CANVAS_MEMORIES, SAMPLE_CANVAS } from "./canvas-samples";
import "./mail-samples";

// Sample data only: no network calls, nothing real.
const step = (id: string, title: string, minutes: number, status: Step["status"], extra: Partial<Step> = {}): Step => ({
  id,
  title,
  minutes,
  status,
  startedAt: null,
  doneAt: null,
  ...extra,
});

const roadmap = (...statuses: Step["status"][]): Goal => ({
  id: "sample-goal",
  title: "History essay draft",
  due: dayFrom(3),
  steps: [
    step("s1", "Open the essay doc and write a working title", 5, statuses[0]),
    step("s2", "List three points you want to make", 10, statuses[1]),
    step("s3", "Draft the opening paragraph", 15, statuses[2]),
    step("s4", "Read it out loud and fix one thing", 10, statuses[3]),
  ],
});

// Focus with sources already found for its step (the server finds at most 3); a long one ends in an ellipsis.
const PREPPED = roadmap("done", "doing", "todo", "todo");
PREPPED.steps[1].prep = [
  { title: "How to brainstorm essay points", url: "https://example.com/brainstorm", why: "Three quick ways to find points worth arguing" },
  { title: "Outlining a history essay", url: "https://example.com/outline", why: "Shows how each point maps to one paragraph" },
  {
    title: "Reconstruction and the long road to civil rights: a primary source reader for students",
    url: "https://example.com/reader",
    why: "Short primary sources by date, each with two questions that could become an essay point",
  },
];

// Focus on a Canvas assignment's plan: the goal line says what the step is for, here cut to one line, its due part whole.
const CANVAS_PLAN: Goal = {
  id: "sample-canvas-goal",
  title: "ENGL 1A: Peer review: Argument essay draft and comments on two classmates' theses",
  due: dayFrom(3),
  steps: [step("c1", "Read the first thesis and note one question", 5, "doing"), step("c2", "Write two comments for each draft", 15, "todo")],
};

// A step in Focus since `minutes` ago on the real clock, so the stopwatch shows a real count.
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const focusing = (goal: Goal, minutes: number): Goal => ({
  ...goal,
  steps: goal.steps.map((s) => (s.status === "doing" ? { ...s, startedAt: ago(minutes) } : s)),
});
// A step title on two lines, and a goal line cut so its due part stays whole.
const LONG_PLAN: Goal = {
  id: "sample-long-goal",
  title: "SOC 15: Field observation report on study habits in the campus library",
  due: dayFrom(3),
  steps: [step("l1", "Underline the three questions your report must answer", 10, "doing"), step("l2", "Write one observation per question", 15, "todo")],
};

// Around the real clock (to the half hour), so the desk shows a past, a current and a later event.
const at = (minutes: number) => new Date(Math.floor(Date.now() / 1_800_000) * 1_800_000 + minutes * 60_000).toISOString();
function dayFrom(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const TODAY: Today = {
  events: [
    { title: "Grandma's birthday", start: "2026-10-29", end: "2026-10-30", allDay: true },
    { title: "Lab check-in", start: at(-150), end: at(-135), allDay: false },
    { title: "Biology lecture", start: at(-30), end: at(45), allDay: false },
    { title: "Lunch with Maya", start: at(90), end: at(150), allDay: false },
    { title: "Study group for the history essay", start: at(240), end: at(300), allDay: false },
  ],
  emails: [
    {
      from: "Prof. Lin <lin@school.example>",
      subject: "Office hours this week?",
      snippet: "Does Wednesday at 2 or Thursday at 11 work for you?",
      unread: true,
      id: "sample-mail",
      address: "lin@school.example",
      asks: true,
    },
    {
      from: "Dana Lee <dana.lee@school.edu>",
      subject: "Lab report feedback",
      snippet: "Looks good overall. Two small fixes on page 3 before you submit, and I&#39;d cite the second source.",
      unread: true,
      id: "sample-mail-2",
      address: "dana.lee@school.edu",
      asks: false,
    },
    {
      from: '"Registrar" <registrar@school.edu>',
      subject: "Spring registration opens Monday",
      snippet: "Your time slot is 9:00 AM. Check for holds on your account before then.",
      unread: true,
      id: "sample-mail-3",
      address: "registrar@school.edu",
      asks: false,
    },
    { from: "Maya <maya@example.com>", subject: "Lunch?", snippet: "Still on for today? The place by the library works for me.", unread: false, id: "sample-gone", asks: true },
    {
      from: "Canvas <notifications@instructure.com>",
      subject: "History essay draft due Friday",
      snippet: "Reminder: your draft is due Friday at 11:59 PM.",
      unread: false,
    },
    { from: "orders@bookstore.example", subject: "Your order shipped", snippet: "Two items are on the way &amp; should arrive Tuesday.", unread: false },
  ],
  unreadEmail: 2,
  sources: { calendar: "ok", email: "ok", goals: "ok" },
  mailUrl: "https://mail.google.com/mail/?authuser=sam%40example.com",
};

const MEMORIES: Memory[] = [
  { id: "m1", text: "Likes 25-minute work blocks with a short break after.", createdAt: "2026-10-27T18:00:00Z", group: "work-style", source: "you" },
  { id: "m2", text: "Thinks best in the morning, before classes.", createdAt: "2026-10-28T16:00:00Z", group: "work-style", source: "you" },
  { id: "m3", text: "Studies biology at State, Mondays, Wednesdays and Fridays.", createdAt: "2026-10-28T16:00:00Z", group: "about", source: "calendar" },
  { id: "m4", text: "Works campus library shifts on Tuesday and Saturday mornings.", createdAt: "2026-10-28T16:00:00Z", group: "routines", source: "calendar" },
  { id: "m5", text: "To do: email Prof Patel about the lab extension", createdAt: "2026-10-28T16:00:00Z", group: "projects", source: "email" },
  { id: "m6", text: "Training for a 5K in December.", createdAt: "2026-10-28T16:00:00Z", group: "interests", source: "email" },
  { id: "m7", text: "Dana Lee is the lab TA.", createdAt: "2026-10-28T16:00:00Z", group: "people", source: "email" },
  { id: "m8", text: "You finish 5-minute starts at night.", createdAt: "2026-10-30T05:00:00Z", group: "patterns", source: "pattern" },
];

const DEVICE: VaultFact[] = [{ id: "v1", text: "Mornings feel foggy lately.", group: "about", createdAt: "2026-10-30T05:00:00Z" }];

const ASK = "What's the one thing you keep putting off?";

// The week around the real weekday, Monday first: `before` ends yesterday (its last entries are used), then today.
type DayState = Progress["week"][number];
function week(before: DayState[], now: DayState): DayState[] {
  const today = (new Date().getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => (i < today ? (before[before.length - today + i] ?? "none") : i === today ? now : "future"));
}
const PAST: DayState[] = ["done", "missed", "done", "rest", "done", "done"];

const progress = (over: Partial<Progress> = {}): Progress => ({
  streak: 4,
  best: 9,
  week: week(PAST, "today"),
  stepsThisWeek: 5,
  restDaysLeft: 0,
  atRisk: false,
  milestone: null,
  ...over,
});

const FOCUS_CHIPS = ["Done", "Stuck?", "Stop for now"];
const DONE_CHIPS = ["Keep going", "Switch goal", "That's enough today"];

// ---- The home and a goal's desk (Vi, Nov 3) ----
// A step finished `ago` minutes back that took `took` minutes, so "Where you stopped" and the steps' minutes are real.
const finished = (s: Step, ago: number, took: number): Step => ({
  ...s,
  status: "done",
  startedAt: new Date(Date.now() - (ago + took) * 60_000).toISOString(),
  doneAt: new Date(Date.now() - ago * 60_000).toISOString(),
});
const ESSAY = roadmap("done", "done", "todo", "todo");
ESSAY.steps[0] = finished(ESSAY.steps[0], 26 * 60, 6);
ESSAY.steps[1] = finished(ESSAY.steps[1], 25 * 60, 12);
const LAB: Goal = {
  id: "sample-lab-goal",
  title: "CHEM 1A: Lab 6 writeup",
  due: dayFrom(5),
  steps: [step("b1", "Paste the results table into the doc", 10, "todo"), step("b2", "Draft the methods section", 20, "todo"), step("b3", "Write one paragraph on the error", 15, "todo")],
};
const QUIZ = { title: "BIO 101: Quiz 6 (Ch. 6)", date: dayFrom(1), daysLeft: 1 };
const ASKING = TODAY.emails[0];
const today = () => dayFrom(0);
// Suggestions as the page ranks them, its top 3.
const suggestions = (input: Partial<StackInput>) =>
  feedStack({ plans: [], deadlines: [], emails: [], handled: [], apps: [], canvas: [], memories: [], kept: [], today: today(), timeZone: zone(), now: new Date(), ...input })
    .slice(0, 3)
    .map((card) => suggestionRow(card, today()));
// The stack's other sources: an app's item, a Canvas assignment, and what Zeno noticed yesterday.
const STACK: Partial<StackInput> = {
  apps: [{ app: "notion", id: "n1", title: "Club budget for Friday", url: "https://www.notion.so/sample", kind: "page", due: dayFrom(5), detail: null }],
  canvas: [{ id: "c1", course: "CHEM 1A", title: "Lab 7 prelab", due: `${dayFrom(1)}T23:59:00`, kind: "assignment", url: "https://school.instructure.com/sample" }],
  memories: [{ id: "noticed-1", text: "You get more done before noon.", createdAt: ago(60 * 20), group: "patterns", source: "pattern" }],
};
const HOME_LINE = "You finished two essay steps yesterday. You're free until Biology lecture at 1:30.";
// The desk's Start and its links, for a plan with more than one step open.
const DESK_CHIPS = (minutes: number) => [`Start · ${minutes} min`, "Skip", "Adjust"];
// An email's reply plan, its email remembered by id.
const REPLY: Goal = { id: "sample-reply-goal", title: "Answer Prof. Lin", due: null, steps: [step("r1", "Reply to Prof. Lin about Office hours this week?", 2, "todo")] };
// Focus on the essay's third step, 9 minutes in.
const ESSAY_FOCUS: Goal = { ...ESSAY, steps: ESSAY.steps.map((s) => (s.id === "s3" ? { ...s, status: "doing", startedAt: ago(9) } : s)) };
// After its Done: 3 of 4, over halfway.
const ESSAY_DONE: Goal = { ...ESSAY, steps: ESSAY.steps.map((s) => (s.id === "s3" ? finished(s, 0, 14) : s)) };
const ESSAY_ALL: Goal = { ...ESSAY_DONE, steps: ESSAY_DONE.steps.map((s) => (s.id === "s4" ? finished(s, 0, 9) : s)) };

// A booking offer, around the real clock.
const block = (stepId: string, title: string, start: number, minutes: number): CalendarBlock => ({ title, kind: "step", start: at(start), end: at(start + minutes), stepId });
const offer = (key: string, b: CalendarBlock, state: Booking["state"] = "offer"): Booking => ({
  key,
  blocks: [b],
  label: `Book ${slotLabel(b.start!, b.end!, zone())}?`,
  state,
});
// After Stop for now, a plan with an hour or more left: one block tomorrow.
const TOMORROW = block("s3", "History essay draft", 1500, 90);

const chips = (...labels: string[]) => [...labels, "Something else"];
// First sign-in, once the scan answered: one line, Start, and two links.
const FOUND_CHIPS = ["Start", "Paste notes", "See what I learned"];
const CANVAS = { account: "sample", linked: false };

type Fixture = Partial<Omit<DayViewProps, "voice" | "on">> & { phase?: VoicePhase; level?: number; error?: VoiceError };

const STATES: Record<string, Fixture> = {
  "signed-out": { screen: "signed-out", line: "Zeno helps you start the thing you keep putting off.", chips: ["Sign in with Google"] },
  // The very first paint: the hello card with the browser's greeting, before the day loads.
  shell: { screen: null, hello: "Hey.", line: "" },
  // The home with no goal options: Zeno's line and its quick replies, as before.
  ready: {
    line: "You're clear until your 4:30 study group.",
    chips: chips("Work on my essay", "Plan my afternoon", "Help me pick one thing"),
    progress: progress(),
  },
  "ready-model": {
    line: "You've got a clear hour before study group. Want to knock out the essay outline?",
    chips: chips("Start the outline", "Something smaller first"),
    phase: "speaking",
    level: 0.5,
  },
  hear: {
    line: "You've got a clear hour before study group. Want to knock out the essay outline?",
    chips: chips("Start the outline", "Something smaller first"),
    hear: true,
  },
  "ready-empty": { line: "", chips: ["Let's start"] },
  // The home (Nov 4): the hello and the goals panel (left on a laptop, under the hello on a phone), Suggestions under it.
  "home-goals": {
    line: HOME_LINE,
    goals: [ESSAY, LAB],
    suggestions: suggestions({ deadlines: [QUIZ] }),
    chips: [],
    hear: true,
  },
  // An email that asks something joins the Suggestions.
  "home-goals-mail": {
    line: HOME_LINE,
    goals: [ESSAY, LAB],
    suggestions: suggestions({ deadlines: [QUIZ], emails: [ASKING] }),
    chips: [],
  },
  // The stack (Vi, Nov 4): a Canvas assignment due tomorrow, the email, the essay's next step (due in 3 days); an app's
  // item and what Zeno noticed wait under them.
  "home-stack": {
    line: HOME_LINE,
    goals: [ESSAY, LAB],
    suggestions: suggestions({ ...STACK, plans: [ESSAY, LAB], emails: [ASKING] }),
    chips: [],
  },
  // Further down the stack: the app's item and what Zeno noticed, with Keep and Forget.
  "home-stack-noticed": {
    line: HOME_LINE,
    goals: [ESSAY, LAB],
    suggestions: suggestions({ ...STACK, canvas: [] }),
    chips: [],
  },
  // Everything hidden or done.
  "home-caught-up": { line: HOME_LINE, goals: [ESSAY, LAB], suggestions: [], chips: [] },
  // Nothing open, nothing due this week, no asking mail: Zeno's line and its quick replies.
  "home-empty": { line: "Nothing is due this week, and your afternoon is open.", chips: chips("Start something new", "Plan my week") },
  // A goal's desk: the strip, Zeno's next step with Start, the steps, and what lies on the desk.
  "goal-desk": {
    view: "desk",
    goal: ESSAY,
    proposed: ESSAY.steps[2],
    chips: DESK_CHIPS(15),
  },
  // "For this goal" with everything in it (Vi, Nov 4): the study group from the calendar, free time to book, the Canvas
  // email about the essay, links, the Canvas prompt and a page from an app, and her notes.
  "goal-workspace": {
    view: "desk",
    goal: ESSAY,
    proposed: ESSAY.steps[2],
    chips: DESK_CHIPS(15),
    deskOffer: { ...offer("aside:s3", block("s3", "Draft the opening paragraph", 60, 15)), label: "Book it" },
    appItems: [
      { app: "notion", id: "n1", title: "History essay outline", url: "https://www.notion.so/sample", kind: "page", due: null, detail: "Three points, each with a source." },
      { app: "trello", id: "t1", title: "Buy printer ink", url: "https://trello.com/c/sample", kind: "task", due: null, detail: null },
    ],
    materials: {
      prompt: { course: "HIST 17A", text: "Argue whether Reconstruction succeeded, using two primary sources.", url: "https://sample.instructure.com/courses/1/assignments/2" },
      notes: { s3: [{ you: "Can I open with a quote?", zeno: "Yes, if it sets up your first point. Keep it to one line." }] },
    },
  },
  // A Canvas assignment's plan: its prompt lies on the desk, with Open in Canvas.
  "goal-desk-canvas": {
    view: "desk",
    goal: { ...CANVAS_PLAN, steps: CANVAS_PLAN.steps.map((s) => ({ ...s, status: "todo" as const })) },
    proposed: { ...CANVAS_PLAN.steps[0], status: "todo" },
    chips: DESK_CHIPS(5),
    materials: {
      prompt: {
        course: "ENGL 1A",
        text: "Read two classmates' thesis statements in the Week 9 discussion. For each, write one question the thesis raises and one suggestion that would make it more arguable. Keep each comment under 120 words and be specific.",
        url: "https://sample.instructure.com/courses/1/assignments/1",
      },
    },
  },
  // An email's reply plan: the email opens in full on the desk (made-up, from mail-samples).
  "goal-desk-email": {
    view: "desk",
    goal: REPLY,
    proposed: REPLY.steps[0],
    chips: ["Start · 2 min", "Something smaller"],
    materials: { mail: { id: "sample-mail", gmail: "https://mail.google.com/mail/?authuser=sam%40example.com#inbox/sample-mail" } },
  },
  // A deadline tapped with no plan yet: Muse breaks it into steps, with no Start until it has.
  "goal-desk-planning": { view: "desk", planning: { title: QUIZ.title, due: QUIZ.date, line: "Breaking it into steps…" }, chips: [] },
  // "Add from a photo": Muse Spark reads the assignment's photo, then its plan's desk opens as a deadline's does.
  "snap-reading": { view: "desk", planning: { title: "Your assignment", due: null, line: "Reading your photo…" }, chips: [] },
  // Focus on the desk: the step card with its stopwatch, the bar's running segment red, the steps and materials below.
  "desk-focus": {
    screen: "focus",
    goal: ESSAY_FOCUS,
    line: FOCUS.calm,
    quiet: true,
    chips: FOCUS_CHIPS,
  },
  // Stuck? asks nothing: a smaller piece, or another goal.
  "desk-stuck": {
    screen: "focus",
    goal: ESSAY_FOCUS,
    line: FOCUS.calm,
    quiet: true,
    chips: ["Done", "Make it smaller", "Switch goal"],
  },
  // After Done: the bar fills, over halfway, and the free time before the next event.
  "desk-done": {
    screen: "checkin",
    goal: ESSAY_DONE,
    line: "Nice. Next: Read it out loud and fix one thing, 10 min. You have 1 h 25 min until Biology lecture.",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ week: week(PAST, "done"), stepsThisWeek: 6 }),
  },
  // The plan's last step: back to the goals.
  "desk-last-step": {
    screen: "checkin",
    goal: ESSAY_ALL,
    line: "That's all of History essay draft.",
    chips: ["Back to my goals", "That's enough today"],
    celebrate: true,
    progress: progress({ week: week(PAST, "done"), stepsThisWeek: 7 }),
  },
  "quick-replies": {
    screen: "talk",
    line: "History essay, due Friday. Want the tiniest first step, or a plan for the week?",
    chips: chips("Tiniest first step", "Plan the week"),
  },
  // Talk proposed a block for a to-do: one tap books it.
  "talk-offer": {
    screen: "talk",
    line: "Laundry fits at 5:30 today. Want me to block it?",
    offers: [{ key: "todo", blocks: [{ title: "Laundry", kind: "todo", start: at(120), end: at(150) }], label: `Book ${slotLabel(at(120), at(150), zone())}?`, state: "offer" }],
    chips: chips("Later tonight"),
  },
  // An email Zeno drafted: it opens in their Gmail, where they press Send.
  draft: {
    screen: "talk",
    line: "Here's a short draft to Prof Patel asking for two more days. Check it, then hit Send.",
    chips: ["Open in Gmail", "Not now"],
  },
  // First sign-in (Vi, Nov 2): no questions. The card says what Zeno is reading while the scan runs.
  "first-reading": { screen: "setup", line: "Reading your calendar and email…", chips: [] },
  // Then one line says what it learned, written without the model.
  "first-found": {
    screen: "setup",
    line: foundLine(
      (["routines", "routines", "projects", "projects", "projects", "about", "people", "work-style", "interests"] as const).map((group) => ({
        group,
        text: group === "projects" ? "Has the BIO 121 lab report due November 6." : "",
      })),
    ),
    chips: FOUND_CHIPS,
  },
  "first-empty": { screen: "setup", line: foundLine([]), chips: FOUND_CHIPS },
  // Paste notes, from the first sign-in line.
  paste: { screen: "setup", line: "Paste a syllabus, a to-do list or notes. I'll pull out what matters.", pasting: true, chips: ["Skip"] },
  talk: { screen: "talk", line: ASK, you: "my history essay, it's due Friday", phase: "listening", level: 0.7 },
  // Hands-free: the mic reopened after Zeno's question, nothing heard yet.
  "hands-free": { screen: "talk", line: "Want the tiniest first step, or a plan for the week?", chips: chips("Tiniest first step", "Plan the week"), phase: "listening", level: 0.1 },
  typing: { screen: "talk", line: ASK, typing: true },
  "typing-sent": { screen: "talk", line: "", you: "My history essay. It's due Friday.", typing: true, phase: "thinking" },
  thinking: { screen: "talk", line: "", you: "My history essay. It's due Friday.", phase: "thinking" },
  // Focus (Vi, Nov 3: "I don't want any alarm"): a stopwatch counts up beside the planned minutes, and Zeno's lines
  // under the card are muted and never said. Just started: the calm line.
  focus: { screen: "focus", goal: focusing(roadmap("done", "doing", "todo", "todo"), 0.4), line: FOCUS.calm, quiet: true, chips: FOCUS_CHIPS },
  // The step's one check-in moment (the planned minutes at the person's pace), for that minute only.
  "focus-checkin": {
    screen: "focus",
    goal: focusing(roadmap("done", "doing", "todo", "todo"), 10),
    line: FOCUS.checkin(checkinMinute(10)),
    quiet: true,
    chips: FOCUS_CHIPS,
  },
  // Back on the tab after a while away: how long this step has run.
  "focus-back": { screen: "focus", goal: focusing(roadmap("done", "doing", "todo", "todo"), 23), line: FOCUS.back(ago(23), Date.now()), quiet: true, chips: FOCUS_CHIPS },
  // Far past the plan: the clock keeps counting and nothing new is said; the calm line is back after the check-in's minute.
  "focus-overtime": { screen: "focus", goal: focusing(roadmap("done", "doing", "todo", "todo"), 75), line: FOCUS.calm, quiet: true, chips: FOCUS_CHIPS },
  "focus-two-line": { screen: "focus", goal: focusing(LONG_PLAN, 4), line: FOCUS.calm, quiet: true, chips: FOCUS_CHIPS },
  // An email to write: Focus offers to draft it in Gmail.
  "focus-email": {
    screen: "focus",
    goal: focusing({ ...REPLY, steps: [{ ...REPLY.steps[0], status: "doing" }] }, 1),
    line: FOCUS.calm,
    quiet: true,
    chips: ["Done", "Stuck?", "Stop for now", "Draft it in Gmail"],
    materials: { mail: { id: "sample-mail" } },
  },
  // A plan for a Canvas assignment: Open in Canvas is on its prompt's card (nothing opens on its own).
  "focus-canvas": {
    screen: "focus",
    goal: focusing(CANVAS_PLAN, 2),
    line: FOCUS.calm,
    quiet: true,
    chips: FOCUS_CHIPS,
    materials: { prompt: { course: "ENGL 1A", text: "Read two classmates' thesis statements and comment on each.", url: "https://sample.instructure.com/courses/1/assignments/1" } },
  },
  // "Find sources for this step" tapped: the sources in their desk card, a title and a why on a line each.
  "focus-sources": { screen: "focus", goal: focusing(PREPPED, 3), line: FOCUS.calm, quiet: true, chips: FOCUS_CHIPS, materials: { sourcesOpen: true } },
  // Stuck in focus: Zeno's question leads with its answers; Done stays one tap away.
  "focus-question": {
    screen: "focus",
    goal: roadmap("done", "doing", "todo", "todo"),
    line: "Want me to shrink it to one point, or find you an example?",
    chips: ["One point", "Find an example", "Done", "Stop for now"],
  },
  done: { screen: "focus", goal: focusing(roadmap("done", "doing", "todo", "todo"), 9), stamping: true, chips: FOCUS_CHIPS, busy: true },
  // After Done: what is next, with the streak and the week.
  checkin: {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Nice. Next: Draft the opening paragraph, 15 min.",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ week: week(PAST, "done"), stepsThisWeek: 6 }),
    phase: "speaking",
    level: 0.35,
  },
  milestone: {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Nice. Next: Draft the opening paragraph, 15 min.",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ streak: 7, best: 7, milestone: 7, week: week(["done", "done", "rest", "done", "done", "done"], "done"), stepsThisWeek: 9 }),
  },
  // After a break: Day 1 again, never shame. A new person's earlier days are plain dots.
  "day-one-again": {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Nice. Next: Draft the opening paragraph, 15 min.",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ streak: 1, best: 9, week: week(["done", "rest", "missed", "missed", "missed", "missed"], "done"), stepsThisWeek: 1 }),
  },
  "first-day": {
    screen: "checkin",
    goal: roadmap("done", "todo", "todo", "todo"),
    line: "Nice. Next: List three points you want to make, 10 min.",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ streak: 1, best: 1, week: week([], "done"), stepsThisWeek: 1, restDaysLeft: 1 }),
  },
  finished: {
    screen: "checkin",
    goal: roadmap("done", "done", "done", "done"),
    line: "That's all of History essay draft.",
    chips: ["Back to my goals", "That's enough today"],
  },
  // Stop for now with an hour or more of the plan left: one block tomorrow, one tap.
  wrap: {
    screen: "wrap",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Saved. I'll bring it back next time. Today: 2 steps, 41 min.",
    offers: [offer("s3", TOMORROW)],
    chips: ["No thanks"],
  },
  // A small plan left, or no calendar to write to: nothing offered.
  "wrap-quiet": { screen: "wrap", goal: roadmap("done", "done", "todo", "todo"), line: "Saved. I'll bring it back next time.", chips: ["Back to my goals"] },
  "wrap-booked": {
    screen: "wrap",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Booked. Tomorrow's streak is planned.",
    offers: [offer("s3", { ...TOMORROW, eventId: "e2" }, "booked")],
    chips: ["Back to my goals"],
  },
  desk: { line: HOME_LINE, goal: roadmap("done", "doing", "todo", "todo"), sheet: "today" },
  "desk-quiet": {
    line: HOME_LINE,
    sheet: "today",
    today: { events: [], emails: [], unreadEmail: 0, sources: { calendar: "ok", email: "error", goals: "ok" } },
  },
  // Canvas deadlines with long titles: two lines at most each, cut with an ellipsis.
  "desk-deadlines": { line: HOME_LINE, sheet: "today", today: { ...TODAY, deadlines: CANVAS_DEADLINES } },
  memory: { line: HOME_LINE, sheet: "memory", device: DEVICE },
  // Canvas deadlines fold into one line at the end of Projects & deadlines, which opens them there, each with its ×.
  "memory-canvas": { line: HOME_LINE, sheet: "memory", memories: [...MEMORIES, ...CANVAS_MEMORIES] },
  "memory-empty": { line: HOME_LINE, sheet: "memory", memories: [] },
  // The account menu: Sound, Connect Canvas (or Canvas · connected), Privacy, Sign out.
  account: { line: HOME_LINE, chips: chips("Work on my essay"), menuOpen: true, progress: progress() },
  "account-canvas": { line: HOME_LINE, chips: chips("Work on my essay"), menuOpen: true, progress: progress(), canvas: { ...CANVAS, linked: true } },
  // Connect Canvas, opened from the account menu.
  canvas: { line: HOME_LINE, sheet: "canvas" },
  // Connected: the last sync's work by the day it is due, a line or two each, with a time only when it isn't 11:59 PM.
  "canvas-connected": { line: HOME_LINE, sheet: "canvas", canvas: SAMPLE_CANVAS },
  error: { screen: "talk", line: "I couldn't think that through just now. Try again?" },
  blocked: {
    screen: "talk",
    line: ASK,
    error: "blocked",
    note: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  },
};

const noop = () => {};
const subscribeNever = () => noop;

export default function Gallery({ state, theme }: { state: string; theme?: "light" | "dark" }) {
  const { phase = "idle", level = 0, error = null, ...view } = STATES[state] ?? {};
  const levelRef = useRef(level);
  // Sheets open once hydrated, as in the app (on a tap), so one read from this browser (Canvas) matches the server's HTML.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);

  if (!STATES[state]) {
    return (
      <main className="mx-auto max-w-[560px] p-8">
        <h1 className="text-[28px] font-bold">Guided day states</h1>
        <ul className="mt-4 flex flex-col gap-2">
          {Object.keys(STATES).map((name) => (
            <li key={name}>
              <a className="underline underline-offset-4" href={`/preview?state=${name}`}>
                {name}
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <div data-theme={theme} className="still">
      <DayView
        screen="ready"
        hello="Hey Sam."
        line=""
        you=""
        goal={null}
        goals={[ESSAY, LAB]}
        today={TODAY}
        memories={MEMORIES}
        typing={false}
        stamping={false}
        leaving={null}
        note={null}
        signInFailed={false}
        busy={false}
        chips={[]}
        pasting={false}
        hear={false}
        progress={progress()}
        account="S"
        canvas={CANVAS}
        {...view}
        sheet={hydrated ? (view.sheet ?? null) : null}
        voice={{ phase, levelRef, muted: false, supported: true, error }}
        on={{
          chip: noop,
          choose: noop,
          snap: noop,
          home: noop,
          propose: noop,
          hear: noop,
          paste: noop,
          talk: noop,
          type: noop,
          closeTyping: noop,
          send: noop,
          sheet: noop,
          forget: noop,
          add: async () => true,
          retryMemory: noop,
          book: noop,
          unbook: noop,
          mute: noop,
          signIn: noop,
          signOut: noop,
          canvasSynced: noop,
          openGoal: noop,
          openDeadline: noop,
          reply: noop,
        }}
      />
    </div>
  );
}

// ---- The desk's free time, deadlines and Week view (week track) ----
// week-samples answers the calendar API itself, so these states never read or book a real calendar.
import { WEEK_STATES, withPlans } from "./week-samples";
const DESK: Fixture = { line: HOME_LINE, goal: roadmap("done", "doing", "todo", "todo") };
STATES["desk-plans"] = { ...DESK, sheet: "today", today: withPlans(TODAY) };
// A block booked from a talk offer: it joins today's list and leaves Free.
STATES["desk-booked"] = {
  ...STATES["desk-plans"],
  bookings: {
    s3: { key: "s3", label: "", state: "booked", blocks: [{ title: "History essay draft", kind: "step", start: at(150), end: at(240), stepId: "s3", eventId: "e2" }] },
  },
};
for (const name of WEEK_STATES) STATES[name] = { ...DESK, sheet: "week" };
