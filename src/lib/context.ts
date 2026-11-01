import type { Session } from "next-auth";
import { dueIn } from "@/lib/brief";
import { calendarWriteFor, freeSlots, getTodayEvents, upcomingDeadlines, type CalendarEvent } from "@/lib/calendar";
import type { CalendarWrite, Deadline, FreeSlot, Goal, Memory, Progress } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { getRecentEmail, type EmailSummary } from "@/lib/gmail";
import { currentGoal, listMemories } from "@/lib/goals";
import { NO_PROGRESS, progressFor } from "@/lib/progress";
import { dayBounds, formatDate, formatTime, localDate } from "@/lib/tz";

export type UserContext = {
  email: string;
  timeZone: string;
  events: CalendarEvent[];
  calendarState: "ok" | "no-access" | "error";
  goal: Goal | null;
  memories: Memory[];
  // The database: goal and memories load together.
  tasksState: "ok" | "not-configured" | "error";
  emails: EmailSummary[];
  emailState: "ok" | "no-access" | "error";
  // The rest of today's free time, deadlines in the next 14 days, and whether Zeno may write to its calendar.
  free: FreeSlot[];
  deadlines: Deadline[];
  calendarWrite: CalendarWrite;
  // Streak and this week; NO_PROGRESS when it couldn't be read.
  progress: Progress;
};

// shortcut: per-instance cache, move to a shared store if staleness matters
const googleCache = new Map<string, { at: number; data: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = googleCache.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.data as T;
  const data = await load();
  googleCache.set(key, { at: Date.now(), data });
  return data;
}

export async function loadUserContext(
  email: string,
  session: Pick<Session, "accessToken" | "error">,
  timeZone: string,
): Promise<UserContext> {
  // After a failed refresh the token is dead, so Google sources count as unavailable.
  const accessToken = session.error ? undefined : session.accessToken;
  let events: CalendarEvent[] = [];
  let calendarState: UserContext["calendarState"] = "no-access";
  let goal: Goal | null = null;
  let memories: Memory[] = [];
  let tasksState: UserContext["tasksState"] = "not-configured";
  let emails: EmailSummary[] = [];
  let emailState: UserContext["emailState"] = "no-access";
  let free: FreeSlot[] = [];
  let deadlines: Deadline[] = [];
  let progress: Progress = NO_PROGRESS;

  await Promise.all([
    (async () => {
      if (!accessToken) return;
      try {
        events = await cached(`calendar:${email}`, () => getTodayEvents(accessToken, timeZone));
        calendarState = "ok";
      } catch {
        calendarState = "error";
      }
    })(),
    // Goal and memories are always read fresh so a goal added a moment ago is never missing.
    (async () => {
      if (!databaseConfigured()) return;
      try {
        const [current, remembered] = await Promise.all([currentGoal(email), listMemories(email)]);
        goal = current;
        memories = remembered;
        tasksState = "ok";
      } catch {
        tasksState = "error";
      }
    })(),
    (async () => {
      if (!accessToken) return;
      try {
        emails = await cached(`email:${email}`, () => getRecentEmail(accessToken));
        emailState = "ok";
      } catch {
        emailState = "error";
      }
    })(),
    // Free time and deadlines are extras: a failure leaves them empty and the day still loads.
    (async () => {
      if (!accessToken) return;
      [free, deadlines] = await Promise.all([
        freeSlots(accessToken, timeZone, { minutes: 5, days: 1 }).catch(() => []),
        upcomingDeadlines(accessToken, timeZone).catch(() => []),
      ]);
    })(),
    (async () => {
      if (!databaseConfigured()) return;
      progress = await progressFor(email, timeZone).catch(() => NO_PROGRESS);
    })(),
  ]);

  return {
    email, timeZone, events, calendarState, goal, memories, tasksState, emails, emailState,
    free, deadlines, calendarWrite: calendarWriteFor(session), progress,
  };
}

// Time, calendar and email. The Guided day leaves out the old tasks list, which its screens never show.
export function dayToText(context: UserContext, now = new Date()): string {
  const lines: string[] = [];
  const zone = context.timeZone;
  lines.push(`Today is ${formatDate(now, zone)}. It is now ${formatTime(now, zone)} (${zone}).`);

  if (context.calendarState === "ok") {
    if (context.events.length === 0) {
      lines.push("Calendar today: no events.");
    } else {
      lines.push("Calendar today:");
      for (const event of context.events) {
        if (event.allDay) {
          lines.push(`- ${event.title} (all day)`);
          continue;
        }
        const start = new Date(event.start).getTime();
        const end = new Date(event.end).getTime();
        const status =
          end <= now.getTime() ? ", already ended" : start <= now.getTime() ? ", happening now" : "";
        lines.push(
          `- ${event.title} (${formatTime(event.start, zone)} to ${formatTime(event.end, zone)}${status})`,
        );
      }
    }
  } else {
    lines.push(
      "Calendar today: could not be read. Do not describe the calendar as empty or clear, and do not invent events.",
    );
  }

  // Free time and deadlines come from the same calendars, so they share the honesty rule above.
  if (context.calendarState === "ok") {
    const days = [
      ["today", localDate(zone, now)],
      ["tomorrow", localDate(zone, dayBounds(zone, now).end)],
    ];
    for (const [label, date] of days) {
      const slots = context.free.filter((slot) => localDate(zone, new Date(slot.start)) === date);
      const said = slots.map((slot) => `${formatTime(slot.start, zone)} to ${formatTime(slot.end, zone)}`).join(", ");
      if (said) lines.push(`Free time ${label}: ${said}.`);
      else if (label === "today") lines.push("Free time today: none left.");
    }
    lines.push(
      context.deadlines.length === 0
        ? "Deadlines on the Zeno calendar: none in the next 14 days."
        : `Deadlines: ${context.deadlines.map((item) => `${item.title}, due ${dueIn(item.daysLeft)} (${item.date})`).join("; ")}.`,
    );
  } else {
    lines.push("Free time and deadlines: could not be read. Do not invent free time or deadlines.");
  }

  if (context.tasksState === "ok") {
    const { streak, best, stepsThisWeek, atRisk, milestone } = context.progress;
    lines.push(
      [
        `Progress: ${streak > 0 ? `a ${streak}-day streak` : "no streak right now"} (best ${best}), ${stepsThisWeek} steps finished this week.`,
        milestone && `They reached a ${milestone}-day milestone today.`,
        atRisk && "Nothing is finished yet today, and one 5-minute step keeps the streak going tonight.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  } else {
    lines.push("Streak and progress: could not be read. Do not guess them.");
  }

  if (context.emailState === "ok") {
    if (context.emails.length === 0) {
      lines.push("Recent email: inbox top is clear.");
    } else {
      lines.push("Recent email, newest first. Mention only what needs the person:");
      for (const item of context.emails) {
        lines.push(
          `- ${item.unread ? "[unread] " : ""}${item.subject} from ${item.from}. ${item.snippet.slice(0, 100)}`,
        );
      }
    }
  } else {
    lines.push(
      "Recent email: could not be read. Do not describe the inbox as empty or clear, do not say no email needs a reply, and do not invent emails.",
    );
  }

  return lines.join("\n");
}
