import { getTodayEvents, type CalendarEvent } from "@/lib/calendar";
import { databaseConfigured, ensureSchema, getSql } from "@/lib/db";
import { getRecentEmail, type EmailSummary } from "@/lib/gmail";

export type UserContext = {
  email: string;
  events: CalendarEvent[];
  calendarState: "ok" | "no-access" | "error";
  tasks: Array<{ title: string; done: boolean }>;
  tasksState: "ok" | "not-configured" | "error";
  emails: EmailSummary[];
  emailState: "ok" | "no-access" | "error";
};

export async function loadUserContext(
  email: string,
  accessToken?: string,
): Promise<UserContext> {
  let events: CalendarEvent[] = [];
  let calendarState: UserContext["calendarState"] = "no-access";
  if (accessToken) {
    try {
      events = await getTodayEvents(accessToken);
      calendarState = "ok";
    } catch {
      calendarState = "error";
    }
  }

  let tasks: UserContext["tasks"] = [];
  let tasksState: UserContext["tasksState"] = "not-configured";
  if (databaseConfigured()) {
    try {
      await ensureSchema();
      const sql = getSql();
      const rows = await sql`
        SELECT title, done FROM tasks
        WHERE user_email = ${email}
        ORDER BY created_at ASC
      `;
      tasks = rows.map((row) => ({
        title: String(row.title),
        done: Boolean(row.done),
      }));
      tasksState = "ok";
    } catch {
      tasksState = "error";
    }
  }

  let emails: EmailSummary[] = [];
  let emailState: UserContext["emailState"] = "no-access";
  if (accessToken) {
    try {
      emails = await getRecentEmail(accessToken);
      emailState = "ok";
    } catch {
      emailState = "error";
    }
  }

  return { email, events, calendarState, tasks, tasksState, emails, emailState };
}

export function contextToText(context: UserContext): string {
  const lines: string[] = [];
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  lines.push(`Today is ${today}.`);

  if (context.calendarState === "ok") {
    if (context.events.length === 0) {
      lines.push("Calendar today: no events.");
    } else {
      lines.push("Calendar today:");
      for (const event of context.events) {
        lines.push(`- ${event.title} (${event.allDay ? "all day" : `${event.start} to ${event.end}`})`);
      }
    }
  } else {
    lines.push("Calendar today: not available. Do not invent events.");
  }

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
    lines.push("Goals list: not available. Do not invent goals.");
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
    lines.push("Recent email: not available. Do not invent emails.");
  }

  return lines.join("\n");
}
