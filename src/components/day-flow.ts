// Pure rules behind the Guided day screens. `node src/components/day-flow.check.ts` runs them (it maps "@/").
import { MEMORY_GROUPS, type CalendarBlock, type CanvasAssignment, type DayEvent, type FirstPick, type FreeSlot, type Goal, type MemoryGroup, type Progress, type Step, type StepStatus, type TalkAction } from "@/lib/day";
import { dayBounds, formatTime, localDate } from "@/lib/tz";

// setup is first sign-in (the scan, then what it found), ready the card, checkin the screen after Done, wrap the one
// after Stop for now or That's enough today.
export type Screen = "signed-out" | "setup" | "ready" | "talk" | "focus" | "checkin" | "wrap";

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

// Where a reply from /api/talk leaves the person: a plan made or changed shows as the card (its first step, ready to
// start); talking during focus keeps the timer's card while a step is open; anything else is talk.
export function nextScreen(screen: Screen, actions: TalkAction[], goal: Goal | null): Screen {
  const did = (type: TalkAction["type"]) => actions.some((a) => a.type === type);
  if (did("step-started") && goal?.steps.some((s) => s.status === "doing")) return "focus";
  if ((did("goal-set") || did("roadmap-changed")) && openSteps(goal).length > 0) return "ready";
  if (did("step-finished")) return "checkin";
  return screen === "focus" && openSteps(goal).length > 0 ? "focus" : "talk";
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
  const words = reply.toLowerCase().replace(/['’]/g, "").match(/[a-z]+|\d+/g) ?? [];
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

// The plan a pick makes, its first step running, shown at once while POST /api/goal saves it; the ids stand in until
// the save answers.
export function draftGoal(pick: FirstPick, now: Date): Goal {
  return {
    id: "draft",
    title: pick.goal,
    due: pick.due,
    steps: pick.steps.map((step, i) => ({
      id: `draft-${i}`,
      title: step.title,
      minutes: step.minutes,
      status: i === 0 ? "doing" : "todo",
      startedAt: i === 0 ? now.toISOString() : null,
      doneAt: null,
    })),
  };
}

// A plan made or changed in talk, as the card: its first open step, ready to start.
export function stepCard(goal: Goal | null): FirstPick | null {
  const step = openSteps(goal)[0];
  return goal && step ? { goal: goal.title, due: goal.due ?? null, stepId: step.id, steps: [{ title: step.title, minutes: step.minutes ?? 5 }], why: "" } : null;
}

// Canvas linked or unlinked in its sheet re-plans the home card, only on that card (never mid-focus, after a Done, in
// talk or after stopping): a Connect when some of what it found is still due, a Disconnect always, since the card may
// hold one of the deadlines it took away.
export const replanOnCanvas = (screen: Screen | null, linked: boolean, found: Pick<CanvasAssignment, "submitted">[]) =>
  screen === "ready" && (!linked || found.some((item) => !item.submitted));

// What the screen after Done says: the next step, or that the plan is finished.
export function doneLine(goal: Goal | null): string {
  const next = openSteps(goal)[0];
  return next ? `Nice. Next: ${next.title}${next.minutes ? `, ${next.minutes} min` : ""}` : "Nice work. That was the last step.";
}

// A step that is an email to write, so Focus offers to draft it in Gmail ("Draft an email to…", "Ask … by email"), never
// one to read ("Read the email from Dana").
export const isEmailStep = (title: string) =>
  /^(e-?mail|write to|reply to|message)\b|\b(draft|write|send|compose|answer)\b.*\be-?mail\b|\bby e-?mail\b/i.test(title.trim());

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

// "due Friday" style, from YYYY-MM-DD dates, for the card's "<goal> · due <when>" line.
export function dueLabel(due: string, today: string): string {
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  const date = new Date(`${due}T12:00:00Z`);
  const named = date.toLocaleDateString("en-US", { timeZone: "UTC", ...(days > 0 && days < 7 ? { weekday: "long" } : { month: "short", day: "numeric" }) });
  if (days < 0) return `was due ${named}`;
  return days === 0 ? "due today" : days === 1 ? "due tomorrow" : `due ${named}`;
}

// ---------- Calendar ----------

const FIVE = 5 * 60_000;

// Stopping offers one block tomorrow only for a big commitment (Vi, Nov 2): the plan's open steps add up to an hour or
// more and none of it is booked yet. The block's minutes, at most two hours, or 0 when there is nothing to offer.
export function laterMinutes(goal: Goal | null): number {
  const open = openSteps(goal);
  const total = open.reduce((sum, step) => sum + (step.minutes ?? 10), 0);
  return total >= 60 && !open[0].scheduledAt ? Math.min(total, 120) : 0;
}

// That block in tomorrow's earliest free time that fits (a 5-minute start, at least half an hour out), linked to the
// plan's first open step and named as it is saved, so the calendar says what tomorrow's card says (Vi, Nov 2); null
// when tomorrow has no room.
export function laterBlock(goal: Goal, minutes: number, slots: FreeSlot[], timeZone: string, now = new Date()): CalendarBlock | null {
  const step = openSteps(goal)[0];
  if (!step) return null;
  const tomorrow = dayBounds(timeZone, now).end;
  const dayAfter = dayBounds(timeZone, tomorrow).end.getTime();
  const from = Math.max(tomorrow.getTime(), now.getTime() + 30 * 60_000);
  for (const slot of slots) {
    const start = Math.ceil(Math.max(Date.parse(slot.start), from) / FIVE) * FIVE;
    const end = start + minutes * 60_000;
    if (start < dayAfter && end <= Date.parse(slot.end)) {
      return { title: step.title, kind: "step", start: new Date(start).toISOString(), end: new Date(end).toISOString(), stepId: step.id };
    }
  }
  return null;
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

// ---------- Focus check-ins ----------

export const CHECKINS = {
  start: (minutes: number) =>
    minutes === 5 ? "Timer's on. Just five minutes." : `Timer's on. ${minutes} ${minutes === 1 ? "minute" : "minutes"}, one thing.`,
  half: "Halfway there.",
  end: "Time's up. Done, or stuck?",
};

// ---------- Memory ----------

export type Fact = { id: string; text: string; group: MemoryGroup; device: boolean };

// What first sign-in's scan learned, said in one line without the model. The scan files exams and deadlines under
// projects with undated projects, so a deadline is a projects fact that names a day.
const DATED = /\bdue\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i;
export function foundLine(facts: { group: MemoryGroup; text: string }[]): string {
  if (facts.length === 0) return "I couldn't find much yet. I'll learn as you go.";
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const deadlines = facts.filter((fact) => fact.group === "projects" && DATED.test(fact.text)).length;
  return `I read your calendar and email and learned ${count(facts.length, "thing")}${deadlines ? `, including ${count(deadlines, "deadline")}` : ""}.`;
}

// Memory's Add box: a line break, or more than one memory's 200 characters, is pasted notes (POST /api/import).
export const isNotes = (text: string) => text.includes("\n") || [...text].length > 200;

// The Memory sheet's groups in order, each with its plain name; empty groups are left out.
export function groupFacts(facts: Fact[]): { group: MemoryGroup; name: string; facts: Fact[] }[] {
  const groupOf = (fact: Fact) => (MEMORY_GROUPS.includes(fact.group) ? fact.group : "about");
  return MEMORY_GROUPS.map((group) => ({ group, name: GROUP_NAMES[group], facts: facts.filter((fact) => groupOf(fact) === group) })).filter(
    (entry) => entry.facts.length > 0,
  );
}
