"use client";

import { useEffect, useState } from "react";
import type { Deadline, Goal, Progress, WeekResponse } from "@/lib/day";
import { browserZone, dateLabel, mondayOf, weekLabel } from "@/components/desk-rows";
import { duration, freeMinutes, leftCaption, segments, weekItems, type Segment } from "@/components/goal-rows";
import { localDate } from "@/lib/tz";

const SEGMENT: Record<Segment, string> = { done: "bg-ink", next: "bg-margin", todo: "bg-track" };

// Numbers in the Mono, as the desk writes its times and counts.
function Mono({ text }: { text: string }) {
  return text.split(/(\d+)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="font-mono">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

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
// or the caption alone. Where the two don't fit side by side, the caption drops under the bar.
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
            <Mono text={aside} />
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-x-4">
        {goal && <Bar goal={goal} />}
        <span className="text-ink-2">
          <span className="sr-only">, </span>
          <Mono text={caption} />
        </span>
      </span>
    </>
  );
}

type WeekGoalsProps = {
  now: number;
  goals: Goal[];
  deadlines: Deadline[];
  progress?: Progress;
  onGoal?(goalId: string): void;
  onDeadline?(deadline: Deadline): void;
};

// The Desk's Week (Vi, Nov 3): Monday to Sunday of this week, each day with what is due, the steps left and the free time
// between 8 AM and 10 PM. A tap opens the plan, or plans the deadline; the calendar grid is one tap away (desk.tsx).
export default function WeekGoals({ now, goals, deadlines, progress, onGoal, onDeadline }: WeekGoalsProps) {
  const today = now ? localDate(browserZone(), new Date(now)) : null;
  const monday = today && mondayOf(today);
  const [week, setWeek] = useState<{ monday: string; data: WeekResponse } | null>(null);

  // Only for each day's free time: until it answers, or when it can't, the days show without it.
  useEffect(() => {
    if (!monday) return;
    fetch(`/api/calendar/week?start=${monday}`)
      .then((response) => response.json() as Promise<WeekResponse>)
      .catch((): WeekResponse => ({ state: "error" }))
      .then((data) => setWeek({ monday, data }));
  }, [monday]);

  if (!today || !monday) return null;
  const read = week?.monday === monday && week.data.state === "ok" ? week.data : null;
  const days = weekItems(monday, goals, deadlines);
  return (
    // The home card's width, so a laptop's bars stay short enough to read.
    <section className="mini max-w-[760px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-[20px] leading-8 font-bold">
          <span className="sr-only">Week of </span>
          {weekLabel(monday)}
        </h2>
        {days.every((day) => day.items.length === 0) && <p className="text-ink-2">Nothing due this week.</p>}
      </div>
      <ol className="lines mt-2">
        {days.map(({ date, items }, i) => {
          const past = date < today;
          const free = read && freeMinutes(read.days.find((day) => day.date === date)?.events ?? [], date, read.timeZone, now);
          // A past day says only that she worked, never what she missed.
          const note = past ? (progress?.week[i] === "done" ? "Worked" : "") : free == null ? "" : free ? `${duration(free)} free` : "No free time";
          return (
            <li key={date} data-mark={date === today ? "now" : undefined} className={past ? "text-ink-2" : undefined}>
              <h3 className="flex items-baseline justify-between gap-4">
                <span className="font-bold">
                  {date === today ? "Today" : dateLabel(date, { weekday: "long" })}
                  <span className="sr-only">, {dateLabel(date, { month: "long", day: "numeric" })}</span>
                </span>
                {note && (
                  <span className="text-ink-2">
                    <Mono text={note} />
                  </span>
                )}
              </h3>
              {items.length > 0 && (
                <ul>
                  {items.map((item, j) => (
                    <li key={`${j}:${item.title}`}>
                      <button
                        type="button"
                        onClick={() => (item.goal ? onGoal?.(item.goal.id) : item.deadline && onDeadline?.(item.deadline))}
                        className="group block w-full text-left active:opacity-60"
                      >
                        <GoalLines title={item.title} goal={item.goal} caption={item.goal ? leftCaption(item.goal) : "Not started"} />
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
  );
}
