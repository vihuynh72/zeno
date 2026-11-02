// Pure rules behind the desk's rows and the week grid. Only tz.ts besides types, so the checks run in plain node.
import type { DayEvent } from "@/lib/day";
import { formatTime, localIso } from "@/lib/tz";

export type Mark = "past" | "now" | "next" | null;

// Events that ended go quiet; the one on now is marked, or else the next one. All-day events stay plain.
export function markEvents(events: DayEvent[], now: number): Mark[] {
  const timed = events.map((event) => (event.allDay ? null : { start: Date.parse(event.start), end: Date.parse(event.end) }));
  const marks: Mark[] = timed.map((t) => (t && t.end <= now ? "past" : null));
  const current = timed.findIndex((t) => t && t.start <= now && now < t.end);
  const next = timed.findIndex((t) => t && t.start > now);
  if (current >= 0) marks[current] = "now";
  else if (next >= 0) marks[next] = "next";
  return marks;
}

// "Dana Lee <dana@school.edu>" reads as Dana Lee; a bare address stays as it is.
export function senderName(from: string) {
  const name = from.replace(/<[^>]*>/g, "").trim().replace(/^"(.*)"$/, "$1").trim();
  return name || from.replace(/[<>]/g, "").trim();
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Gmail snippets arrive HTML-escaped ("I&#39;ll"), and React would show the entities as typed.
export function unescapeHtml(text: string) {
  return text.replace(
    /&(?:(amp|lt|gt|quot|apos|nbsp)|#(\d{1,7})|#x([\da-f]{1,6}));/gi,
    (entity, name: string | undefined, dec: string | undefined, hex: string | undefined) => {
      if (name) return NAMED[name.toLowerCase()];
      const code = dec ? Number(dec) : parseInt(hex ?? "", 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    },
  );
}

// ---- The week grid (week-grid.check.ts covers these) ----
// Grid positions are minutes on the zone's wall clock, 0 to 1440, as Google Calendar draws them: on the day clocks
// fall back the repeated hour shares its row, and on the day they spring forward the skipped hour stays empty.

const MINUTE = 60_000;
const DAY = 1440 * MINUTE;

// The browser's zone, the one the layout script stores in the tz cookie for the routes.
export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Calendar-date math on YYYY-MM-DD; dates carry no zone, so UTC only keeps the arithmetic exact.
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
export const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

// "Nov 2 – 8", or "Oct 26 – Nov 1" across a month.
export function weekLabel(monday: string) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return `${dateLabel(monday, { month: "short", day: "numeric" })} – ${dateLabel(sunday, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
}

// Minutes past midnight of `date` on the zone's clock at `instant`; negative or past 1440 on the days around it.
function clockOn(instant: number, date: string, timeZone: string) {
  const iso = localIso(new Date(instant), timeZone); // 2026-11-02T09:30-08:00
  const days = Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY);
  return days * 1440 + Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

// Where `instant` sits in the grid's column for `date`, clipped to that day.
export const wallMinutes = (instant: number, date: string, timeZone: string) =>
  Math.min(1440, Math.max(0, clockOn(instant, date, timeZone)));

// The instant the zone's clock reads `minutes` past midnight on `date`; the second pass settles a DST jump.
export function instantAt(date: string, minutes: number, timeZone: string) {
  let instant = Date.parse(`${date}T00:00:00Z`) + minutes * MINUTE;
  for (let pass = 0; pass < 2; pass++) instant += (minutes - clockOn(instant, date, timeZone)) * MINUTE;
  return instant;
}

type Timed = { start: string; end: string; allDay: boolean };
export type Placed<T> = { event: T; top: number; bottom: number; col: number; cols: number };

// A day's timed events as grid boxes, by start (longer first on a tie). Events that overlap share the width side by
// side: each takes the first column free at its start. A short event still draws `minMinutes` tall, so overlap
// counts that height too. Unreadable times are left out.
export function layoutDay<T extends Timed>(events: T[], date: string, timeZone: string, minMinutes = 0): Placed<T>[] {
  const placed = events
    .flatMap((event) => {
      const start = Date.parse(event.start);
      const end = Date.parse(event.end);
      if (event.allDay || !(end >= start)) return [];
      const top = wallMinutes(start, date, timeZone);
      const wallEnd = wallMinutes(end, date, timeZone);
      // In the repeated hour as clocks fall back, an event can end "before" it starts on the wall clock.
      const bottom = wallEnd >= top ? wallEnd : Math.min(1440, top + (end - start) / MINUTE);
      return [{ event, top, bottom, col: 0, cols: 1 }];
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  let cluster: Placed<T>[] = [];
  let ends: number[] = [];
  const close = () => {
    for (const box of cluster) box.cols = ends.length;
    cluster = [];
    ends = [];
  };
  for (const box of placed) {
    const drawnEnd = Math.max(box.bottom, box.top + minMinutes);
    if (ends.length > 0 && box.top >= Math.max(...ends)) close();
    const free = ends.findIndex((end) => end <= box.top);
    box.col = free >= 0 ? free : ends.length;
    ends[box.col] = drawnEnd;
    cluster.push(box);
  }
  close();
  return placed;
}

export type Gap = { top: number; bottom: number };

// Open time between `from` and `to` (wall minutes) that no busy box touches, at least `min` minutes long.
export function freeGaps(busy: Gap[], from: number, to: number, min = 15): Gap[] {
  const gaps: Gap[] = [];
  let cursor = from;
  for (const box of [...busy].sort((a, b) => a.top - b.top).concat({ top: to, bottom: to })) {
    const end = Math.min(box.top, to);
    if (end - cursor >= min) gaps.push({ top: cursor, bottom: end });
    cursor = Math.max(cursor, box.bottom);
    if (cursor >= to) break;
  }
  return gaps;
}

// Waking hours the grid offers to plan in, as wall minutes.
export const PLAN_HOURS = { from: 7 * 60, to: 23 * 60 };

// Where planning can start on `date`: never in the past, from now (to the next 5 minutes) today, and only within the
// 30 days booking accepts. null when nothing on that day can be booked.
export function planFrom(date: string, today: string, nowMinutes: number) {
  if (date < today || date > addDays(today, 29)) return null;
  const from = date === today ? Math.max(PLAN_HOURS.from, Math.ceil(nowMinutes / 5) * 5) : PLAN_HOURS.from;
  return from < PLAN_HOURS.to ? from : null;
}

// A block of `minutes` tapped at `at` in a gap starts on the quarter hour at or before the tap, kept inside the gap.
export const planStart = (gap: Gap, at: number, minutes: number) =>
  Math.max(gap.top, Math.min(Math.floor(at / 15) * 15, gap.bottom - minutes));

// "2:30 – 4:00 PM", or "11:30 AM – 1:00 PM" across noon.
export function timeRange(start: string | number, end: string | number, timeZone: string) {
  const [from, to] = [formatTime(new Date(start), timeZone), formatTime(new Date(end), timeZone)];
  const meridiem = /\s[AP]M$/.exec(to)?.[0]; // ICU may put a narrow no-break space before AM
  return `${meridiem && from.endsWith(meridiem) ? from.slice(0, -meridiem.length) : from} – ${to}`;
}
