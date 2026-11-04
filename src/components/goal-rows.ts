// Pure rules behind the Desk's goal rows (the Goals and Deadlines cards and the Week, Vi, Nov 3). Only desk-rows.ts and
// tz.ts besides types, so goal-rows.check.ts runs in plain node.
import type { Deadline, DoneStep, Goal } from "@/lib/day";
import { addDays, dateLabel, freeGaps, layoutDay, wallMinutes } from "@/components/desk-rows";
import { localDate } from "@/lib/tz";

// Lowercase, with every run of characters that are not letters or digits made one space.
const words = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Two titles name the same goal when either contains the other (Vi, Nov 3); a title with no letters or digits never does.
export function sameGoal(a: string, b: string) {
  const [x, y] = [words(a), words(b)];
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
}

// The steps not done yet, the running one too.
const left = (goal: Goal) => goal.steps.filter((step) => step.status === "todo" || step.status === "doing");

// The Desk's plans: the current one as fresh as the page has it (so a plan made since the day loaded joins, and a day
// saved before Nov 3, which lists none, still shows it), and the other open plans, in the goals sidebar's order: by due
// date, undated last, then by title (round 2, Nov 4: Today listed a goal due Nov 12 above one due Friday). Only plans
// with a step left, or that keep going (a rhythm goal waiting for its next few).
export function deskPlans(goal: Goal | null, goals: Goal[] | undefined): Goal[] {
  const byDue = (a: Goal, b: Goal) => (a.due === b.due ? 0 : !a.due ? 1 : !b.due ? -1 : a.due < b.due ? -1 : 1);
  return [...(goal ? [goal] : []), ...(goals ?? []).filter((plan) => plan.id !== goal?.id)]
    .filter((plan) => left(plan).length > 0 || plan.rhythm)
    .sort((a, b) => byDue(a, b) || a.title.localeCompare(b.title));
}

export type Segment = "done" | "next" | "todo";

// One segment per step: done ones filled, the one running (else the next to do) outlined, the rest empty. Only finished
// steps fill the bar (Nov 4: a red next step read as progress at 0 done).
export function segments(goal: Goal): Segment[] {
  const next = goal.steps.find((step) => step.status === "doing") ?? goal.steps.find((step) => step.status === "todo");
  return goal.steps.map((step) => (step.status === "done" ? "done" : step === next ? "next" : "todo"));
}

// Today's line for a goal: what to do next ("Next: Find the readings · 20 min"), so Today says what to do, not only how
// far along (round 2, Nov 4: "just a copy of the sidebar"). A goal that keeps going with no session left, and a finished
// one, say so instead.
export function nextCaption(goal: Goal) {
  const next = goal.steps.find((step) => step.status === "doing") ?? goal.steps.find((step) => step.status === "todo");
  if (!next) return goal.rhythm ? "Next few to plan" : doneCaption(goal);
  return `${next.status === "doing" ? "Now" : "Next"}: ${next.title.replace(/\.+$/, "")}${next.minutes ? ` · ${duration(next.minutes)}` : ""}`;
}

// "2 of 5 done"; none in words, since both Atkinson fonts slash their zero and a lone "Ø of 5" was misread (Nov 4).
export function doneCaption(goal: Goal) {
  const done = goal.steps.filter((step) => step.status === "done").length;
  return `${done || "None"} of ${goal.steps.length} done`;
}

// "due today", "due tomorrow", "due Fri" within a week, else "due Nov 12"; "was due Mon" once it has passed.
export function dueShort(due: string, today: string) {
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  const named = dateLabel(due, Math.abs(days) < 7 ? { weekday: "short" } : { month: "short", day: "numeric" });
  return `${days < 0 ? "was due" : "due"} ${named}`;
}

// "45 min", "1 h", "2 h 5 min".
export function duration(minutes: number) {
  const [hours, rest] = [Math.floor(minutes / 60), minutes % 60];
  return hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const stepsLeft = (count: number) => `${count} ${count === 1 ? "step" : "steps"} left`;

// "4 steps left · about 1 h 30 min": the steps not done yet and their planned minutes.
export function leftCaption(goal: Goal) {
  const steps = left(goal);
  if (steps.length === 0) return goal.rhythm ? "Next few to plan" : "All steps done";
  const minutes = steps.reduce((sum, step) => sum + (step.minutes ?? 0), 0);
  return minutes > 0 ? `${stepsLeft(steps.length)} · about ${duration(minutes)}` : stepsLeft(steps.length);
}

// "4 steps left" alone: a deadline's day says what is left without hours of work, since nothing is planned on it yet.
export function stepsLeftCaption(goal: Goal) {
  const count = left(goal).length;
  return count === 0 ? (goal.rhythm ? "Next few to plan" : "All steps done") : stepsLeft(count);
}

// "42 days · 4 steps left": a plan due after the week on screen, its days counted from today.
export function comingCaption(goal: Goal, today: string) {
  const days = Math.round((Date.parse(goal.due ?? "") - Date.parse(today)) / 86_400_000);
  return `${days} ${days === 1 ? "day" : "days"} · ${stepsLeft(left(goal).length)}`;
}

// Free minutes between 8 AM and 10 PM on `date` (from `now` on, today), from that day's timed events, in whole quarter
// hours; gaps under 15 minutes don't count. null once the window is over (a past day, or today after 10 PM).
export function freeMinutes(events: { start: string; end: string; allDay: boolean }[], date: string, timeZone: string, now: number) {
  const from = Math.max(8 * 60, wallMinutes(now, date, timeZone));
  const to = 22 * 60;
  if (from >= to) return null;
  const free = freeGaps(layoutDay(events, date, timeZone), from, to).reduce((sum, gap) => sum + gap.bottom - gap.top, 0);
  return Math.floor(free / 15) * 15;
}

// The finished steps of these plans, as the Week lists them. Minutes are real ones, from Start to Done, and only when
// believable (1 to 360, as paceOf trusts them).
export function doneSteps(goals: Goal[]): DoneStep[] {
  return goals.flatMap((goal) =>
    goal.steps.flatMap((step) => {
      if (step.status !== "done" || !step.doneAt) return [];
      const real = step.startedAt ? Math.round((Date.parse(step.doneAt) - Date.parse(step.startedAt)) / 60_000) : NaN;
      return [{ title: step.title, goal: goal.title, doneAt: step.doneAt, minutes: real >= 1 && real <= 360 ? real : null }];
    }),
  );
}

// The day's finished steps (doneThisWeek: this week's, finished plans' too) and the page's own plans' (fresh, so a step
// finished since the day loaded shows, and the only record of earlier weeks), each step once, the day's entry kept.
export function mergeDone(day: DoneStep[], plans: DoneStep[]): DoneStep[] {
  const key = (step: DoneStep) => `${Date.parse(step.doneAt)}:${step.title}`;
  const known = new Set(day.map(key));
  return [...day, ...plans.filter((step) => !known.has(key(step)))];
}

// What a day of the Week shows as due: an open plan, a deadline, or both when the deadline's title matches the plan's.
export type WeekItem = { title: string; goal?: Goal; deadline?: Deadline };
export type WeekDay = { date: string; done: DoneStep[]; items: WeekItem[] };

// The Week from `monday` (Vi, Nov 4: every open plan shows somewhere, so it is never blank while she has goals). Each
// day: the steps finished on it on the zone's clock, newest first, then the plans due on it and the deadlines on that
// date, a deadline merged into the plan its title matches (that plan's bar and steps then show for it, and a tap opens
// the plan). Today also carries the plans due before the week, so a late one never drops out. After the days, for this
// week and later ones (a past week only looks back): the plans due after the week, soonest first, then the plans with no
// due date, each unless a day already shows it.
export function weekPlan(monday: string, today: string, goals: Goal[], deadlines: Deadline[], done: DoneStep[], timeZone: string) {
  const days = Array.from({ length: 7 }, (_, i): WeekDay => {
    const date = addDays(monday, i);
    const due = goals.filter((goal) => goal.due === date || (date === today && goal.due && goal.due < monday));
    const items: WeekItem[] = due.map((goal) => ({ title: goal.title, goal }));
    for (const deadline of deadlines.filter((d) => d.date === date)) {
      const goal = goals.find((g) => sameGoal(g.title, deadline.title));
      const merged = goal && items.find((item) => item.goal === goal);
      if (merged) merged.deadline ??= deadline;
      else items.push({ title: goal?.title ?? deadline.title, goal, deadline });
    }
    const finished = done
      .filter((step) => localDate(timeZone, new Date(step.doneAt)) === date)
      .sort((a, b) => Date.parse(b.doneAt) - Date.parse(a.doneAt));
    return { date, done: finished, items };
  });
  const sunday = addDays(monday, 6);
  const shown = new Set(days.flatMap((day) => day.items.map((item) => item.goal)));
  const rest = sunday < today ? [] : goals.filter((goal) => !shown.has(goal));
  return {
    days,
    comingUp: rest.filter((goal) => goal.due && goal.due > sunday).sort((a, b) => a.due!.localeCompare(b.due!)),
    ongoing: rest.filter((goal) => !goal.due),
  };
}
