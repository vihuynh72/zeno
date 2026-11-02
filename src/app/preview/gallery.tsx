"use client";

import { useRef } from "react";
import type { CalendarBlock, FirstPick, Goal, Memory, Progress, Step } from "@/lib/day";
import type { VaultFact } from "@/lib/vault";
import type { VoiceError, VoicePhase } from "@/lib/use-voice";
import { formatTime } from "@/lib/tz";
import { SETUP, slotLabel, type Fact } from "@/components/day-flow";
import type { Booking } from "@/components/booking-chip";
import DayView, { type Chip, type DayViewProps, type Today } from "@/components/day-view";

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

// The plan with sources already found for its first open step.
const PREPPED = roadmap("done", "todo", "todo", "todo");
PREPPED.steps[1].prep = [
  { title: "How to brainstorm essay points", url: "https://example.com/brainstorm", why: "Three quick ways to find points worth arguing" },
  { title: "Outlining a history essay", url: "https://example.com/outline", why: "Shows how each point maps to one paragraph" },
];

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

const pickChips = (minutes = 5): Chip[] => [{ label: `Start · ${minutes} min`, tone: "ink" }, { label: "See the plan" }, { label: "Something else", tone: "quiet" }];

// Booking chips for the plan's later steps, around the real clock.
const block = (stepId: string, title: string, start: number, minutes: number): CalendarBlock => ({ title, kind: "step", start: at(start), end: at(start + minutes), stepId });
const offer = (key: string, b: CalendarBlock, state: Booking["state"] = "offer"): Booking => ({
  key,
  blocks: [b],
  label: `Book ${slotLabel(b.start!, b.end!, zone())}?`,
  state,
});
const BOOKINGS: Record<string, Booking> = {
  s2: offer("s2", block("s2", "List three points you want to make", 60, 10)),
  s3: offer("s3", block("s3", "Draft the opening paragraph", 1500, 15), "booked"),
  s4: offer("s4", block("s4", "Read it out loud and fix one thing", 1530, 10), "busy"),
};
const BOOKED_PLAN = roadmap("todo", "todo", "todo", "todo");
BOOKED_PLAN.steps[3].scheduledAt = at(1590);
const FOCUSED = roadmap("done", "doing", "todo", "todo");
const BOOKED_FIRST = roadmap("todo", "todo", "todo", "todo");
BOOKED_FIRST.steps[0].scheduledAt = at(1500);

const chips = (...labels: string[]): Chip[] => [...labels.map((label) => ({ label })), { label: "Something else", tone: "quiet" }];
const answers = (at: number): Chip[] =>
  SETUP[at].answers.map(([label], i) => ({ label, tone: SETUP[at].answers.length === 2 ? (i === 0 ? "ink" : "quiet") : undefined }));
const setup = (at: number): Fixture => ({
  screen: "setup",
  line: at === 0 ? `Hi Sam. ${SETUP[0].ask}` : SETUP[at].ask,
  dots: { at, of: SETUP.length },
  chips: answers(at),
});
const facts = (...texts: [string, boolean?][]): Fact[] => texts.map(([text, device], i) => ({ id: `f${i}`, text, group: "about", device: Boolean(device) }));

const NOTED = [
  { key: "m", text: "Noted: Works best right after class.", undo: () => {} },
  { key: "v", text: "Kept on this device: Mornings feel foggy lately.", undo: () => {} },
];

type Fixture = Partial<Omit<DayViewProps, "voice" | "on">> & { phase?: VoicePhase; level?: number; error?: VoiceError };

const STATES: Record<string, Fixture> = {
  "signed-out": { screen: "signed-out", line: "Zeno helps you start the thing you keep putting off." },
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
  "ready-empty": { line: "Good afternoon, Sam.", chips: [{ label: "Let's start", tone: "ink" }] },
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
  noted: {
    screen: "talk",
    line: "Got it. I'll plan the hard stuff right after class.",
    quiet: NOTED,
    chips: chips("Plan tomorrow"),
  },
  "setup-1": setup(0),
  "setup-2": setup(1),
  "setup-3": setup(2),
  "setup-4": setup(3),
  "setup-5": setup(4),
  paste: { ...setup(4), pasting: true, chips: [{ label: "Skip", tone: "quiet" }] },
  "remember-reading": {
    screen: "setup",
    line: "Here's what I learned.",
    dots: { at: SETUP.length, of: SETUP.length },
    list: facts(["Spends most days in classes."], ["Focuses best in the morning."]),
    reading: ["Reading your calendar and email…", "Reading your notes…"],
    note: "Tap × to remove anything. You can change this anytime in Memory.",
    chips: [{ label: "Start my day", tone: "ink" }],
  },
  // After the scan and pasted notes: the scan's facts first, private ones marked, more than the card holds.
  remember: {
    screen: "setup",
    line: "Here's what I learned.",
    dots: { at: SETUP.length, of: SETUP.length },
    list: facts(
      ["Takes Biology 120 on Mondays, Wednesdays and Fridays at 10 AM."],
      ["Works shifts at the campus library on Tuesday and Saturday mornings."],
      ["Mornings feel foggy lately.", true],
      ["Has a history essay draft due Friday at 11:59 PM."],
      ["Training for a 5K in December."],
      ["Focuses best in the morning."],
    ),
    note: "Tap × to remove anything. You can change this anytime in Memory.",
    offers: [
      {
        key: "import",
        blocks: [
          { title: "Bio lab report", kind: "deadline", date: dayFrom(2) },
          { title: "Email Prof Patel", kind: "todo", start: at(60), end: at(70) },
          { title: "Buy lab goggles", kind: "todo", start: at(1500), end: at(1515) },
        ],
        label: "Add these 3 to your calendar?",
        state: "offer",
      },
    ],
    chips: [{ label: "Start my day", tone: "ink" }],
  },
  "remember-booked": {
    screen: "setup",
    line: "Here's what I learned.",
    dots: { at: SETUP.length, of: SETUP.length },
    list: facts(["Takes Biology 120 on Mondays, Wednesdays and Fridays at 10 AM."], ["Focuses best in the morning."]),
    note: "Tap × to remove anything. You can change this anytime in Memory.",
    offers: [{ key: "import", blocks: [{ title: "Email Prof Patel", kind: "todo", start: at(60), end: at(70), eventId: "e1" }], label: "", state: "booked" }],
    quiet: [{ key: "import", text: "Added 3 to your Zeno calendar." }],
    chips: [{ label: "Start my day", tone: "ink" }],
  },
  talk: { screen: "talk", line: ASK, you: "my history essay, it's due Friday", phase: "listening", level: 0.7 },
  // Hands-free: the mic reopened after Zeno's question, nothing heard yet.
  "hands-free": { screen: "talk", line: "Want the tiniest first step, or a plan for the week?", chips: chips("Tiniest first step", "Plan the week"), phase: "listening", level: 0.1 },
  typing: { screen: "talk", line: ASK, typing: true },
  "typing-sent": { screen: "talk", line: "", you: "My history essay. It's due Friday.", typing: true, phase: "thinking" },
  thinking: { screen: "talk", line: "", you: "My history essay. It's due Friday.", phase: "thinking" },
  plan: {
    screen: "plan",
    goal: roadmap("done", "todo", "todo", "todo"),
    line: "Here's a plan in small steps. The first one takes ten minutes.",
  },
  // Booking chips: one to tap, one booked with Undo, one booking, and a step already on the calendar.
  "plan-booking": {
    screen: "plan",
    goal: BOOKED_PLAN,
    line: "Here's the plan. The first step takes 5 minutes.",
    bookings: { s1: offer("s1", block("s1", "Open the essay doc and write a working title", 40, 5)), ...BOOKINGS },
  },
  // A booking that failed says so on its chip.
  "plan-book-failed": {
    screen: "plan",
    goal: roadmap("todo", "todo", "todo", "todo"),
    line: "Here's the plan. The first step takes 5 minutes.",
    bookings: { s1: offer("s1", block("s1", "Open the essay doc and write a working title", 40, 5), "failed") },
  },
  // The first step is already on the calendar.
  "plan-booked-first": { screen: "plan", goal: BOOKED_FIRST, line: "Here's the plan. The first step takes 5 minutes." },
  // "See the plan" for a picked later step: that step leads, at the pick's 5 minutes.
  "plan-lead": {
    screen: "plan",
    goal: roadmap("done", "todo", "todo", "todo"),
    lead: { stepId: "s3", minutes: 5 },
    line: "Here's the plan. This step first, 5 minutes.",
  },
  // After Change the plan: Zeno's question with answers to tap.
  "plan-change": {
    screen: "plan",
    goal: roadmap("todo", "todo", "todo", "todo"),
    line: "What should change?",
    chips: [{ label: "Make step one smaller" }, { label: "Fewer steps" }, { label: "Different order" }],
  },
  "plan-permission": {
    screen: "plan",
    goal: roadmap("todo", "todo", "todo", "todo"),
    line: "Here's the plan. The first step takes 5 minutes.",
    calendarAsk: true,
  },
  prep: {
    screen: "plan",
    goal: PREPPED,
    line: "Here's a plan in small steps. The first one takes ten minutes.",
  },
  focus: { screen: "focus", goal: roadmap("done", "doing", "todo", "todo"), line: "Timer's on. 10 minutes, one thing.", checkins: true },
  // A heads-up during focus, check-ins muted.
  // The warning leads (an event 5 to 10 minutes from the real clock), halfway through the timer.
  "focus-heads-up": {
    screen: "focus",
    goal: { ...FOCUSED, steps: FOCUSED.steps.map((one) => (one.status === "doing" ? { ...one, startedAt: new Date(Date.now() - 300_000).toISOString() } : one)) },
    line: `Heads up: Bio lab at ${formatTime(new Date(Math.ceil((Date.now() + 5 * 60_000) / 300_000) * 300_000).toISOString(), zone())}.`,
    checkins: false,
  },
  // Stuck in focus: Zeno's question still has answers to tap.
  "focus-question": {
    screen: "focus",
    goal: roadmap("done", "doing", "todo", "todo"),
    line: "Want me to shrink it to one point, or find you an example?",
    chips: [{ label: "One point" }, { label: "Find an example" }],
    checkins: true,
  },
  done: { screen: "focus", goal: roadmap("done", "doing", "todo", "todo"), stamping: true },
  // After Done: straight to the next step's card, with the streak and the week.
  checkin: {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Nice. That's day 4. Next one's ready.",
    celebrate: true,
    progress: progress({ week: week(PAST, "done"), stepsThisWeek: 6 }),
    phase: "speaking",
    level: 0.35,
  },
  milestone: {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "7 days in a row. That's a real habit now.",
    celebrate: true,
    progress: progress({ streak: 7, best: 7, milestone: 7, week: week(["done", "done", "rest", "done", "done", "done"], "done"), stepsThisWeek: 9 }),
  },
  // After a break: Day 1 again, never shame. A new person's earlier days are plain dots.
  "day-one-again": {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Day 1 again. Your best is 9.",
    celebrate: true,
    progress: progress({ streak: 1, best: 9, week: week(["done", "rest", "missed", "missed", "missed", "missed"], "done"), stepsThisWeek: 1 }),
  },
  "first-day": {
    screen: "checkin",
    goal: roadmap("done", "todo", "todo", "todo"),
    line: "Day 1. That's how it starts. Next one's ready.",
    celebrate: true,
    progress: progress({ streak: 1, best: 1, week: week([], "done"), stepsThisWeek: 1, restDaysLeft: 1 }),
  },
  finished: {
    screen: "checkin",
    goal: roadmap("done", "done", "done", "done"),
    line: "That was the whole plan. Want to pick something else, or stop here?",
  },
  // "Stop for now": a wrap-up and the next step for tomorrow, one tap.
  wrap: {
    screen: "wrap",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Good place to stop. Want me to put “Draft the opening paragraph” on your calendar?",
    offers: [offer("s3", block("s3", "Draft the opening paragraph", 1500, 15))],
    chips: [{ label: "Not now", tone: "quiet" }],
  },
  // No calendar to write to: a plain goodbye, nothing to tap.
  "wrap-quiet": { screen: "wrap", goal: roadmap("done", "done", "todo", "todo"), line: "Good place to stop. See you tomorrow.", chips: [] },
  // Calendar write not allowed yet: the ask, and Not now.
  "wrap-permission": {
    screen: "wrap",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Good place to stop. Want me to put “Draft the opening paragraph” on your calendar?",
    calendarAsk: true,
    chips: [{ label: "Not now", tone: "quiet" }],
  },
  "wrap-booked": {
    screen: "wrap",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Booked. Tomorrow's streak is planned.",
    offers: [offer("s3", { ...block("s3", "Draft the opening paragraph", 1500, 15), eventId: "e2" }, "booked")],
    chips: [{ label: "Not now", tone: "quiet" }],
  },
  desk: { line: "Good afternoon, Sam.", goal: roadmap("done", "doing", "todo", "todo"), sheet: "today" },
  "desk-quiet": {
    line: "Good afternoon, Sam.",
    sheet: "today",
    today: { events: [], emails: [], unreadEmail: 0, sources: { calendar: "ok", email: "error", goals: "ok" } },
  },
  memory: { line: "Good afternoon, Sam.", sheet: "memory", device: DEVICE },
  "memory-empty": { line: "Good afternoon, Sam.", sheet: "memory", memories: [] },
  account: { line: "Good afternoon, Sam.", chips: chips("Work on my essay"), menuOpen: true, progress: progress() },
  error: { screen: "talk", line: "I couldn't think that through just now. Try again?" },
  blocked: {
    screen: "talk",
    line: ASK,
    error: "blocked",
    note: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  },
};

const noop = () => {};

export default function Gallery({ state, theme }: { state: string; theme?: "light" | "dark" }) {
  const { phase = "idle", level = 0, error = null, ...view } = STATES[state] ?? {};
  const levelRef = useRef(level);

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
        sheet={null}
        typing={false}
        stamping={false}
        leaving={null}
        note={null}
        signInFailed={false}
        busy={false}
        chips={[]}
        dots={null}
        list={null}
        pasting={false}
        hear={false}
        progress={progress()}
        account="S"
        {...view}
        voice={{ phase, levelRef, muted: false, supported: true, error }}
        on={{
          primary: noop,
          secondary: noop,
          chip: noop,
          hear: noop,
          paste: noop,
          talk: noop,
          type: noop,
          closeTyping: noop,
          send: noop,
          sheet: noop,
          forget: noop,
          remove: noop,
          add: noop,
          retryMemory: noop,
          book: noop,
          unbook: noop,
          checkins: noop,
          mute: noop,
          signIn: noop,
          signOut: noop,
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
// After setup's batch booked (a deadline and two to-dos): today's to-dos join the list and leave Free.
STATES["desk-booked"] = {
  ...STATES["desk-plans"],
  bookings: {
    import: {
      key: "import",
      label: "",
      state: "booked",
      blocks: [
        { title: "Lab report", kind: "deadline", date: dayFrom(4), eventId: "e1" },
        { title: "Buy lab goggles", kind: "todo", start: at(75), end: at(85), eventId: "e2" },
        { title: "Read chapter 4", kind: "todo", start: at(160), end: at(190), eventId: "e3" },
      ],
    },
  },
};
for (const name of WEEK_STATES) STATES[name] = { ...DESK, sheet: "week" };
