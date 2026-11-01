import type { UserContext } from "@/lib/context";
import type { FirstPick } from "@/lib/day";
import { localHour } from "@/lib/tz";

// A deadline's days left the way people say it.
export const dueIn = (daysLeft: number) => (daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`);

// The first card when the model is unavailable: the next todo step (5 minutes into it when it is long or
// unsized), else the nearest deadline. null when there is neither.
export function rulePick(context: UserContext): FirstPick | null {
  const { goal } = context;
  const step = goal?.steps.find((item) => item.status === "todo");
  if (goal && step) {
    const minutes = step.minutes !== null && step.minutes <= 15 ? step.minutes : 5;
    return {
      goal: goal.title,
      due: goal.due ?? null,
      stepId: step.id,
      steps: [{ title: step.title, minutes }],
      why: minutes === step.minutes ? "It's next on your plan." : "It's next on your plan; 5 minutes gets it going.",
    };
  }
  const deadline = context.deadlines[0];
  return deadline
    ? { goal: deadline.title, due: deadline.date, stepId: null, steps: [{ title: "Open it and work 5 minutes", minutes: 5 }], why: `Due ${dueIn(deadline.daysLeft)}.` }
    : null;
}

// Before 5 AM it is still the night before for most people, not morning.
function greetingAt(timeZone: string, now: Date, firstName: string | null) {
  const hour = localHour(timeZone, now);
  const who = firstName ? `, ${firstName}` : "";
  if (hour < 5) return `Still up${who}?`;
  return `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${who}.`;
}

// Zeno's first line when the model is unavailable: it offers the next step or the nearest deadline (what
// rulePick puts on the card) and never guesses the day.
export function ruleOpening(context: UserContext, firstName: string | null, now = new Date()): string {
  const { goal } = context;
  const next = goal?.steps.find((step) => step.status === "doing" || step.status === "todo");
  const deadline = context.deadlines[0];
  const late = localHour(context.timeZone, now) < 5;
  const unread = [context.calendarState !== "ok" && "calendar", context.emailState !== "ok" && "inbox"].filter(Boolean);
  return [
    greetingAt(context.timeZone, now, firstName),
    unread.length > 0 && `I couldn't check your ${unread.join(" or ")} just now.`,
    !late && context.progress.atRisk && `One 5-minute step keeps your ${context.progress.streak}-day streak going.`,
    late
      ? "Want to set up tomorrow's first step before you sleep?"
      : goal && next
        ? `Next up for ${goal.title}: ${next.title}. Want to pick it up?`
        : deadline
          ? `${deadline.title} is due ${dueIn(deadline.daysLeft)}. Want to open it for 5 minutes?`
          : "What's one thing you want to move forward today?",
  ]
    .filter(Boolean)
    .join(" ");
}

const TITLE = /^(dr|prof|mr|mrs|ms|mx)\.?$/i;
// Calendar blocks nobody prepares for.
const ROUTINE = /\b(lunch|breakfast|dinner|break|commute|gym|workout|focus|busy|hold|block|ooo|out of office|sleep)\b/i;

const clip = (text: string, words: number) => {
  const all = text.split(/\s+/);
  return all.length > words ? `${all.slice(0, words).join(" ")}…` : text;
};

// A Gmail From header the way a person says it: "Ana Lopez <ana@x.edu>" and "ana.lopez@x.edu" are both "Ana".
// shortcut: "Lopez, Ana" comes out as "Lopez", flip comma names if Outlook-style senders show up
export function senderName(from: string): string {
  const name = from.replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  const words = name && !name.includes("@") ? name.split(/\s+/) : [(name || from).replace(/[<>]/g, "").split("@")[0].split(/[._+-]/)[0]];
  const said = TITLE.test(words[0]) && words.length > 1 ? `${words[0]} ${words[words.length - 1]}` : words[0].replace(/,$/, "");
  return said.charAt(0).toUpperCase() + said.slice(1);
}

// Up to three things to tap on the first screen, from real context only, worded as the person would say them.
export function ruleOptions(context: UserContext, now = new Date()): string[] {
  // Before 5 AM the day's picks can wait.
  if (localHour(context.timeZone, now) < 5) return ["Set up tomorrow"];
  const steps = context.goal?.steps ?? [];
  const step = steps.find((item) => item.status === "doing") ?? steps.find((item) => item.status === "todo");
  const email = context.emails.find((item) => item.unread && item.personal);
  const event = context.events.find(
    (item) => !item.allDay && new Date(item.start).getTime() > now.getTime() && !ROUTINE.test(item.title),
  );
  const title = step && (/^[A-Z][a-z]/.test(step.title) ? step.title[0].toLowerCase() + step.title.slice(1) : step.title);
  return [
    title && `Keep going on ${clip(title, 4)}`,
    email && `Reply to ${senderName(email.from)}`,
    event && `Prep for ${clip(event.title, 4)}`,
  ].filter((option): option is string => Boolean(option));
}
