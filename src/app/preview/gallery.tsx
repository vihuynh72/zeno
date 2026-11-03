"use client";

import { useRef, useSyncExternalStore } from "react";
import type { CalendarBlock, FirstPick, Goal, Memory, Progress, Step } from "@/lib/day";
import type { VaultFact } from "@/lib/vault";
import type { VoiceError, VoicePhase } from "@/lib/use-voice";
import { checkinMinute, FOCUS, foundLine, slotLabel } from "@/components/day-flow";
import type { Booking } from "@/components/booking-chip";
import DayView, { type DayViewProps, type Today } from "@/components/day-view";
import { CANVAS_DEADLINES, CANVAS_MEMORIES, SAMPLE_CANVAS } from "./canvas-samples";

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
      from: "Dana Lee <dana.lee@school.edu>",
      subject: "Lab report feedback",
      snippet: "Looks good overall. Two small fixes on page 3 before you submit, and I&#39;d cite the second source.",
      unread: true,
    },
    {
      from: '"Registrar" <registrar@school.edu>',
      subject: "Spring registration opens Monday",
      snippet: "Your time slot is 9:00 AM. Check for holds on your account before then.",
      unread: true,
    },
    { from: "Maya <maya@example.com>", subject: "Lunch?", snippet: "Still on for today? The place by the library works for me.", unread: false },
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

const PICK: FirstPick = {
  goal: "Lab report: enzyme activity",
  due: dayFrom(2),
  stepId: null,
  steps: [
    { title: "Email Prof Patel about an extension", minutes: 5 },
    { title: "Paste the results table into the doc", minutes: 10 },
    { title: "Draft the methods section", minutes: 20 },
  ],
  why: "It unblocks everything else, and it's due in two days.",
};
const RULE_PICK: FirstPick = { goal: "Bio lab report", due: dayFrom(1), stepId: null, steps: [{ title: "Open it and work 5 minutes", minutes: 5 }], why: "Due tomorrow." };
const STREAK_PICK: FirstPick = { goal: "History essay draft", due: dayFrom(3), stepId: "s2", steps: [{ title: "List three points you want to make", minutes: 5 }], why: "It's next on your plan; 5 minutes gets it going." };

const pickChips = (minutes = 5) => [`Start · ${minutes} min`, "Something else"];
const FOCUS_CHIPS = ["Done", "Stuck?", "Stop for now", "Sources"];
const DONE_CHIPS = ["Keep going", "That's enough today"];

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
// First sign-in, once the scan answered: one line, Start my day, and two links.
const FOUND_CHIPS = ["Start my day", "Paste notes", "See what I learned"];
const CANVAS = { account: "sample", linked: false };

type Fixture = Partial<Omit<DayViewProps, "voice" | "on">> & { phase?: VoicePhase; level?: number; error?: VoiceError };

const STATES: Record<string, Fixture> = {
  "signed-out": { screen: "signed-out", line: "Zeno helps you start the thing you keep putting off.", chips: ["Sign in with Google"] },
  // The very first paint: the card and the browser's greeting, before the day loads.
  shell: { screen: null, line: "Good afternoon." },
  ready: {
    line: "Good afternoon, Sam. You're clear until your 4:30 study group.",
    chips: chips("Work on my essay", "Plan my afternoon", "Help me pick one thing"),
    progress: progress(),
  },
  // The first card: the opening's pick, ready to start with one tap.
  pick: {
    line: "Afternoon, Sam. The lab report is the one: start by emailing Prof Patel?",
    pick: PICK,
    chips: pickChips(),
    progress: progress(),
  },
  // The rule's pick, when the model is unavailable: it must look just as good.
  "pick-rule": {
    line: "Good afternoon, Sam. Your Bio lab report is due tomorrow. Five minutes on it?",
    pick: RULE_PICK,
    chips: pickChips(),
    progress: progress({ streak: 0, best: 0, week: week([], "today"), stepsThisWeek: 0 }),
  },
  // Evening, a live streak and nothing done today: the card leads with saving it.
  "pick-at-risk": {
    line: "Evening, Sam. One 5-minute step keeps your 6-day streak going. List your three points?",
    pick: STREAK_PICK,
    chips: pickChips(),
    progress: progress({ streak: 6, atRisk: true }),
  },
  // A reload paints the saved card at once; its chips wait for /api/day.
  "pick-cached": { line: "Afternoon, Sam. The lab report is the one: start by emailing Prof Patel?", pick: PICK, chips: [], progress: progress() },
  "ready-model": {
    line: "Afternoon, Sam. You've got a clear hour before study group. Want to knock out the essay outline?",
    chips: chips("Start the outline", "Something smaller first"),
    phase: "speaking",
    level: 0.5,
  },
  hear: {
    line: "Afternoon, Sam. You've got a clear hour before study group. Want to knock out the essay outline?",
    chips: chips("Start the outline", "Something smaller first"),
    hear: true,
  },
  "ready-empty": { line: "Good afternoon, Sam.", chips: ["Let's start"] },
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
    goal: focusing({ id: "sample-lab", title: PICK.goal, due: PICK.due, steps: [step("e1", PICK.steps[0].title, 5, "doing")] }, 1),
    line: FOCUS.calm,
    quiet: true,
    chips: ["Done", "Stuck?", "Stop for now", "Draft it in Gmail"],
  },
  // A plan for a Canvas assignment: Open in Canvas joins the links (nothing opens on its own).
  "focus-canvas": {
    screen: "focus",
    goal: focusing(CANVAS_PLAN, 2),
    line: FOCUS.calm,
    quiet: true,
    chips: FOCUS_CHIPS,
    canvasUrl: "https://sample.instructure.com/courses/1/assignments/1",
  },
  // The Sources link opened the step's sources: one ruled card, a title and a why on a line each.
  "focus-sources": { screen: "focus", goal: focusing(PREPPED, 3), line: FOCUS.calm, quiet: true, chips: FOCUS_CHIPS.slice(0, 3), sources: true },
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
    line: "Nice. Next: Draft the opening paragraph, 15 min",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ week: week(PAST, "done"), stepsThisWeek: 6 }),
    phase: "speaking",
    level: 0.35,
  },
  milestone: {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Nice. Next: Draft the opening paragraph, 15 min",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ streak: 7, best: 7, milestone: 7, week: week(["done", "done", "rest", "done", "done", "done"], "done"), stepsThisWeek: 9 }),
  },
  // After a break: Day 1 again, never shame. A new person's earlier days are plain dots.
  "day-one-again": {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Nice. Next: Draft the opening paragraph, 15 min",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ streak: 1, best: 9, week: week(["done", "rest", "missed", "missed", "missed", "missed"], "done"), stepsThisWeek: 1 }),
  },
  "first-day": {
    screen: "checkin",
    goal: roadmap("done", "todo", "todo", "todo"),
    line: "Nice. Next: List three points you want to make, 10 min",
    chips: DONE_CHIPS,
    celebrate: true,
    progress: progress({ streak: 1, best: 1, week: week([], "done"), stepsThisWeek: 1, restDaysLeft: 1 }),
  },
  finished: {
    screen: "checkin",
    goal: roadmap("done", "done", "done", "done"),
    line: "Nice work. That was the last step.",
    chips: ["Pick the next thing", "That's enough today"],
  },
  // Stop for now with an hour or more of the plan left: one block tomorrow, one tap.
  wrap: {
    screen: "wrap",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Saved. I'll bring it back next time.",
    offers: [offer("s3", TOMORROW)],
    chips: ["No thanks"],
  },
  // A small plan left, or no calendar to write to: nothing offered.
  "wrap-quiet": { screen: "wrap", goal: roadmap("done", "done", "todo", "todo"), line: "Saved. I'll bring it back next time.", chips: ["Back to my day"] },
  "wrap-booked": {
    screen: "wrap",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Booked. Tomorrow's streak is planned.",
    offers: [offer("s3", { ...TOMORROW, eventId: "e2" }, "booked")],
    chips: ["Back to my day"],
  },
  desk: { line: "Good afternoon, Sam.", goal: roadmap("done", "doing", "todo", "todo"), sheet: "today" },
  "desk-quiet": {
    line: "Good afternoon, Sam.",
    sheet: "today",
    today: { events: [], emails: [], unreadEmail: 0, sources: { calendar: "ok", email: "error", goals: "ok" } },
  },
  // Canvas deadlines with long titles: two lines at most each, cut with an ellipsis.
  "desk-deadlines": { line: "Good afternoon, Sam.", sheet: "today", today: { ...TODAY, deadlines: CANVAS_DEADLINES } },
  memory: { line: "Good afternoon, Sam.", sheet: "memory", device: DEVICE },
  // Canvas deadlines fold into one line at the end of Projects & deadlines, which opens them there, each with its ×.
  "memory-canvas": { line: "Good afternoon, Sam.", sheet: "memory", memories: [...MEMORIES, ...CANVAS_MEMORIES] },
  "memory-empty": { line: "Good afternoon, Sam.", sheet: "memory", memories: [] },
  // The account menu: Sound, Connect Canvas (or Canvas · connected), Privacy, Sign out.
  account: { line: "Good afternoon, Sam.", chips: chips("Work on my essay"), menuOpen: true, progress: progress() },
  "account-canvas": { line: "Good afternoon, Sam.", chips: chips("Work on my essay"), menuOpen: true, progress: progress(), canvas: { ...CANVAS, linked: true } },
  // Connect Canvas, opened from the account menu.
  canvas: { line: "Good afternoon, Sam.", sheet: "canvas" },
  // Connected: the last sync's work by the day it is due, a line or two each, with a time only when it isn't 11:59 PM.
  "canvas-connected": { line: "Good afternoon, Sam.", sheet: "canvas", canvas: SAMPLE_CANVAS },
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
        line=""
        you=""
        goal={null}
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
          openGoal: () => {},
          openDeadline: () => {},
          reply: () => {},
        }}
      />
    </div>
  );
}

// ---- The desk's free time, deadlines and Week view (week track) ----
// week-samples answers the calendar API itself, so these states never read or book a real calendar.
import { WEEK_STATES, withPlans } from "./week-samples";
const DESK: Fixture = { line: "Good afternoon, Sam.", goal: roadmap("done", "doing", "todo", "todo") };
STATES["desk-plans"] = { ...DESK, sheet: "today", today: withPlans(TODAY) };
// A block booked from a talk offer: it joins today's list and leaves Free.
STATES["desk-booked"] = {
  ...STATES["desk-plans"],
  bookings: {
    s3: { key: "s3", label: "", state: "booked", blocks: [{ title: "History essay draft", kind: "step", start: at(150), end: at(240), stepId: "s3", eventId: "e2" }] },
  },
};
for (const name of WEEK_STATES) STATES[name] = { ...DESK, sheet: "week" };
