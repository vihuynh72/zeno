import type { CalendarEvent } from "@/lib/calendar";

export type BriefTask = { title: string; done: boolean };

export type Brief = {
  headline: string;
  body: string;
  firstAction: string | null;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function buildBrief(
  events: CalendarEvent[],
  tasks: BriefTask[],
  now = new Date(),
): Brief {
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const open = tasks.filter((task) => !task.done);
  const doneCount = tasks.length - open.length;
  const upcoming = events
    .filter((event) => !event.allDay && new Date(event.end).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const next = upcoming[0];

  const parts: string[] = [];
  if (events.length === 0) {
    parts.push("Your calendar is clear today.");
  } else {
    parts.push(
      `You have ${events.length} ${events.length === 1 ? "event" : "events"} on your calendar today.`,
    );
  }
  if (next) {
    parts.push(`Next up is ${next.title} at ${formatTime(next.start)}.`);
  }
  if (tasks.length === 0) {
    parts.push("You have no goals written down yet. Add one small goal below and start there.");
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
