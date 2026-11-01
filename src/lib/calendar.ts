import type { Session } from "next-auth";
import type { CalendarBlock, CalendarWrite, Deadline, FreeSlot, WeekEvent } from "@/lib/day";
import { ensureSchema, getSql } from "@/lib/db";
import { isId, setStepSchedule } from "@/lib/goals";
import { dayBounds, localDate, localHour } from "@/lib/tz";

// The narrowest Google scope that lets Zeno make its own calendar and write events only there.
export const CALENDAR_WRITE = "https://www.googleapis.com/auth/calendar.app.created";

const API = "https://www.googleapis.com/calendar/v3";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  // A block Zeno booked (it carries Zeno's private event property).
  zeno: boolean;
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

type GoogleError = Error & { status?: number; body?: string };

// Every Calendar API call. A failure throws with the HTTP status, so routes can tell a missing permission from an outage.
async function google<T>(accessToken: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) {
    const body = await response.text();
    const error: GoogleError = new Error(`Calendar request failed with ${response.status}: ${body.slice(0, 300)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return (response.status === 204 ? null : await response.json()) as T;
}

const statusOf = (error: unknown) => (error as GoogleError | null)?.status;
const gone = (error: unknown) => statusOf(error) === 404 || statusOf(error) === 410;

// What a failed call means for the person: reconnect Google, grant the write scope, or try again later.
// A 403 is a missing scope only when Google says so; rate limits are 403s too.
export function calendarFailure(error: unknown): "no-access" | "needs-permission" | "error" {
  if (statusOf(error) === 401) return "no-access";
  if (statusOf(error) === 403 && /insufficient/i.test((error as GoogleError).body ?? "")) return "needs-permission";
  return "error";
}

// Whether Zeno may write to its own calendar in this session: only once the person granted the write scope.
export function calendarWriteFor(session: Pick<Session, "accessToken" | "error" | "scope">): CalendarWrite {
  if (!session.accessToken || session.error) return "no-access";
  return session.scope?.split(" ").includes(CALENDAR_WRITE) ? "ok" : "needs-permission";
}

const ZENO_DESCRIPTION = "Added by Zeno";

type Shown = { id: string; color: string | null; primary: boolean; zeno: boolean };

// The calendars the person shows in Google Calendar; hidden ones are skipped, as Google's own grid does.
// A Zeno calendar they own always counts, even if Google lists it unselected, so Zeno's own blocks stay busy time.
async function shownCalendars(accessToken: string): Promise<Shown[]> {
  type Listed = { id?: string; selected?: boolean; primary?: boolean; description?: string; backgroundColor?: string; accessRole?: string };
  const data = await google<{ items?: Listed[] }>(
    accessToken,
    "/users/me/calendarList?maxResults=250&fields=items(id,selected,primary,description,backgroundColor,accessRole)",
  );
  return (data.items ?? []).flatMap((item) => {
    // Owner only: someone else's shared Zeno calendar is never Zeno's to write to.
    const zeno = item.description === ZENO_DESCRIPTION && item.accessRole === "owner";
    if (!item.id || !(item.selected || item.primary || zeno)) return [];
    const color = /^#[0-9a-f]{6}$/i.test(item.backgroundColor ?? "") ? item.backgroundColor! : null;
    return [{ id: item.id, color, primary: Boolean(item.primary), zeno }];
  });
}

async function listEvents(accessToken: string, calendarId: string, timeMin: number, timeMax: number, timeZone: string) {
  const params = new URLSearchParams({
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    timeZone,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const data = await google<{ items?: GoogleEvent[] }>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return data.items ?? [];
}

// Events from every shown calendar. A broken holiday or shared calendar is skipped, but the primary one failing
// (or all of them) fails the read, so an outage never looks like a clear day.
async function eventsAcross(accessToken: string, timeZone: string, timeMin: number, timeMax: number) {
  const calendars = await shownCalendars(accessToken);
  const results = await Promise.allSettled(calendars.map(({ id }) => listEvents(accessToken, id, timeMin, timeMax, timeZone)));
  const fatal = results.find(
    (result, index) => result.status === "rejected" && (calendars[index].primary || results.every((other) => other.status === "rejected")),
  );
  if (fatal?.status === "rejected") throw fatal.reason;
  return results.flatMap((result, index) =>
    result.status === "fulfilled" ? result.value.map((item) => ({ ...eventFrom(item), color: calendars[index].color })) : [],
  );
}

function eventFrom(item: GoogleEvent): CalendarEvent {
  return {
    id: item.id ?? crypto.randomUUID(),
    title: item.summary ?? "Untitled event",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    zeno: Boolean(item.extendedProperties?.private?.zenoKind),
  };
}

// All-day first, then by start.
const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  Number(b.allDay) - Number(a.allDay) || Date.parse(a.start) - Date.parse(b.start);

export async function getTodayEvents(accessToken: string, timeZone: string): Promise<CalendarEvent[]> {
  const { start, end } = dayBounds(timeZone);
  return (await eventsAcross(accessToken, timeZone, start.getTime(), end.getTime())).sort(byStart);
}

// ---- Local days, waking hours and free gaps (pure, so calendar.check.ts covers them) ----

export type Interval = { start: number; end: number };
export type LocalDay = { date: string; start: number; end: number };

// `count` local days from the one holding `from`; a DST day is 23 or 25 hours long.
export function localDays(timeZone: string, from: Date, count: number): LocalDay[] {
  const days: LocalDay[] = [];
  for (let at = from; days.length < count; ) {
    const { start, end } = dayBounds(timeZone, at);
    days.push({ date: localDate(timeZone, start), start: start.getTime(), end: end.getTime() });
    at = end;
  }
  return days;
}

// An instant on the local date (YYYY-MM-DD): noon UTC is that date from UTC-12 to UTC+11, a half-day nudge covers the rest.
export function instantOn(timeZone: string, date: string) {
  const noon = Date.parse(`${date}T12:00:00Z`);
  const local = localDate(timeZone, new Date(noon));
  return new Date(local === date ? noon : local > date ? noon - 12 * HOUR : noon + 12 * HOUR);
}

// When the zone's clock reads hour:00 on the local day starting at dayStart, after any (whole-hour) DST jump that day.
function atHour(timeZone: string, dayStart: number, hour: number) {
  const guess = dayStart + hour * HOUR;
  const drift = ((((localHour(timeZone, new Date(guess)) - hour) % 24) + 36) % 24) - 12;
  return guess - drift * HOUR;
}

const WAKING = { from: 8, to: 23 };

// Waking hours (whole local hours) over `days` local days, starting now rounded up to 5 minutes.
export function wakingWindows(timeZone: string, now: Date, days: number, hours = WAKING): Interval[] {
  const from = Math.ceil(now.getTime() / (5 * MINUTE)) * 5 * MINUTE;
  return localDays(timeZone, now, days)
    .map((day) => ({
      start: Math.max(from, day.start, atHour(timeZone, day.start, hours.from)),
      end: Math.min(day.end, atHour(timeZone, day.start, hours.to)),
    }))
    .filter((window) => window.end > window.start);
}

// Gaps of at least `minutes` inside the windows that no busy interval touches, soonest first, at most 12.
export function gapsBetween(busy: Interval[], windows: Interval[], minutes: number): FreeSlot[] {
  const merged: Interval[] = [];
  for (const interval of [...busy].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  const slots: FreeSlot[] = [];
  for (const window of windows) {
    let cursor = window.start;
    // The window's end works as one last busy interval, so the gap before it counts.
    for (const interval of [...merged, { start: window.end, end: window.end }]) {
      if (interval.end <= cursor) continue;
      const gapEnd = Math.min(interval.start, window.end);
      if (gapEnd - cursor >= minutes * MINUTE) {
        slots.push({ start: new Date(cursor).toISOString(), end: new Date(gapEnd).toISOString() });
      }
      cursor = Math.max(cursor, interval.end);
      if (cursor >= window.end) break;
    }
  }
  return slots.slice(0, 12);
}

// Free gaps across all of the person's shown calendars that fit `minutes`, soonest first, over the next `days` days
// (1 means the rest of today), inside waking hours (8:00 to 23:00 local unless `hours` says otherwise).
export async function freeSlots(
  accessToken: string,
  timeZone: string,
  opts: { minutes: number; days?: number; hours?: { from: number; to: number } },
  now = new Date(),
): Promise<FreeSlot[]> {
  const windows = wakingWindows(timeZone, now, opts.days ?? 1, opts.hours);
  if (windows.length === 0) return [];
  // shortcut: freeBusy takes 50 calendars per query; page through them if someone shows more
  const calendars = (await shownCalendars(accessToken)).slice(0, 50);
  type Entry = { busy?: { start?: string; end?: string }[]; errors?: unknown[] };
  const data = await google<{ calendars?: Record<string, Entry> }>(accessToken, "/freeBusy", {
    method: "POST",
    body: {
      timeMin: new Date(windows[0].start).toISOString(),
      timeMax: new Date(windows[windows.length - 1].end).toISOString(),
      timeZone,
      items: calendars.map(({ id }) => ({ id })),
    },
  });
  // A calendar Google could not read (its errors field) adds no busy time. For the primary one that would make
  // classes look free, so it fails the read instead.
  const primary = calendars.find((calendar) => calendar.primary);
  const primaryErrors = primary ? data.calendars?.[primary.id]?.errors : undefined;
  if (primaryErrors?.length) throw new Error(`freeBusy could not read the primary calendar: ${JSON.stringify(primaryErrors).slice(0, 200)}`);
  const busy = Object.values(data.calendars ?? {})
    .flatMap((calendar) => calendar.busy ?? [])
    .map((interval) => ({ start: Date.parse(interval.start ?? ""), end: Date.parse(interval.end ?? "") }))
    .filter((interval) => interval.end > interval.start);
  return gapsBetween(busy, windows, opts.minutes);
}

// ---- Dates and blocks ----

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A time with an explicit offset: one without would be read in the server's zone (UTC).
const OFFSET_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

// A real calendar date: JS rolls 2026-02-30 over to March 2, so the round trip has to match.
export function realDate(value: unknown): value is string {
  return typeof value === "string" && DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

const nextDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);

export function isMonday(value: unknown): value is string {
  return realDate(value) && new Date(`${value}T00:00:00Z`).getUTCDay() === 1;
}

// Monday of this week in the zone, YYYY-MM-DD.
export function thisMonday(timeZone: string, now = new Date()) {
  const today = new Date(`${localDate(timeZone, now)}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return today.toISOString().slice(0, 10);
}

const KINDS: readonly string[] = ["step", "todo", "deadline"];

// Blocks from a request body. They are model-proposed, so untrusted: each is checked on its own and an invalid one
// is left out, so one bad block never cancels a pasted batch. null when the list itself is off or none is valid.
// A proposal can be filtered with this too, so it only offers what booking accepts.
export function validBlocks(input: unknown, timeZone: string, now = new Date()): CalendarBlock[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 12) return null;
  const today = localDate(timeZone, now);
  const blocks = input.flatMap((raw) => validBlock(raw, today, now.getTime()) ?? []);
  return blocks.length > 0 ? blocks : null;
}

function validBlock(raw: unknown, today: string, now: number): CalendarBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const { title, kind, start, end, date, stepId } = raw as Record<string, unknown>;
  if (typeof title !== "string" || typeof kind !== "string" || !KINDS.includes(kind)) return null;
  if (stepId != null && !isId(stepId)) return null;
  let clean = title.replace(/[\p{Cc}\s]+/gu, " ").trim();
  if (kind === "deadline") clean = clean.replace(/^due:\s*/i, ""); // booking adds "Due: " itself
  const length = [...clean].length;
  if (length < 1 || length > 120) return null;
  // Only a timed block is a step's booking; a deadline never links one.
  const block = { title: clean, kind: kind as CalendarBlock["kind"], ...(isId(stepId) && kind !== "deadline" ? { stepId } : {}) };

  if (kind === "deadline") {
    const days = realDate(date) ? daysBetween(today, date) : NaN;
    return days >= 0 && days <= 120 ? { ...block, date: date as string } : null;
  }
  if (typeof start !== "string" || typeof end !== "string" || !OFFSET_TIME.test(start) || !OFFSET_TIME.test(end)) return null;
  const from = Date.parse(start);
  const to = Date.parse(end);
  const minutes = (to - from) / MINUTE;
  // A few minutes of grace for a proposal tapped just after its start.
  const inRange = from >= now - 15 * MINUTE && to > now && to <= now + 30 * DAY;
  // 1 to 240 minutes, as steps and to-dos allow: a first step is shorter than 5 when memory says that works.
  if (!(minutes >= 1 && minutes <= 240) || !inRange) return null;
  return { ...block, start: new Date(from).toISOString(), end: new Date(to).toISOString() };
}

// ---- The Zeno calendar ----

async function savedZenoCalendar(email: string): Promise<string | null> {
  await ensureSchema();
  const [row] = await getSql()`SELECT zeno_calendar_id FROM user_state WHERE user_email = ${email}`;
  return row?.zeno_calendar_id ? String(row.zeno_calendar_id) : null;
}

export async function createZenoCalendar(accessToken: string, timeZone: string): Promise<string> {
  const created = await google<{ id?: string }>(accessToken, "/calendars", {
    method: "POST",
    body: { summary: "Zeno", description: ZENO_DESCRIPTION, timeZone },
  });
  if (!created.id) throw new Error("Calendar create returned no id");
  return created.id;
}

// The person's Zeno calendar: the saved one while Google still has it, else one Zeno made before (a lost save or a
// cleared user_state), else a new one, made on the first booking and again if they deleted it.
export async function ensureZenoCalendar(accessToken: string, email: string, timeZone: string): Promise<string> {
  const saved = await savedZenoCalendar(email);
  if (saved) {
    try {
      await google(accessToken, `/calendars/${encodeURIComponent(saved)}?fields=id`);
      return saved;
    } catch (error) {
      if (!gone(error)) throw error;
    }
  }
  const listed = (await shownCalendars(accessToken)).find((calendar) => calendar.zeno && calendar.id !== saved)?.id;
  const id = listed ?? (await createZenoCalendar(accessToken, timeZone));
  // Compare-and-swap on the id read above, so when two first bookings race, the first save wins.
  const [won] = await getSql()`
    INSERT INTO user_state (user_email, zeno_calendar_id) VALUES (${email}, ${id})
    ON CONFLICT (user_email) DO UPDATE SET zeno_calendar_id = EXCLUDED.zeno_calendar_id, updated_at = now()
    WHERE user_state.zeno_calendar_id IS NOT DISTINCT FROM ${saved}::text
    RETURNING zeno_calendar_id
  `;
  if (won) return id;
  // Lost the race: use the winner's calendar and remove the empty one just made.
  const winner = (await savedZenoCalendar(email)) ?? id;
  if (!listed && winner !== id) {
    await google(accessToken, `/calendars/${encodeURIComponent(id)}`, { method: "DELETE" }).catch((error) =>
      console.error("Removing a duplicate Zeno calendar failed:", error),
    );
  }
  return winner;
}

// Deadlines are all-day "Due:" events that never block free time; steps and to-dos are timed, with a 10-minute popup.
export function eventFor(block: CalendarBlock, timeZone: string) {
  const extendedProperties = { private: { zenoKind: block.kind, ...(block.stepId ? { zenoStepId: block.stepId } : {}) } };
  if (block.kind === "deadline" && block.date) {
    return {
      summary: `Due: ${block.title}`,
      start: { date: block.date },
      end: { date: nextDate(block.date) },
      transparency: "transparent",
      extendedProperties,
    };
  }
  return {
    summary: block.title,
    start: { dateTime: block.start, timeZone },
    end: { dateTime: block.end, timeZone },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
    extendedProperties,
  };
}

export async function insertBlock(accessToken: string, calendarId: string, timeZone: string, block: CalendarBlock): Promise<string> {
  const created = await google<{ id?: string }>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: eventFor(block, timeZone),
  });
  if (!created.id) throw new Error("Event insert returned no id");
  return created.id;
}

// Books validated blocks on the Zeno calendar and links booked steps. Returns only what Google confirmed;
// when nothing was booked, it throws the first failure so the route can say why.
export async function bookBlocks(accessToken: string, email: string, timeZone: string, blocks: CalendarBlock[]): Promise<CalendarBlock[]> {
  const calendarId = await ensureZenoCalendar(accessToken, email, timeZone);
  const results = await Promise.allSettled(blocks.map((block) => insertBlock(accessToken, calendarId, timeZone, block)));
  const booked = blocks.flatMap((block, index) => {
    const result = results[index];
    return result.status === "fulfilled" ? [{ ...block, eventId: result.value }] : [];
  });
  const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (booked.length === 0) throw failed[0].reason;
  if (failed.length > 0) console.error(`Booked ${booked.length} of ${blocks.length} blocks; first failure:`, failed[0].reason);
  // The events exist now, so a failed link is logged, never reported as a failed booking (a retry would book twice).
  await Promise.all(
    booked.flatMap((block) => (block.stepId && block.start ? [setStepSchedule(email, block.stepId, block.eventId, block.start)] : [])),
  ).catch((error) => console.error("Linking booked steps failed:", error));
  return booked;
}

// Deletes one event from the Zeno calendar. An event already gone counts as deleted.
export async function deleteBlock(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const path = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  await google(accessToken, path, { method: "DELETE" }).catch((error) => {
    if (!gone(error)) throw error;
  });
}

// Undoes a booking: the event is deleted only ever from the Zeno calendar, and the step linked to that event id
// loses its link, even when the block was already gone (an older booking of a re-booked step keeps the newer link).
export async function unbookBlock(accessToken: string, email: string, eventId: string): Promise<void> {
  const calendarId = await savedZenoCalendar(email);
  if (calendarId) await deleteBlock(accessToken, calendarId, eventId);
  // The event is gone now, so a failed unlink is logged, not reported as a failed undo.
  await getSql()`UPDATE steps SET event_id = NULL, scheduled_at = NULL WHERE user_email = ${email} AND event_id = ${eventId}`.catch(
    (error: unknown) => console.error("Unlinking the step failed:", error),
  );
}

// All-day events on the Zeno calendar (its "Due:" deadlines) from today through the next 14 days, soonest first.
export async function upcomingDeadlines(accessToken: string, email: string, timeZone: string, now = new Date()): Promise<Deadline[]> {
  const calendarId = await savedZenoCalendar(email);
  if (!calendarId) return [];
  const days = localDays(timeZone, now, 15);
  // A Zeno calendar the person deleted holds no deadlines; the next booking makes a new one.
  const items = await listEvents(accessToken, calendarId, days[0].start, days[14].end, timeZone).catch((error) => {
    if (gone(error)) return [];
    throw error;
  });
  return items.flatMap((item) => {
    const date = item.start?.date;
    if (!realDate(date) || item.start?.dateTime) return [];
    const daysLeft = daysBetween(days[0].date, date);
    const title = (item.summary ?? "").replace(/^due:\s*/i, "").trim() || "Untitled";
    return daysLeft >= 0 && daysLeft <= 14 ? [{ title, date, daysLeft }] : [];
  });
}

// ---- The week grid ----

// Each day gets the events that touch it: timed ones by instant, all-day ones by date (Google's end date is exclusive).
export function bucketWeek(events: WeekEvent[], days: LocalDay[]): { date: string; events: WeekEvent[] }[] {
  return days.map((day) => ({
    date: day.date,
    events: events
      .filter((event) =>
        event.allDay
          ? event.start <= day.date && day.date < event.end
          : Date.parse(event.start) < day.end && Date.parse(event.end) > day.start,
      )
      .sort(byStart),
  }));
}

// Seven local days from `monday` (YYYY-MM-DD) with the events from every shown calendar, in Google's calendar colors.
export async function weekEvents(accessToken: string, timeZone: string, monday: string) {
  const days = localDays(timeZone, instantOn(timeZone, monday), 7);
  return bucketWeek(await eventsAcross(accessToken, timeZone, days[0].start, days[6].end), days);
}
