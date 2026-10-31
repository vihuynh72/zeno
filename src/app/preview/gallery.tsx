"use client";

import { useRef } from "react";
import type { Goal, Step } from "@/lib/day";
import type { VoicePhase } from "@/lib/use-voice";
import { SETUP } from "@/components/day-flow";
import DayView, { type Chip, type DayViewProps, type Today } from "@/components/day-view";

// Sample data only: no network calls, nothing real.
const step = (id: string, title: string, minutes: number, status: Step["status"]): Step => ({
  id,
  title,
  minutes,
  status,
  startedAt: null,
  doneAt: null,
});

const roadmap = (...statuses: Step["status"][]): Goal => ({
  id: "sample-goal",
  title: "History essay draft",
  steps: [
    step("s1", "Open the essay doc and write a working title", 5, statuses[0]),
    step("s2", "List three points you want to make", 10, statuses[1]),
    step("s3", "Draft the opening paragraph", 15, statuses[2]),
    step("s4", "Read it out loud and fix one thing", 10, statuses[3]),
  ],
});

// Around the real clock (to the half hour), so the desk shows a past, a current and a later event.
const at = (minutes: number) => new Date(Math.floor(Date.now() / 1_800_000) * 1_800_000 + minutes * 60_000).toISOString();

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

const MEMORIES = [
  { id: "m1", text: "Likes 25-minute work blocks with a short break after.", createdAt: "2026-10-27T18:00:00Z" },
  { id: "m2", text: "Thinks best in the morning, before classes.", createdAt: "2026-10-28T16:00:00Z" },
];

const ASK = "What's the one thing you keep putting off?";

const chips = (...labels: string[]): Chip[] => [...labels.map((label) => ({ label })), { label: "Something else", tone: "quiet" }];
const answers = (at: number): Chip[] =>
  SETUP[at].answers.map(([label], i) => ({ label, tone: SETUP[at].answers.length === 2 ? (i === 0 ? "ink" : "quiet") : undefined }));
const setup = (at: number): Fixture => ({
  screen: "setup",
  line: at === 0 ? `Hi Sam. ${SETUP[0].ask}` : SETUP[at].ask,
  dots: { at, of: SETUP.length },
  chips: answers(at),
});

type Fixture = Partial<Omit<DayViewProps, "voice" | "on">> & { phase?: VoicePhase; level?: number };

const STATES: Record<string, Fixture> = {
  "signed-out": { screen: "signed-out", line: "Zeno helps you start the thing you keep putting off." },
  // The very first paint: the card and the browser's greeting, before the day loads.
  shell: { screen: null, line: "Good afternoon." },
  ready: {
    line: "Good afternoon, Sam. You're clear until your 4:30 study group.",
    chips: chips("Work on my essay", "Plan my afternoon", "Help me pick one thing"),
    streak: 3,
  },
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
  "setup-1": setup(0),
  "setup-2": setup(1),
  "setup-3": setup(2),
  "setup-4": setup(3),
  "setup-5": setup(4),
  paste: { ...setup(4), pasting: true, chips: [{ label: "Skip", tone: "quiet" }] },
  remember: {
    screen: "setup",
    line: "Here's what I'll remember.",
    dots: { at: SETUP.length, of: SETUP.length },
    list: ["Spends most days in classes.", "Focuses best in the morning.", "Starting is hard when a task feels too big.", "Reading your notes…"],
    note: "You can change this anytime in Memory.",
    chips: [{ label: "Start my day", tone: "ink" }],
  },
  talk: { screen: "talk", line: ASK, you: "my history essay, it's due Friday", phase: "listening", level: 0.7 },
  typing: { screen: "talk", line: ASK, typing: true },
  "typing-sent": { screen: "talk", line: "", you: "My history essay. It's due Friday.", typing: true, phase: "thinking" },
  thinking: { screen: "talk", line: "", you: "My history essay. It's due Friday.", phase: "thinking" },
  plan: {
    screen: "plan",
    goal: roadmap("done", "todo", "todo", "todo"),
    line: "Here's a plan in small steps. The first one takes ten minutes.",
  },
  focus: { screen: "focus", goal: roadmap("done", "doing", "todo", "todo") },
  done: { screen: "focus", goal: roadmap("done", "doing", "todo", "todo"), stamping: true },
  checkin: {
    screen: "checkin",
    goal: roadmap("done", "done", "todo", "todo"),
    line: "Nice, two down. Ready to draft the opening paragraph?",
    phase: "speaking",
    level: 0.35,
  },
  finished: {
    screen: "checkin",
    goal: roadmap("done", "done", "done", "done"),
    line: "That was the whole plan. Want to pick something else, or stop here?",
  },
  desk: { line: "Good afternoon, Sam.", goal: roadmap("done", "doing", "todo", "todo"), sheet: "today" },
  "desk-quiet": {
    line: "Good afternoon, Sam.",
    sheet: "today",
    today: { events: [], emails: [], unreadEmail: 0, sources: { calendar: "ok", email: "error", goals: "ok" } },
  },
  memory: { line: "Good afternoon, Sam.", sheet: "memory" },
  "memory-empty": { line: "Good afternoon, Sam.", sheet: "memory", memories: [] },
  error: { screen: "talk", line: "I couldn't think that through just now. Try again?" },
  blocked: {
    screen: "talk",
    line: ASK,
    note: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  },
};

const noop = () => {};

export default function Gallery({ state, theme }: { state: string; theme?: "light" | "dark" }) {
  const { phase = "idle", level = 0, ...view } = STATES[state] ?? {};
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
        streak={0}
        {...view}
        voice={{ phase, levelRef, muted: false, supported: true }}
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
          retryMemory: noop,
          mute: noop,
          signIn: noop,
          signOut: noop,
        }}
      />
    </div>
  );
}
