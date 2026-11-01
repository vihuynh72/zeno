import type { Progress } from "@/lib/day";
import { finishedDays, streakFrom } from "@/lib/goals";
import { localDate } from "@/lib/tz";

export const NO_PROGRESS: Progress = { streak: 0, best: 0, week: [], stepsThisWeek: 0, restDaysLeft: 1, atRisk: false, milestone: null };

// Streak and this week for the day screen, in the person's time zone.
// Contract stub (docs/PLAN-NOV.md): the streak only; the streak track adds rest days, best, the week row,
// at-risk evenings and milestones.
export async function progressFor(email: string, timeZone: string): Promise<Progress> {
  const streak = streakFrom(await finishedDays(email, timeZone), localDate(timeZone));
  return { ...NO_PROGRESS, streak, best: streak };
}
