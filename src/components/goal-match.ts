// "For this goal" (Vi, Nov 4): what in her calendar, mail and apps belongs to the open goal, by the words of its title,
// rhythm and steps. Types only, so goal-match.check.ts runs in plain node.
// shortcut: plain word overlap, no model; ask Muse to pick if people see wrong matches.
import type { CalendarBlock, DayEvent, FreeSlot, Goal, Step } from "@/lib/day";

// Words that say how, not what: they would match every inbox.
const FILLER = new Set(
  (
    "the and for with from into about your you our this that these those then than what when where which who why how " +
    "get got make made write read call send email mail find list open draft check review plan start finish done step " +
    "min minute hour day week today tomorrow first next last one two three four five six ten some each every more less " +
    "new all any can will just out off are was has have had not but its"
  ).split(" "),
);

// Lowercase words worth matching, a plural's s dropped ("runs" is "run"): 3 letters or more, or a short one with a
// digit and a letter ("5k").
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word))
    .filter((word) => !FILLER.has(word) && (word.length >= 3 || (/\d/.test(word) && /\p{L}/u.test(word))));
}

// The goal's own words weigh 2 (title), its rhythm's and steps' 1.
function goalWords(goal: Goal): Map<string, number> {
  const weights = new Map<string, number>();
  for (const text of [goal.rhythm ?? "", ...goal.steps.map((step) => step.title)]) for (const word of words(text)) weights.set(word, 1);
  for (const word of words(goal.title)) weights.set(word, 2);
  return weights;
}

// Items that match the goal, best first, at most `max`: each of the goal's words counts once, and a match is 2 or more
// (a word of its title, or two of its steps). Ties keep their order.
export function forGoal<T>(goal: Goal, items: T[], text: (item: T) => string, max = 3): T[] {
  const weights = goalWords(goal);
  return items
    .map((item, i) => ({ item, i, score: [...new Set(words(text(item)))].reduce((sum, word) => sum + (weights.get(word) ?? 0), 0) }))
    .filter((one) => one.score >= 2)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, max)
    .map((one) => one.item);
}

// The goal's next event not over yet: one of its steps booked on the calendar, or a timed event of today that matches it.
export function goalEvent(goal: Goal, events: DayEvent[], now: number): { title: string; start: string; end: string } | null {
  const booked = goal.steps.flatMap((step) =>
    step.scheduledAt && step.status !== "done"
      ? [{ title: step.title, start: step.scheduledAt, end: new Date(Date.parse(step.scheduledAt) + (step.minutes ?? 15) * 60_000).toISOString() }]
      : [],
  );
  const matched = forGoal(goal, events.filter((event) => !event.allDay), (event) => event.title, Infinity);
  return [...booked, ...matched].filter((event) => Date.parse(event.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] ?? null;
}

const FIVE = 5 * 60_000;

// The first free time that fits the step, from 10 minutes out on a 5-minute mark, as a block linked to it; null when
// none fits.
export function nextBlock(step: Step, slots: FreeSlot[], now = Date.now()): CalendarBlock | null {
  for (const slot of slots) {
    const start = Math.ceil(Math.max(Date.parse(slot.start), now + 10 * 60_000) / FIVE) * FIVE;
    const end = start + (step.minutes ?? 15) * 60_000;
    if (end <= Date.parse(slot.end)) {
      return { title: step.title, kind: "step", start: new Date(start).toISOString(), end: new Date(end).toISOString(), stepId: step.id };
    }
  }
  return null;
}
