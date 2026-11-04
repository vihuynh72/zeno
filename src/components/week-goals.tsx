"use client";

import { useEffect, useState } from "react";
import type { Deadline, DoneStep, Goal, Progress, WeekResponse } from "@/lib/day";
import { addDays, browserZone, dateLabel, mondayOf, weekLabel } from "@/components/desk-rows";
import { comingCaption, doneSteps, dueShort, duration, freeMinutes, leftCaption, segments, weekPlan, type Segment } from "@/components/goal-rows";
import { localDate } from "@/lib/tz";

// Only finished steps fill the bar; the one up next is outlined (Nov 4: a red one read as progress at 0 done).
const SEGMENT: Record<Segment, string> = { done: "bg-ink", next: "bg-track shadow-[inset_0_0_0_1.5px_var(--ink)]", todo: "bg-track" };
// A busy day shows its newest finished steps and counts the rest, so the Week stays one calm glance.
const DONE_SHOWN = 5;

// A plan's steps as one segmented bar sitting on the rule. Decorative: the caption beside it says the same in words.
function Bar({ goal }: { goal: Goal }) {
  return (
    <span aria-hidden="true" className="flex h-8 min-w-24 flex-1 items-end gap-1 pb-2.5">
      {segments(goal).map((segment, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${SEGMENT[segment]}`} />
      ))}
    </span>
  );
}

// A goal's lines on a ruled card, inside its row button: the title (and what sits right of it), then its bar and caption,
// or the caption alone. Where the two don't fit side by side, the caption drops under the bar. Numbers stay in the sans,
// whose plain 0 never reads as "Ø" (Nov 4).
export function GoalLines({ title, aside, goal, caption, bold }: { title: string; aside?: string; goal?: Goal; caption: string; bold?: boolean }) {
  return (
    <>
      <span className="flex items-baseline gap-4">
        <span className={`min-w-0 flex-1 line-clamp-2 underline-offset-4 group-hover:underline ${bold ? "font-bold" : ""}`} title={title}>
          {title}
        </span>
        {aside && (
          <span className="shrink-0 text-ink-2">
            <span className="sr-only">, </span>
            {aside}
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-x-4">
        {goal && <Bar goal={goal} />}
        <span className="text-ink-2">
          <span className="sr-only">, </span>
          {caption}
        </span>
      </span>
    </>
  );
}

type WeekGoalsProps = {
  now: number;
  goals: Goal[];
  deadlines: Deadline[];
  // This week's finished steps, every plan's (finished plans too); missing from days saved before Nov 4.
  done?: DoneStep[];
  progress?: Progress;
  onGoal?(goalId: string): void;
  onDeadline?(deadline: Deadline): void;
};

// The Desk's Week (Vi, Nov 4): Monday to Sunday, each day with the steps finished on it, what is due and the free time
// between 8 AM and 10 PM; then the plans due after the week and the ones that keep going, so it is never blank while she
// has goals. The arrows step whole weeks. A tap opens the plan, or plans the deadline; the calendar grid is one tap away.
export default function WeekGoals({ now, goals, deadlines, done, progress, onGoal, onDeadline }: WeekGoalsProps) {
  const zone = browserZone();
  const today = now ? localDate(zone, new Date(now)) : null;
  const [shift, setShift] = useState(0); // whole weeks from this one
  const monday = today && addDays(mondayOf(today), shift * 7);
  const [weeks, setWeeks] = useState<Record<string, WeekResponse>>({});

  // Only for each day's free time: until it answers, or when it can't, the days show without it. Kept per week, so a
  // slow answer for a week stepped past never lands on another.
  useEffect(() => {
    if (!monday) return;
    fetch(`/api/calendar/week?start=${monday}`)
      .then((response) => response.json() as Promise<WeekResponse>)
      .catch((): WeekResponse => ({ state: "error" }))
      .then((data) => setWeeks((all) => ({ ...all, [monday]: data })));
  }, [monday]);

  if (!today || !monday) return null;
  const answer = weeks[monday];
  const calendar = answer?.state === "ok" ? answer : null;
  // This week's finished steps come from the day; other weeks have only the open plans' own (finished plans are gone).
  const { days, comingUp, ongoing } = weekPlan(monday, today, goals, deadlines, (shift === 0 ? done : undefined) ?? doneSteps(goals), zone);
  return (
    // The home card's width, so a laptop's bars stay short enough to read.
    <div className="flex max-w-[760px] flex-col gap-4">
      <div className="week-bar">
        <h2 aria-live="polite" className="text-[20px] font-bold">
          <span className="sr-only">Week of </span>
          {weekLabel(monday)}
        </h2>
        <div className="week-nav">
          {shift !== 0 && (
            <button type="button" onClick={() => setShift(0)} className="pill pill-small pill-quiet">
              This week
            </button>
          )}
          <button type="button" onClick={() => setShift((n) => n - 1)} aria-label="Previous week" className="pill pill-small week-step">
            <Chevron d="M15 5l-7 7 7 7" />
          </button>
          <button type="button" onClick={() => setShift((n) => n + 1)} aria-label="Next week" className="pill pill-small week-step">
            <Chevron d="M9 5l7 7-7 7" />
          </button>
        </div>
      </div>
      <section className="mini">
        <ol className="lines">
          {days.map(({ date, done: finished, items }, i) => {
            const past = date < today;
            const free = calendar && freeMinutes(calendar.days.find((day) => day.date === date)?.events ?? [], date, calendar.timeZone, now);
            // A past day says only that she worked, never what she missed: its steps, else this week's dot as "Worked".
            const worked = past && finished.length === 0 && shift === 0 && progress?.week[i] === "done";
            const note = past ? (worked ? "Worked" : "") : free == null ? "" : free ? `${duration(free)} free` : "No free time";
            return (
              <li key={date} data-mark={date === today ? "now" : undefined} className={past ? "text-ink-2" : undefined}>
                <h3 className="flex items-baseline justify-between gap-4">
                  <span className="font-bold">
                    {date === today ? "Today" : dateLabel(date, { weekday: "long" })}
                    <span className="sr-only">, {dateLabel(date, { month: "long", day: "numeric" })}</span>
                  </span>
                  {note && <span className="text-ink-2">{note}</span>}
                </h3>
                {finished.length + items.length > 0 && (
                  <ul>
                    {finished.slice(0, DONE_SHOWN).map((step, j) => (
                      <li key={`${j}:${step.doneAt}`} className="text-ink-2">
                        Done: {step.title}
                        {step.minutes ? ` · ${duration(step.minutes)}` : ""}
                      </li>
                    ))}
                    {finished.length > DONE_SHOWN && <li className="text-ink-2">and {finished.length - DONE_SHOWN} more</li>}
                    {items.map((item, j) => (
                      <li key={`${j}:${item.title}`}>
                        <button
                          type="button"
                          onClick={() => (item.goal ? onGoal?.(item.goal.id) : item.deadline && onDeadline?.(item.deadline))}
                          className="group block w-full text-left active:opacity-60"
                        >
                          <GoalLines
                            title={item.title}
                            // A plan due before the week sits on Today, saying when it was due.
                            aside={item.goal?.due && item.goal.due < date ? dueShort(item.goal.due, today) : undefined}
                            goal={item.goal}
                            caption={item.goal ? leftCaption(item.goal) : "Not started"}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      {comingUp.length > 0 && (
        <Plans
          heading="Coming up"
          plans={comingUp}
          aside={(plan) => dateLabel(plan.due ?? "", { month: "short", day: "numeric" })}
          caption={(plan) => comingCaption(plan, today)}
          onGoal={onGoal}
        />
      )}
      {ongoing.length > 0 && <Plans heading="Ongoing" plans={ongoing} aside={(plan) => plan.rhythm ?? undefined} caption={leftCaption} onGoal={onGoal} />}
    </div>
  );
}

// Plans beyond the week's days on one card, each row one tap into that plan's desk.
function Plans({ heading, plans, aside, caption, onGoal }: { heading: string; plans: Goal[]; aside(plan: Goal): string | undefined; caption(plan: Goal): string; onGoal?(goalId: string): void }) {
  return (
    <section className="mini">
      <h2 className="text-[20px] leading-8 font-bold">{heading}</h2>
      <ul className="lines mt-2">
        {plans.map((plan) => (
          <li key={plan.id}>
            <button type="button" onClick={() => onGoal?.(plan.id)} className="group block w-full text-left active:opacity-60">
              <GoalLines title={plan.title} aside={aside(plan)} goal={plan} caption={caption(plan)} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chevron({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
