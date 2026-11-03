import type { UserContext } from "@/lib/context";
import type { Goal } from "@/lib/day";
import { sensitiveEmail } from "@/lib/profile";
import { formatTime, localHour } from "@/lib/tz";

// A deadline's days left the way people say it.
export const dueIn = (daysLeft: number) => (daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`);

// The step the first option names: the started one, else the first todo.
const nextStep = (goal: Goal | null) =>
  goal?.steps.find((step) => step.status === "doing") ?? goal?.steps.find((step) => step.status === "todo");

// Her free time until the next timed event today ("You're free until PHIL 134 at 1:30 PM."), or the event she is in
// now; null when the calendar could not be read.
export function freeLine({ calendarState, events, timeZone }: Pick<UserContext, "calendarState" | "events" | "timeZone">, now = new Date()): string | null {
  if (calendarState !== "ok") return null;
  const at = now.getTime();
  const timed = events.filter((event) => !event.allDay).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const current = timed.find((event) => Date.parse(event.start) <= at && at < Date.parse(event.end));
  if (current) return `You're in ${current.title} until ${formatTime(current.end, timeZone)}.`;
  const next = timed.find((event) => Date.parse(event.start) > at);
  return next ? `You're free until ${next.title} at ${formatTime(next.start, timeZone)}.` : "Your calendar's clear for the rest of today.";
}

// The line under the home's greeting when the model is unavailable (Vi, Nov 3). The home greets her and lists her goals,
// so it greets nobody, picks nothing and asks nothing: what she finished yesterday (else a streak worth saying; a streak
// at risk tonight comes first), then her free time until the next event. Before 5 AM it says to set up tomorrow.
export function ruleOpening(context: UserContext, finished: string[] = [], now = new Date()): string {
  const { streak, atRisk } = context.progress;
  const unread = [context.calendarState !== "ok" && "calendar", context.emailState !== "ok" && "inbox"].filter(Boolean);
  const done =
    finished.length === 1 ? `Yesterday you got ${finished[0]} done.` : finished.length > 1 ? `Yesterday you got ${finished.length} steps done.` : null;
  const momentum = atRisk ? `One 5-minute step keeps your ${streak}-day streak going.` : (done ?? (streak > 1 ? `You're on a ${streak}-day streak.` : null));
  return [
    unread.length > 0 && `I couldn't check your ${unread.join(" or ")} just now.`,
    ...(localHour(context.timeZone, now) < 5 ? ["Set up tomorrow's first step, then sleep."] : [momentum, freeLine(context, now)]),
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
  const step = nextStep(context.goal);
  // A tapped option goes to the model, which never sees private mail (dayToText).
  const email = context.emails.find((item) => item.unread && !sensitiveEmail(item));
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
