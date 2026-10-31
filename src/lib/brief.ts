import type { UserContext } from "@/lib/context";
import { localHour } from "@/lib/tz";

// Before 5 AM it is still the night before for most people, not morning.
function greetingAt(timeZone: string, now: Date, firstName: string | null) {
  const hour = localHour(timeZone, now);
  const who = firstName ? `, ${firstName}` : "";
  if (hour < 5) return `Still up${who}?`;
  return `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${who}.`;
}

// Zeno's first line when the model is unavailable: it offers the next step and never guesses the day.
export function ruleOpening(context: UserContext, firstName: string | null, now = new Date()): string {
  const { goal } = context;
  const next = goal?.steps.find((step) => step.status === "doing" || step.status === "todo");
  const unread = [context.calendarState !== "ok" && "calendar", context.emailState !== "ok" && "inbox"].filter(Boolean);
  return [
    greetingAt(context.timeZone, now, firstName),
    unread.length > 0 && `I couldn't check your ${unread.join(" or ")} just now.`,
    goal && next
      ? `Next up for ${goal.title}: ${next.title}. Want to pick it up?`
      : localHour(context.timeZone, now) < 5
        ? "Want to set up tomorrow's first step before you sleep?"
        : "What's one thing you want to move forward today?",
  ]
    .filter(Boolean)
    .join(" ");
}
