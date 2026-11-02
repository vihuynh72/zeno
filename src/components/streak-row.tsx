"use client";

import type { Progress } from "@/lib/day";
import { streakLine, WEEKDAYS } from "@/components/day-flow";

const SAID: Record<Progress["week"][number], string> = {
  done: "done",
  rest: "rest day",
  missed: "missed",
  none: "before your first step",
  today: "today",
  future: "still to come",
};

// "Day N · M steps this week" over the week's seven dots, Monday first.
export default function StreakRow({ progress }: { progress: Progress }) {
  const steps = progress.stepsThisWeek;
  return (
    <div className="rise mt-4 flex flex-col items-center gap-3" aria-label={streakLine(progress)} role="group">
      {/* A milestone (3, 7, 14, 30, 50, 100 days) gets the bigger stamp. */}
      {progress.milestone ? <span className="milestone">{progress.milestone} DAYS</span> : null}
      <p className="text-[20px] leading-8 font-bold" aria-hidden="true">
        Day <span className="font-mono">{progress.streak}</span>
        <span className="px-2 text-ink-2">·</span>
        <span className="font-mono">{steps}</span> {steps === 1 ? "step" : "steps"} this week
      </p>
      <ol className="week">
        {WEEKDAYS.map((day, i) => {
          const state = progress.week[i] ?? "future";
          return (
            <li key={day} data-day={state}>
              <i aria-hidden="true" />
              <span aria-hidden="true">{day[0]}</span>
              <span className="sr-only">
                {day}: {SAID[state]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
