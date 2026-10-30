import type { Session } from "next-auth";
import { getTodayEvents, type CalendarEvent } from "@/lib/calendar";
import type { Goal, Memory } from "@/lib/day";
import { databaseConfigured, ensureSchema, getSql } from "@/lib/db";
import { getRecentEmail, type EmailSummary } from "@/lib/gmail";
import { currentGoal, listMemories } from "@/lib/goals";
import { formatDate, formatTime } from "@/lib/tz";

export type UserContext = {
  email: string;
  timeZone: string;
  events: CalendarEvent[];
  calendarState: "ok" | "no-access" | "error";
  tasks: Array<{ title: string; done: boolean }>;
  goal: Goal | null;
  memories: Memory[];
  // The database: tasks, goal and memories load together.
  tasksState: "ok" | "not-configured" | "error";
  emails: EmailSummary[];
  emailState: "ok" | "no-access" | "error";
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
  let tasks: UserContext["tasks"] = [];
  let goal: Goal | null = null;
  let memories: Memory[] = [];
  let tasksState: UserContext["tasksState"] = "not-configured";
  let emails: EmailSummary[] = [];
  let emailState: UserContext["emailState"] = "no-access";

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
    // Tasks, goal and memories are always read fresh so a goal added a moment ago is never missing.
    (async () => {
      if (!databaseConfigured()) return;
      try {
        await ensureSchema();
        const sql = getSql();
        const [rows, current, remembered] = await Promise.all([
          sql`
            SELECT title, done FROM tasks
            WHERE user_email = ${email}
            ORDER BY created_at ASC
          `,
          currentGoal(email),
          listMemories(email),
        ]);
        tasks = rows.map((row) => ({
          title: String(row.title),
          done: Boolean(row.done),
        }));
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
  ]);

  return { email, timeZone, events, calendarState, tasks, goal, memories, tasksState, emails, emailState };
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

// The old brief and chat routes also see the tasks list.
export function contextToText(context: UserContext, now = new Date()): string {
  const lines = [dayToText(context, now)];
  if (context.tasksState === "ok") {
    if (context.tasks.length === 0) {
      lines.push("Goals list: empty.");
    } else {
      lines.push("Goals list:");
      for (const task of context.tasks) {
        lines.push(`- [${task.done ? "done" : "open"}] ${task.title}`);
      }
    }
  } else {
    lines.push("Goals list: could not be read. Do not describe it as empty, and do not invent goals.");
  }
  return lines.join("\n");
}
