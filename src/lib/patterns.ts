import type { Memory } from "@/lib/day";
import { addMemory, dropMemories, forgottenMemories, listMemories, recentSteps, type StepRecord } from "@/lib/goals";
import { localHour } from "@/lib/tz";

// The opening words of each kind of pattern, so a real-length multiple is only ever compared with its own kind.
const KINDS = ["You finish most steps", "Steps take you", "You often skip", "Steps of 10 minutes"];
export const kindOf = (text: string) => KINDS.find((kind) => text.startsWith(kind)) ?? null;

const partOfDay = (hour: number) =>
  hour < 5 || hour >= 22 ? "late at night" : hour < 12 ? "in the morning" : hour < 17 ? "in the afternoon" : "in the evening";

// Patterns that hold in these steps, each one short sentence, in a fixed order. Deterministic, no model, and each
// kind needs a minimum number of steps before it says anything.
export function patternsIn(steps: StepRecord[], timeZone: string): string[] {
  const found: string[] = [];
  const done = steps.filter((step) => step.status === "done");

  // Time of day: 5 finished steps or more, 60% of them in one part of the day.
  if (done.length >= 5) {
    const parts = new Map<string, number>();
    for (const step of done) {
      const part = partOfDay(localHour(timeZone, new Date(step.doneAt)));
      parts.set(part, (parts.get(part) ?? 0) + 1);
    }
    for (const [part, count] of parts) if (count / done.length >= 0.6) found.push(`You finish most steps ${part}.`);
  }

  // Real length versus the estimate: 4 started steps or more with an estimate, compared by the median. Under a
  // minute (two quick taps) or longer than both 3x the plan and 2 hours (a timer left running) says nothing.
  const ratios = done
    .flatMap((step) => {
      const real = step.startedAt ? (Date.parse(step.doneAt) - Date.parse(step.startedAt)) / 60_000 : 0;
      return step.minutes && real >= 1 && real <= Math.max(3 * step.minutes, 120) ? [real / step.minutes] : [];
    })
    .sort((a, b) => a - b);
  if (ratios.length >= 4) {
    const half = ratios.length / 2;
    const median = ratios.length % 2 ? ratios[Math.floor(half)] : (ratios[half - 1] + ratios[half]) / 2;
    // To the half, up to 3x: a bigger number would only stretch plans past the 5-minute start.
    const multiple = Math.min(Math.round(median * 2) / 2, 3);
    if (median >= 1.5) {
      found.push(multiple < 3 ? `Steps take you about ${multiple}x as long as you plan.` : "Steps take you 3x as long as you plan, or more.");
    } else if (median <= 0.7) found.push("Steps take you less time than you plan.");
  }

  // Long steps skipped: 3 skips or more of steps planned at 30 minutes or more, and at least half of those steps.
  const long = steps.filter((step) => (step.minutes ?? 0) >= 30);
  const longSkips = long.filter((step) => step.status === "skipped").length;
  if (longSkips >= 3 && longSkips / long.length >= 0.5) found.push("You often skip steps of 30 minutes or more.");

  // Tiny starts: 3 finished steps or more of 10 minutes or less, finished more often than longer ones.
  const finishRate = (list: StepRecord[]) => list.filter((step) => step.status === "done").length / list.length;
  const tiny = steps.filter((step) => step.minutes !== null && step.minutes <= 10);
  const longer = steps.filter((step) => step.minutes !== null && step.minutes > 10);
  if (
    tiny.filter((step) => step.status === "done").length >= 3 &&
    longer.length > 0 &&
    finishRate(tiny) > finishRate(longer)
  ) {
    found.push("Steps of 10 minutes or less work best for you.");
  }
  return found;
}

const multipleOf = (text: string) => Number(/(\d+(?:\.\d+)?)x /.exec(text)?.[1]);

// Already said: the same sentence, or a real-length multiple within half a step of the one said, which is noise
// (a median near 1.75 would flip between 1.5x and 2x on every step).
export function alreadySaid(text: string, known: { text: string }[]): boolean {
  return known.some(
    (memory) =>
      memory.text === text ||
      (kindOf(memory.text) === kindOf(text) && Math.abs(multipleOf(memory.text) - multipleOf(text)) < 1),
  );
}

// Squares the saved patterns with what holds now. stale: saved patterns no found one says any more (they stopped
// holding, or changed, like a new time of day). fresh: found patterns not already said and not one the person
// removed, so their Undo or Forget sticks, even when the multiple wobbles.
export function reconcile<T extends { text: string }>(found: string[], saved: T[], removed: string[]): { stale: T[]; fresh: string[] } {
  const stale = saved.filter((memory) => !found.some((text) => alreadySaid(text, [memory])));
  const kept = saved.filter((memory) => !stale.includes(memory));
  const gone = removed.map((text) => ({ text }));
  return { stale, fresh: found.filter((text) => !alreadySaid(text, kept) && !alreadySaid(text, gone)) };
}

// After a step is finished or skipped: patterns that stopped holding are removed, and a new pattern in the last
// 30 days is saved as a "patterns" memory and returned, or null. One new pattern per call, so each one gets its
// own Noted line.
export async function learnFromSteps(email: string, timeZone: string): Promise<Memory | null> {
  const [steps, memories, removed] = await Promise.all([recentSteps(email), listMemories(email), forgottenMemories(email)]);
  const saved = memories.filter((memory) => memory.source === "pattern");
  const { stale, fresh } = reconcile(patternsIn(steps, timeZone), saved, removed);
  await dropMemories(email, stale.map((memory) => memory.id));
  for (const text of fresh) {
    const learned = await addMemory(email, text, { group: "patterns", source: "pattern" });
    if (learned) return learned;
  }
  return null;
}
