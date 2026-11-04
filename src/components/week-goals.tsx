"use client";

import { Fragment, useEffect, useState } from "react";
import type { DoneStep, Goal, WeekResponse } from "@/lib/day";
import { addDays, browserZone, dateLabel, mondayOf } from "@/components/desk-rows";
import { segments, type Segment } from "@/components/goal-rows";
import { goalTag, mins, planWeek, stepLabel, type PlanItem } from "@/components/week-plan";
import { localDate } from "@/lib/tz";

// Only finished steps fill the bar; the one up next is outlined (Nov 4: a red one read as progress at 0 done).
const SEGMENT: Record<Segment, string> = { done: "bg-ink", next: "bg-track shadow-[inset_0_0_0_1.5px_var(--ink)]", todo: "bg-track" };

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
// or the caption alone. Where the two don't fit side by side, the caption drops under the bar. Counts and dates are in
// the sans, as the goal strip writes them (Nov 4).
export function GoalLines({ title, aside, goal, caption, bold }: { title: string; aside?: string; goal?: Goal; caption: string; bold?: boolean }) {
  return (
    <>
      <span className="flex items-baseline gap-4">
        <span className={`min-w-0 flex-1 line-clamp-2 underline-offset-4 group-hover:underline ${bold ? "font-bold" : ""}`} title={title}>
          {title}
        </span>
        {aside && (
          <span className="max-w-[50%] min-w-0 text-right text-ink-2">
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
  // Every finished step the page knows of (desk.tsx: the day's doneThisWeek and the plans' own steps).
  done: DoneStep[];
  // A calendar is connected, so the days list its events.
  calendar: boolean;
  onGoal?(goalId: string): void;
};

// The Desk's Week (Vi, Nov 4, "Both"): a line a day from Monday to Sunday, then the next three days. The days behind tick
// off what she finished; from today on, her events and a light plan of her open steps (week-plan.ts), never booked on the
// calendar. A planned step or a due line opens that goal's desk.
export default function WeekGoals({ now, goals, done, calendar: connected, onGoal }: WeekGoalsProps) {
  const zone = browserZone();
  const today = now ? localDate(zone, new Date(now)) : null;
  const monday = today && mondayOf(today);
  const [weeks, setWeeks] = useState<Record<string, WeekResponse>>({});

  // This week's and next week's events: until they answer, or when they can't, the days show the plan alone.
  useEffect(() => {
    if (!monday || !connected) return;
    for (const start of [monday, addDays(monday, 7)]) {
      fetch(`/api/calendar/week?start=${start}`)
        .then((response) => response.json() as Promise<WeekResponse>)
        .catch((): WeekResponse => ({ state: "error" }))
        .then((data) => setWeeks((all) => ({ ...all, [start]: data })));
    }
  }, [monday, connected]);

  if (!today || !monday) return null;
  // The route lists an event on each day it touches; the plan wants it once.
  const events = new Map(
    Object.values(weeks)
      .flatMap((week) => (week.state === "ok" ? week.days.flatMap((day) => day.events) : []))
      .map((event) => [`${event.id}:${event.start}`, event]),
  );
  return (
    // The home card's width, so a laptop's lines stay short enough to read.
    <section className="mini max-w-[760px]">
      <h2 className="sr-only">Your week</h2>
      <ol className="lines">
        {planWeek(goals, [...events.values()], done, today, zone).map(({ date, items }) => (
          <Fragment key={date}>
            {date === today && (
              <li aria-hidden="true" className="flex items-center gap-3 text-ink-2">
                today
                <span className="h-px flex-1 bg-current" />
              </li>
            )}
            <li data-mark={date === today ? "now" : undefined} className={`sm:flex sm:gap-4 ${date < today ? "text-ink-2" : ""}`}>
              <h3 className="shrink-0 font-bold sm:w-20">
                <span aria-hidden="true">
                  {dateLabel(date, { weekday: "short" })} {Number(date.slice(8))}
                </span>
                <span className="sr-only">
                  {date === today ? "Today, " : ""}
                  {dateLabel(date, { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </h3>
              {items.length > 0 && (
                <ul className="min-w-0 flex-1">
                  {items.map((item, i) => (
                    <li key={i}>
                      <Line item={item} onGoal={onGoal} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

// " · 20m", kept on the line with the word before it (a phone wrapped the minutes alone).
const Minutes = ({ minutes }: { minutes: number | null }) => (minutes ? <span className="whitespace-nowrap">{` · ${mins(minutes)}`}</span> : null);

// One line of a day: a finished step ticked, an event at its time, a rest day, or a planned step or due goal that opens
// its goal. Only the plan is in ink; what is done and what the calendar holds stay quiet.
function Line({ item, onGoal }: { item: PlanItem; onGoal?(goalId: string): void }) {
  if (item.kind === "done") {
    return (
      <span className="text-ink-2">
        <span aria-hidden="true">✓ </span>
        <span className="sr-only">Done: </span>
        {stepLabel(item.goal, item.title)}
        <Minutes minutes={item.minutes} />
      </span>
    );
  }
  if (item.kind === "event") {
    return (
      <span className="text-ink-2">
        {item.time && <span className="font-mono">{item.time} </span>}
        {item.title}
      </span>
    );
  }
  if (item.kind === "rest") return <span className="text-ink-2">{goalTag(item.goal.title)}: rest day</span>;
  return (
    <button
      type="button"
      onClick={() => onGoal?.(item.goal.id)}
      className={`text-left underline-offset-4 hover:underline active:opacity-60 ${item.kind === "due" ? "font-bold" : ""}`}
    >
      {item.kind === "due" ? (
        `${item.goal.title} due`
      ) : (
        <>
          <span className="sr-only">Planned: </span>
          {stepLabel(item.goal.title, item.step.title)}
          <Minutes minutes={item.step.minutes} />
        </>
      )}
    </button>
  );
}
