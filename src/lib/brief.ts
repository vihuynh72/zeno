import type { UserContext } from "@/lib/context";
import { formatTime, localHour } from "@/lib/tz";

export type Brief = {
  headline: string;
  body: string;
  firstAction: string | null;
};

function greetingAt(timeZone: string, now: Date) {
  const hour = localHour(timeZone, now);
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// Zeno's first line when the model is unavailable: it offers the next step and never guesses the day.
export function ruleOpening(context: UserContext, firstName: string | null, now = new Date()): string {
  const { goal } = context;
  const next = goal?.steps.find((step) => step.status === "doing" || step.status === "todo");
  const unread = [context.calendarState !== "ok" && "calendar", context.emailState !== "ok" && "inbox"].filter(Boolean);
  return [
    `${greetingAt(context.timeZone, now)}${firstName ? `, ${firstName}` : ""}.`,
    unread.length > 0 && `I couldn't check your ${unread.join(" or ")} just now.`,
    goal && next
      ? `Next up for ${goal.title}: ${next.title}. Want to pick it up?`
      : "What's one thing you want to move forward today?",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildBrief(context: UserContext, now = new Date()): Brief {
  const { events, tasks, timeZone } = context;
  const greeting = greetingAt(timeZone, now);
  const open = tasks.filter((task) => !task.done);
  const doneCount = tasks.length - open.length;
  const upcoming = events
    .filter((event) => !event.allDay && new Date(event.end).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const next = upcoming[0];

  const parts: string[] = [];
  if (context.calendarState !== "ok") {
    parts.push("I couldn't read your calendar just now.");
  } else if (events.length === 0) {
    parts.push("Your calendar is clear today.");
  } else {
    parts.push(
      `You have ${events.length} ${events.length === 1 ? "event" : "events"} on your calendar today.`,
    );
  }
  if (next) {
    parts.push(`Next up is ${next.title} at ${formatTime(next.start, timeZone)}.`);
  }
  if (tasks.length === 0) {
    parts.push(context.tasksState === "ok" ? "You have no goals written down yet. Add one small goal below and start there." : "I couldn't read your goals just now.");
  } else if (open.length === 0) {
    parts.push("Every goal on your list is done. That is a clean finish.");
  } else {
    parts.push(
      `You have ${open.length} open ${open.length === 1 ? "goal" : "goals"}${doneCount > 0 ? ` and ${doneCount} done` : ""}.`,
    );
  }

  return {
    headline: `${greeting}. Here is your brief.`,
    body: parts.join(" "),
    firstAction: open[0]?.title ?? null,
  };
}
