// Pure rules behind the Desk's goal rows (the Goals and Deadlines cards and the Week, Vi, Nov 3). Only desk-rows.ts and
// tz.ts besides types, so goal-rows.check.ts runs in plain node.
import type { Deadline, Goal } from "@/lib/day";
import { addDays, dateLabel, freeGaps, layoutDay, wallMinutes } from "@/components/desk-rows";

// Lowercase, with every run of characters that are not letters or digits made one space.
const words = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Two titles name the same goal when either contains the other (Vi, Nov 3); a title with no letters or digits never does.
export function sameGoal(a: string, b: string) {
  const [x, y] = [words(a), words(b)];
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
}

// The Desk's plans: the current one first, as fresh as the page has it (so a plan made since the day loaded joins, and a
// day saved before Nov 3, which lists none, still shows it), then the other open plans. Only plans with a step left.
export function deskPlans(goal: Goal | null, goals: Goal[] | undefined): Goal[] {
  const open = (plan: Goal) => plan.steps.some((step) => step.status === "todo" || step.status === "doing");
  return [...(goal ? [goal] : []), ...(goals ?? []).filter((plan) => plan.id !== goal?.id)].filter(open);
}

export type Segment = "done" | "next" | "todo";

// One segment per step: done ones in ink, the one running (else the next to do) in red, the rest in the track color.
export function segments(goal: Goal): Segment[] {
  const next = goal.steps.find((step) => step.status === "doing") ?? goal.steps.find((step) => step.status === "todo");
  return goal.steps.map((step) => (step.status === "done" ? "done" : step === next ? "next" : "todo"));
}

export const doneCaption = (goal: Goal) => `${goal.steps.filter((step) => step.status === "done").length} of ${goal.steps.length} done`;

// "due today", "due tomorrow", "due Fri" within a week, else "due Nov 12"; "was due Mon" once it has passed.
export function dueShort(due: string, today: string) {
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  const named = dateLabel(due, Math.abs(days) < 7 ? { weekday: "short" } : { month: "short", day: "numeric" });
  return `${days < 0 ? "was due" : "due"} ${named}`;
}

// "45 min", "1 h", "1 h 30".
export function duration(minutes: number) {
  const [hours, rest] = [Math.floor(minutes / 60), minutes % 60];
  return hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

// "4 steps left · about 1 h 30": the steps not done yet and their planned minutes.
export function leftCaption(goal: Goal) {
  const left = goal.steps.filter((step) => step.status === "todo" || step.status === "doing");
  if (left.length === 0) return "All steps done";
  const minutes = left.reduce((sum, step) => sum + (step.minutes ?? 0), 0);
  const count = `${left.length} ${left.length === 1 ? "step" : "steps"} left`;
  return minutes > 0 ? `${count} · about ${duration(minutes)}` : count;
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

// What the Week shows as due: an open plan, a deadline, or both when the deadline's title matches the plan's.
export type WeekItem = { title: string; goal?: Goal; deadline?: Deadline };

// The 7 days from `monday`, each with the open plans due that day and the deadlines on that date, a deadline merged into
// the plan its title matches (that plan's bar and steps then show for it, and a tap opens the plan).
export function weekItems(monday: string, goals: Goal[], deadlines: Deadline[]): { date: string; items: WeekItem[] }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const items: WeekItem[] = goals.filter((goal) => goal.due === date).map((goal) => ({ title: goal.title, goal }));
    for (const deadline of deadlines.filter((d) => d.date === date)) {
      const goal = goals.find((g) => sameGoal(g.title, deadline.title));
      const merged = goal && items.find((item) => item.goal === goal);
      if (merged) merged.deadline ??= deadline;
      else items.push({ title: goal?.title ?? deadline.title, goal, deadline });
    }
    return { date, items };
  });
}
