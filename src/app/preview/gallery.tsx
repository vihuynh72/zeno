"use client";

import { useRef } from "react";
import type { Goal, Step } from "@/lib/day";
import type { VoicePhase } from "@/lib/use-voice";
import DayView, { type DayViewProps, type Today } from "@/components/day-view";

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

const TODAY: Today = {
  // No offset, so the sample reads 10:00 AM and 4:30 PM in any time zone.
  events: [
    { title: "Biology lecture", start: "2026-10-29T10:00:00", end: "2026-10-29T11:15:00", allDay: false },
    { title: "Study group", start: "2026-10-29T16:30:00", end: "2026-10-29T17:30:00", allDay: false },
  ],
  unreadEmail: 2,
  sources: { calendar: "ok", email: "ok", goals: "ok" },
};

const MEMORIES = [
  { id: "m1", text: "Likes 25-minute work blocks with a short break after.", createdAt: "2026-10-27T18:00:00Z" },
  { id: "m2", text: "Thinks best in the morning, before classes.", createdAt: "2026-10-28T16:00:00Z" },
];

const ASK = "What's the one thing you keep putting off?";

type Fixture = Partial<Omit<DayViewProps, "voice" | "on">> & { phase?: VoicePhase; level?: number };

const STATES: Record<string, Fixture> = {
  "signed-out": { screen: "signed-out", line: "Zeno helps you start the thing you keep putting off." },
  ready: { line: "Good afternoon, Sam." },
  brief: {
    screen: "brief",
    line: "Afternoon, Sam. You're clear until your 4:30 study group. Want to use that hour on your essay?",
    phase: "speaking",
    level: 0.5,
  },
  talk: { screen: "talk", line: ASK, you: "my history essay, it's due Friday", phase: "listening", level: 0.7 },
  typing: { screen: "talk", line: ASK, typing: true },
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
  today: { line: "Good afternoon, Sam.", goal: roadmap("done", "doing", "todo", "todo"), sheet: "today" },
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
        {...view}
        voice={{ phase, levelRef, muted: false, supported: true }}
        on={{
          primary: noop,
          secondary: noop,
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
