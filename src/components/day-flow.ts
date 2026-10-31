// Pure rules behind the Guided day screens. Type-only imports, so `node src/components/day-flow.check.ts` runs it.
import type { Goal, Step, TalkAction } from "@/lib/day";

export type Screen = "signed-out" | "setup" | "ready" | "talk" | "plan" | "focus" | "checkin";

export const STAGES = ["Brief", "Pick one thing", "First step", "Focus"];

// Which STAGES entry each screen lights up; signed-out and setup (it has its own dots) light none.
export const STAGE_OF: Record<Screen, number> = {
  "signed-out": -1,
  setup: -1,
  ready: 0,
  talk: 1,
  plan: 2,
  focus: 3,
  checkin: 3,
};

// First-run cards, each answered with one tap; an answer with a sentence saves it as a memory.
// The first question follows "Hi {name}."; the last card's first answer opens a box for pasted notes.
export const SETUP: { ask: string; answers: [label: string, memory: string | null][] }[] = [
  {
    ask: "I'm Zeno. I help you start the thing you keep putting off. Thirty seconds to set me up?",
    answers: [
      ["Let's go", null],
      ["Skip", null],
    ],
  },
  {
    ask: "What fills most of your days?",
    answers: [
      ["Classes", "Spends most days in classes."],
      ["Work", "Spends most days at work."],
      ["Both", "Splits most days between classes and work."],
      ["Something else", null],
    ],
  },
  {
    ask: "When do you focus best?",
    answers: [
      ["Mornings", "Focuses best in the morning."],
      ["Afternoons", "Focuses best in the afternoon."],
      ["Evenings", "Focuses best in the evening."],
      ["Late at night", "Focuses best late at night."],
    ],
  },
  {
    ask: "What makes starting hard?",
    answers: [
      ["It feels too big", "Starting is hard when a task feels too big."],
      ["I don't know where to begin", "Starting is hard when it's unclear where to begin."],
      ["I get distracted", "Gets distracted easily when starting."],
      ["Low energy", "Starting is hard when energy is low."],
    ],
  },
  {
    ask: "Anything else I should know? Paste a syllabus, a to-do list or notes and I'll pull out what matters.",
    answers: [
      ["Paste notes", null],
      ["Skip", null],
    ],
  },
];

// Before 5 AM it is still the night before for most people, not morning.
export function greeting(hour: number, firstName: string | null) {
  const who = firstName ? `, ${firstName}` : "";
  if (hour < 5) return `Still up${who}?`;
  return `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${who}.`;
}

// The step being done comes first, then the rest still to do, in roadmap order.
export function openSteps(goal: Goal | null): Step[] {
  const steps = goal?.steps ?? [];
  return [...steps.filter((s) => s.status === "doing"), ...steps.filter((s) => s.status === "todo")];
}

// Where a reply from /api/talk leaves the person.
export function nextScreen(screen: Screen, actions: TalkAction[], goal: Goal | null): Screen {
  const did = (type: TalkAction["type"]) => actions.some((a) => a.type === type);
  if (did("step-started") && goal?.steps.some((s) => s.status === "doing")) return "focus";
  if ((did("goal-set") || did("roadmap-changed")) && openSteps(goal).length > 0) return "plan";
  if (did("step-finished")) return "checkin";
  // No step left to show (the goal was cleared or emptied): back to talking it through.
  if ((screen === "plan" || screen === "focus") && openSteps(goal).length === 0) return "talk";
  return screen === "ready" ? "talk" : screen;
}

// A saved line comes back only on the same date and part of the day, so a morning line never greets the evening.
export function dayPart(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${greeting(date.getHours(), null)}`;
}

// Quick replies as the server sent them, kept to three short non-empty strings whatever arrives.
export function quickReplies(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((o): o is string => typeof o === "string" && o.trim() !== "")
    .map((o) => o.trim().slice(0, 80))
    .slice(0, 3);
}

export type SayMode = "all" | "fade" | "pace" | "wait";

// How Zeno's line shows: the first at once, a new one faded in, hidden while Zeno thinks, word by word as Zeno says it.
// A line already on screen keeps its look when Zeno starts or stops saying it, so it never blinks or types itself again.
export function sayMode(shown: { line: string; mode: SayMode }, line: string, speaking: boolean, thinking: boolean): SayMode {
  if (line !== shown.line) return speaking ? "pace" : thinking ? "wait" : shown.line || shown.mode !== "all" ? "fade" : "all";
  if (shown.mode === "wait") return speaking ? "pace" : thinking ? "wait" : "fade";
  if (shown.mode === "pace") return speaking ? "pace" : "all";
  return shown.mode;
}

// Longer lines get a smaller hand so a reply still fits the card.
export function cardSize(text: string): "l" | "m" | "s" {
  return text.length <= 90 ? "l" : text.length <= 160 ? "m" : "s";
}

// 9:05 style countdown, never below 0:00.
export function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
