// The Week as a light plan (Vi, Nov 4, "Both"): the days behind show what she finished, the days ahead spread her open
// steps, never booked on the calendar. Rules only, no model; only desk-rows.ts, goal-rows.ts and tz.ts besides types, so
// week-plan.check.ts runs it in plain node.
import type { DoneStep, Goal, Step } from "@/lib/day";
import { addDays, mondayOf } from "@/components/desk-rows";
import { sameGoal } from "@/components/goal-rows";
import { formatTime, localDate } from "@/lib/tz";

export type PlanEvent = { title: string; start: string; end: string; allDay: boolean };
export type PlanItem =
  | { kind: "done"; goal: string; title: string; minutes: number | null }
  | { kind: "event"; title: string; time: string | null }
  | { kind: "due"; goal: Goal }
  | { kind: "rest"; goal: Goal }
  | { kind: "step"; goal: Goal; step: Step };
export type PlanDay = { date: string; items: PlanItem[] };

const SHOWN = 10; // Monday to Sunday, then the next Monday to Wednesday
const UNTIMED = 20; // what a step with no minutes counts for against the day's hour
const COUNT = "(\\d+|once|twice|one|two|three|four|five|six|seven)";
const NUMBERS: Record<string, number> = { once: 1, one: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

const open = (goal: Goal) => goal.steps.filter((step) => step.status === "todo" || step.status === "doing");
const daysFrom = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const weekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());

// "20m", "1h", "1h 30m".
export const mins = (minutes: number) => (minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`);

// A goal named in one word where its title has one: a course code or a distance ("Write the PHIL 134 paper" is PHIL,
// "Run a 5K" is 5K); otherwise the whole title.
export const goalTag = (title: string) =>
  title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .find((word) => /^[A-Z0-9]{2,}$/.test(word) && /[A-Z]/.test(word)) ?? title;

// "PHIL: Outline reasons"; a step named as its goal is written once ("Call the bank").
export const stepLabel = (goal: string, step: string) => (goal.trim().toLowerCase() === step.trim().toLowerCase() ? step : `${goalTag(goal)}: ${step}`);

// Days between sessions: "3 runs a week" every 2nd day, "twice a week" every 4th, "daily" every day; a rhythm with no
// count reads as every 2nd day.
export function gapOf(rhythm: string) {
  const text = rhythm.toLowerCase();
  if (/daily|every ?day|each day|a day\b/.test(text)) return 1;
  const match =
    new RegExp(`${COUNT}(?:\\s*x|\\s+times|\\s+\\w+)?\\s+(?:a|per|each|every)\\s+week`).exec(text) ?? new RegExp(`${COUNT}\\s*(?:x|times)\\b`).exec(text);
  const count = match ? Number(match[1]) || NUMBERS[match[1]] : 0;
  return count ? Math.max(1, Math.round(7 / Math.min(7, count))) : 2;
}

// Monday to Sunday of `today`'s week, then the next three days. Days before today list the steps finished on them (the
// zone's clock); today and after list events, the goals due, and the plan, in that order:
// - a goal with a due date spreads its open steps evenly over today to the day before it, in order, soonest due first;
// - a goal that keeps going (rhythm) gets a session every gapOf days from its last one, and "rest day" the day after each;
// - any other goal takes one step a weekday until its steps run out.
// A day holds about an hour of steps across goals (less with 3 or more timed events); a step that doesn't fit moves to
// the next day with room, but never onto its due date, and a day with nothing planned always takes one.
export function planWeek(goals: Goal[], events: PlanEvent[], done: DoneStep[], today: string, timeZone: string): PlanDay[] {
  const dates = Array.from({ length: SHOWN }, (_, i) => addDays(mondayOf(today), i));
  const day = new Map(dates.map((date) => [date, { done: [] as PlanItem[], events: [] as PlanItem[], due: [] as PlanItem[], steps: [] as PlanItem[], rest: [] as PlanItem[] }]));
  const load = new Map<string, number>();
  const timed = events.filter((event) => !event.allDay);
  const room = (date: string) => {
    const count = timed.filter((event) => localDate(timeZone, new Date(event.start)) === date).length;
    return count >= 5 ? 20 : count >= 3 ? 40 : 60;
  };
  const cost = (step: Step) => step.minutes ?? UNTIMED;
  const fits = (date: string, step: Step) => !load.get(date) || load.get(date)! + cost(step) <= room(date);
  // Steps past the shown days still count, so later goals spread the same whatever is on screen.
  const place = (date: string, goal: Goal, step: Step) => {
    load.set(date, (load.get(date) ?? 0) + cost(step));
    day.get(date)?.steps.push({ kind: "step", goal, step });
  };

  for (const step of [...done].sort((a, b) => Date.parse(a.doneAt) - Date.parse(b.doneAt))) {
    day.get(localDate(timeZone, new Date(step.doneAt)))?.done.push({ kind: "done", goal: step.goal, title: step.title, minutes: step.minutes });
  }
  for (const event of [...events].sort((a, b) => Number(b.allDay) - Number(a.allDay) || Date.parse(a.start) - Date.parse(b.start))) {
    // An all-day event runs from its start date up to its end date; a due marker for a goal due that day is left to the goal.
    const on = event.allDay
      ? dates.filter((date) => event.start.slice(0, 10) <= date && date < event.end.slice(0, 10))
      : [localDate(timeZone, new Date(event.start))];
    for (const date of on.filter((date) => date >= today)) {
      if (event.allDay && goals.some((goal) => goal.due === date && sameGoal(goal.title, event.title))) continue;
      day.get(date)?.events.push({ kind: "event", title: event.title, time: event.allDay ? null : formatTime(event.start, timeZone) });
    }
  }
  for (const goal of goals) if (goal.due && goal.due >= today) day.get(goal.due)?.due.push({ kind: "due", goal });

  for (const goal of goals.filter((goal) => goal.due && !goal.rhythm).sort((a, b) => a.due!.localeCompare(b.due!))) {
    const steps = open(goal);
    const span = Math.max(1, daysFrom(today, goal.due!)); // today up to the day before it's due
    let earliest = 0;
    steps.forEach((step, i) => {
      const even = Math.max(earliest, Math.floor((i * span) / steps.length));
      let at = even;
      while (at < span - 1 && !fits(addDays(today, at), step)) at++;
      if (!fits(addDays(today, at), step)) at = even; // no room before it's due: its even day, over the hour
      place(addDays(today, at), goal, step);
      earliest = at;
    });
  }

  // Sessions keep their spacing whatever the day holds; they still count toward its hour.
  for (const goal of goals.filter((goal) => goal.rhythm)) {
    const gap = gapOf(goal.rhythm!);
    const last = goal.steps
      .flatMap((step) => (step.status === "done" && step.doneAt ? [localDate(timeZone, new Date(step.doneAt))] : []))
      .sort()
      .at(-1);
    const sessions = last ? [last] : [];
    let date = last && addDays(last, gap) > today ? addDays(last, gap) : today;
    for (const step of open(goal)) {
      place(date, goal, step);
      sessions.push(date);
      date = addDays(date, gap);
    }
    if (gap > 1) {
      for (const rest of sessions.map((session) => addDays(session, 1))) {
        if (rest >= today && !sessions.includes(rest)) day.get(rest)?.rest.push({ kind: "rest", goal });
      }
    }
  }

  for (const goal of goals.filter((goal) => !goal.due && !goal.rhythm)) {
    const steps = open(goal);
    for (let date = today, next = 0; next < steps.length && date <= dates[SHOWN - 1]; date = addDays(date, 1)) {
      if (!weekend(date) && fits(date, steps[next])) place(date, goal, steps[next++]);
    }
  }

  return dates.map((date) => {
    const { done, events, due, steps, rest } = day.get(date)!;
    return { date, items: [...done, ...events, ...due, ...steps, ...rest] };
  });
}
