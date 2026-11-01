import type { Progress } from "@/lib/day";
import { finishedDays } from "@/lib/goals";
import { localDate, localHour } from "@/lib/tz";

export const NO_PROGRESS: Progress = { streak: 0, best: 0, week: [], stepsThisWeek: 0, restDaysLeft: 1, atRisk: false, milestone: null };

const MILESTONES = [3, 7, 14, 30, 50, 100];
const DAY = 86_400_000;

// Streak and this week for the day screen, in the person's time zone. `justFinished`: this request moved a step
// to done from another status. Only then can it reach a milestone, so a load, a skip or a repeated Done never does.
export async function progressFor(email: string, timeZone: string, justFinished = false): Promise<Progress> {
  return progressFrom(await finishedDays(email, timeZone), timeZone, new Date(), justFinished);
}

// `finished` counts finished steps per local date (YYYY-MM-DD). Days are numbered in UTC, so a DST change never
// skips or repeats one. Walking forward from the first finished day: a finished day adds one to the streak, the
// first missed day of a Mon–Sun week inside a live streak is that week's rest day (it keeps the streak without
// adding to it), and any other missed day ends the streak. Today only counts once something is finished.
export function progressFrom(finished: Record<string, number>, timeZone: string, now: Date, justFinished = false): Progress {
  const dayOf = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
  const count = (day: number) => finished[new Date(day * DAY).toISOString().slice(0, 10)] ?? 0;
  // Day 0 (1970-01-01) was a Thursday.
  const mondayOf = (day: number) => day - ((day + 3) % 7);
  const today = dayOf(localDate(timeZone, now));
  const monday = mondayOf(today);

  let streak = 0;
  let best = 0;
  let restWeek = -1;
  let stepsThisWeek = 0;
  const week: Progress["week"] = [];
  for (let day = Math.min(monday, ...Object.keys(finished).map(dayOf)); day <= today; day++) {
    let state: Progress["week"][number];
    if (count(day) > 0) {
      streak++;
      state = "done";
    } else if (day === today) {
      state = "today";
    } else if (streak > 0 && restWeek !== mondayOf(day)) {
      restWeek = mondayOf(day);
      state = "rest";
    } else {
      streak = 0;
      state = "missed";
    }
    best = Math.max(best, streak);
    if (day >= monday) {
      week.push(state);
      stepsThisWeek += count(day);
    }
  }
  while (week.length < 7) week.push("future");

  return {
    streak,
    best,
    week,
    stepsThisWeek,
    restDaysLeft: restWeek === monday ? 0 : 1,
    atRisk: streak > 0 && count(today) === 0 && localHour(timeZone, now) >= 18,
    // Only the request that finished the day's first step reaches it; every other step that day gets the normal stamp.
    milestone: justFinished && count(today) === 1 && MILESTONES.includes(streak) ? streak : null,
  };
}
