// Pure rules behind the Guided day screens. `node src/components/day-flow.check.ts` runs them (it maps "@/").
import { MEMORY_GROUPS, type CalendarBlock, type DayEvent, type FirstPick, type FreeSlot, type Goal, type MemoryGroup, type Progress, type Step, type StepStatus, type TalkAction } from "@/lib/day";
import { dayBounds, formatTime, localDate } from "@/lib/tz";

export type Screen = "signed-out" | "setup" | "ready" | "talk" | "plan" | "focus" | "checkin" | "wrap";

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
  wrap: 3,
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

// The plain names the Memory sheet shows, in MEMORY_GROUPS order (docs/PLAN-NOV.md).
export const GROUP_NAMES: Record<MemoryGroup, string> = {
  about: "About you",
  routines: "Routines",
  projects: "Projects & deadlines",
  interests: "Interests & goals",
  people: "People",
  "work-style": "How you work best",
  patterns: "Patterns Zeno noticed",
};

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
  if ((screen === "plan" || screen === "focus" || screen === "checkin") && openSteps(goal).length === 0) return "talk";
  return screen === "ready" || screen === "wrap" ? "talk" : screen;
}

// A saved line comes back only on the same date and part of the day, so a morning line never greets the evening.
export function dayPart(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${greeting(date.getHours(), null)}`;
}

// Words that, on their own, only say yes to a booking offer ("Yes, book it", "Sounds good", "Lock it in"); a reply
// with any other word ("not", "later", a time) means more than yes.
const YES_WORDS = new Set(
  "yes yeah yep yup sure ok okay alright cool sounds good great perfect works absolutely definitely please thanks thank you thing lets do go ahead it that this for me book block add schedule lock in put on to my calendar".split(" "),
);
const onlyYes = (reply: string) => {
  const words = reply.toLowerCase().replace(/['’]/g, "").match(/[a-z]+/g) ?? [];
  return words.length > 0 && words.every((word) => YES_WORDS.has(word));
};

// Quick replies as the server sent them, kept to three short non-empty strings whatever arrives. Beside a booking
// offer its chip is the one way to book, so replies that only say yes go and two stay (three chips with Something else).
export function quickReplies(options: unknown, offered = false): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((o): o is string => typeof o === "string" && o.trim() !== "")
    .map((o) => o.trim().slice(0, 80))
    // Chips are keyed by label and the card adds its own "Something else", so no label may repeat.
    .filter((o, i, all) => all.indexOf(o) === i && !/^something else\W*$/i.test(o) && !(offered && onlyYes(o)))
    .slice(0, offered ? 2 : 3);
}

// Whether a spoken line asks something, so hands-free listening opens the mic after it.
export const asks = (line: string) => /\?["'”’)]*$/.test(line.trim());

// Longer lines get a smaller hand so a reply still fits the card.
export function cardSize(text: string): "l" | "m" | "s" {
  return text.length <= 90 ? "l" : text.length <= 160 ? "m" : "s";
}

// 9:05 style countdown, never below 0:00.
export function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- The first card ----------

// A saved first card is still good when its step is still open or, for a new plan, while nothing else is open.
export function pickFits(pick: FirstPick | null | undefined, goal: Goal | null): boolean {
  if (!pick) return false;
  const open = openSteps(goal);
  return pick.stepId ? open.some((step) => step.id === pick.stepId) : open.length === 0;
}

// The plan a pick makes, shown at once while POST /api/goal saves it; the ids stand in until the save answers.
export function draftGoal(pick: FirstPick, start: boolean, now: Date): Goal {
  return {
    id: "draft",
    title: pick.goal,
    due: pick.due,
    steps: pick.steps.map((step, i) => ({
      id: `draft-${i}`,
      title: step.title,
      minutes: step.minutes,
      status: start && i === 0 ? "doing" : "todo",
      startedAt: start && i === 0 ? now.toISOString() : null,
      doneAt: null,
    })),
  };
}

export const isDraft = (goal: Goal | null) => goal?.id === "draft";

// One step's new status, as the server will save it, so a tap shows at once.
export function withStatus(goal: Goal, stepId: string, status: StepStatus, now: Date): Goal {
  const at = now.toISOString();
  return {
    ...goal,
    steps: goal.steps.map((step) =>
      step.id === stepId
        ? { ...step, status, startedAt: status === "doing" ? at : status === "todo" ? null : step.startedAt, doneAt: status === "done" ? at : step.doneAt }
        : status === "doing" && step.status === "doing"
          ? { ...step, status: "todo", startedAt: null }
          : step,
    ),
  };
}

// "Due Friday" style (short: "Due Fri"), from YYYY-MM-DD dates.
export function dueLabel(due: string, today: string, short = false): string {
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  const date = new Date(`${due}T12:00:00Z`);
  const weekday = short ? "short" : "long";
  const named = date.toLocaleDateString("en-US", { timeZone: "UTC", ...(days > 0 && days < 7 ? { weekday } : { month: "short", day: "numeric" }) });
  if (days < 0) return `Was due ${named}`;
  return days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due ${named}`;
}

// ---------- Calendar ----------

const FIVE = 5 * 60_000;

// Free time for each step still to book, in order, never overlapping: each gets the earliest gap that fits it
// after the one before, starting at least half an hour out (rounded to 5 minutes). A step that fits nowhere gets none.
export function planBlocks(steps: Step[], slots: FreeSlot[], now = new Date()): CalendarBlock[] {
  const gaps = slots.map((slot) => ({ start: Date.parse(slot.start), end: Date.parse(slot.end) })).filter((gap) => gap.end > gap.start);
  let cursor = now.getTime() + 30 * 60_000;
  const blocks: CalendarBlock[] = [];
  for (const step of steps) {
    if (step.scheduledAt || (step.status !== "todo" && step.status !== "doing")) continue;
    const length = (step.minutes ?? 10) * 60_000;
    for (const gap of gaps) {
      const start = Math.ceil(Math.max(gap.start, cursor) / FIVE) * FIVE;
      if (start + length > gap.end) continue;
      blocks.push({ title: step.title, kind: "step", start: new Date(start).toISOString(), end: new Date(start + length).toISOString(), stepId: step.id });
      cursor = start + length;
      break;
    }
  }
  return blocks;
}

// For "Stop for now": the next step's block in tomorrow's earliest free time, or the earliest when tomorrow has none.
export function laterBlock(step: Step, slots: FreeSlot[], timeZone: string, now = new Date()): CalendarBlock | null {
  const tomorrow = dayBounds(timeZone, now).end.getTime();
  const later = slots.filter((slot) => Date.parse(slot.end) > tomorrow).map((slot) => ({ ...slot, start: new Date(Math.max(Date.parse(slot.start), tomorrow)).toISOString() }));
  return planBlocks([step], later.length > 0 ? later : slots, now)[0] ?? null;
}

export function isTomorrow(iso: string, timeZone: string, now = new Date()) {
  return localDate(timeZone, new Date(iso)) === localDate(timeZone, dayBounds(timeZone, now).end);
}

const dayWord = (iso: string, timeZone: string, now: Date) =>
  localDate(timeZone, new Date(iso)) === localDate(timeZone, now)
    ? ""
    : `${isTomorrow(iso, timeZone, now) ? "tomorrow" : new Date(iso).toLocaleDateString("en-US", { timeZone, weekday: "short" })} `;

// "9:30–9:40 AM", "tomorrow 9:30–9:40 AM" or "Mon 9:30–9:40 AM".
export function slotLabel(start: string, end: string, timeZone: string, now = new Date()): string {
  const [from, to] = [formatTime(start, timeZone), formatTime(end, timeZone)];
  const same = from.slice(-2) === to.slice(-2);
  return `${dayWord(start, timeZone, now)}${same ? from.slice(0, -3) : from}–${to}`;
}

// "9:30 AM", "tomorrow 9:30 AM" or "Mon 9:30 AM", for a booked step.
export const whenLabel = (iso: string, timeZone: string, now = new Date()) => `${dayWord(iso, timeZone, now)}${formatTime(iso, timeZone)}`;

// The first of today's timed events starting in the next `within` ms (not already started).
export function soonEvent(events: DayEvent[], now: number, within = 10 * 60_000): DayEvent | null {
  return events.find((event) => !event.allDay && Date.parse(event.start) > now && Date.parse(event.start) - now <= within) ?? null;
}

// ---------- Streaks ----------

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function streakLine(progress: Progress) {
  const steps = progress.stepsThisWeek;
  return `Day ${progress.streak} · ${steps} ${steps === 1 ? "step" : "steps"} this week`;
}

// What Zeno says after a Done: a milestone, a restart after a break (never shame), the day's first step, or another.
export function doneLine(before: Progress | null, after: Progress | undefined, more: boolean): string {
  const next = more ? " Next one's ready." : "";
  if (!after) return `Nice.${next}`;
  if (after.milestone) return `${after.milestone} days in a row. That's a real habit now.`;
  const already = before?.week.includes("done") && before.week.indexOf("today") === -1;
  if (already || after.streak === 0) return `Nice, another one down.${next}`;
  if (after.streak === 1 && after.best > 1) return `Day 1 again. Your best is ${after.best}.`;
  return after.streak === 1 ? `Day 1. That's how it starts.${next}` : `Nice. That's day ${after.streak}.${next}`;
}

// ---------- Focus check-ins ----------

export const CHECKINS = {
  start: (minutes: number) =>
    minutes === 5 ? "Timer's on. Just five minutes." : `Timer's on. ${minutes} ${minutes === 1 ? "minute" : "minutes"}, one thing.`,
  half: "Halfway there.",
  end: "Time's up. Done, or stuck?",
};

// ---------- Memory ----------

export type Fact = { id: string; text: string; group: MemoryGroup; device: boolean };

// Setup's "Here's what I learned" leads with what helps plan a day; the Memory sheet keeps MEMORY_GROUPS order.
const PLANNING: MemoryGroup[] = ["projects", "routines", "work-style", "interests", "people", "about", "patterns"];
const planningRank = (fact: Fact) => (PLANNING.includes(fact.group) ? PLANNING.indexOf(fact.group) : PLANNING.indexOf("about"));
export const forPlanning = (facts: Fact[]) => [...facts].sort((a, b) => planningRank(a) - planningRank(b));

// The Memory sheet's groups in order, each with its plain name; empty groups are left out.
export function groupFacts(facts: Fact[]): { group: MemoryGroup; name: string; facts: Fact[] }[] {
  const groupOf = (fact: Fact) => (MEMORY_GROUPS.includes(fact.group) ? fact.group : "about");
  return MEMORY_GROUPS.map((group) => ({ group, name: GROUP_NAMES[group], facts: facts.filter((fact) => groupOf(fact) === group) })).filter(
    (entry) => entry.facts.length > 0,
  );
}
