import type { Session } from "next-auth";
import type { CalendarWrite, Deadline, FreeSlot } from "@/lib/day";
import { dayBounds } from "@/lib/tz";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function getTodayEvents(accessToken: string, timeZone: string): Promise<CalendarEvent[]> {
  const { start, end } = dayBounds(timeZone);

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    timeZone,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Calendar request failed with ${response.status}: ${body.slice(0, 300)}`);
    (error as Error & { status?: number; body?: string }).status = response.status;
    (error as Error & { status?: number; body?: string }).body = body;
    throw error;
  }

  const data = (await response.json()) as { items?: GoogleEvent[] };
  return (data.items ?? []).map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    title: item.summary ?? "Untitled event",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
  }));
}

// Contract stubs (docs/PLAN-NOV.md); the calendar track fills them in.

// Free gaps across all of the person's calendars that fit `minutes`, soonest first, over the next `days` days
// (1 means the rest of today).
export async function freeSlots(accessToken: string, timeZone: string, opts: { minutes: number; days?: number }): Promise<FreeSlot[]> {
  void [accessToken, timeZone, opts];
  return [];
}

// All-day "Due:" events on the Zeno calendar in the next 14 days, soonest first.
export async function upcomingDeadlines(accessToken: string, timeZone: string): Promise<Deadline[]> {
  void [accessToken, timeZone];
  return [];
}

// Whether Zeno may write to its own calendar in this session.
export function calendarWriteFor(session: Pick<Session, "accessToken" | "error">): CalendarWrite {
  return session.accessToken && !session.error ? "needs-permission" : "no-access";
}
