// Pure rules behind the desk's rows and the week grid. Only tz.ts besides types, so the checks run in plain node.
import type { CalendarBlock, DayEmail, DayEvent } from "@/lib/day";
import { formatTime, localDate, localIso } from "@/lib/tz";

export type Mark = "past" | "now" | "next" | null;

// The card's bookings (setup's batch, a plan step, a talk offer) join today's desk as the Week's do: only the timed
// blocks Google confirmed. An undone booking is an offer again, so it drops out.
export const bookedEvents = (bookings: { state: string; blocks: CalendarBlock[] }[]): DayEvent[] =>
  bookings.flatMap((booking) =>
    booking.state !== "booked"
      ? []
      : booking.blocks.flatMap((block) => (block.start && block.end ? [{ title: block.title, start: block.start, end: block.end, allDay: false, zeno: true }] : [])),
  );

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

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// An email's snippet as one line of plain text: Gmail sends snippets HTML-escaped ("I&#39;ll be there").
export const snippetLine = (snippet: string) =>
  snippet
    .replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (entity, hex?: string, decimal?: string, name?: string) => {
      const code = hex ? Number.parseInt(hex, 16) : decimal ? Number(decimal) : NaN;
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : (ENTITIES[name?.toLowerCase() ?? ""] ?? entity);
    })
    .split("\n")[0]
    .trim();

// Links from the routes (Google's event pages, the Gmail inbox) open only as https pages, never as script URLs.
export const httpsOnly = (url?: string | null) => (url?.startsWith("https://") ? url : undefined);

// Every mail row opens (Nov 4, Vi: "certain emails you can't even click on"). Where, when Zeno doesn't open it in place:
// code or bank mail at its message in Gmail, never in Zeno, and a row with no id (a day saved before Nov 3) as Gmail's
// search for its subject. null: Zeno opens it. gmail is this account's inbox (the day's mailUrl, without its hash).
export function gmailRow(mail: Pick<DayEmail, "id" | "subject" | "sensitive">, gmail = "https://mail.google.com/mail/"): string | null {
  if (!mail.id) return `${gmail}#search/${encodeURIComponent(`subject:"${mail.subject}"`)}`;
  return mail.sensitive ? `${gmail}#inbox/${encodeURIComponent(mail.id)}` : null;
}

// Gmail's compose window for this account (gmail: the day's mailUrl) with a reply draft filled in: she sends it there,
// Zeno never does (Nov 2: no outbound mail). shortcut: a new message, not threaded under the email, since gmail.readonly
// can't save a Gmail draft; ask Vi before adding the gmail.compose scope.
export function composeUrl(gmail: string, to: string, subject: string, body: string): string {
  const url = new URL(gmail.split("#")[0]);
  const su = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  for (const [key, value] of Object.entries({ view: "cm", fs: "1", to, su, body })) url.searchParams.set(key, value);
  // Spaces as %20, as agent.ts draftUrl sends them: some decoders show "+" as a plus (a typed "+" is already %2B).
  return url.href.replace(/\+/g, "%20");
}

// "https://SJSU.instructure.com/courses/1" reads as sjsu.instructure.com.
export const canvasHost = (base: string) => base.trim().replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase();

// The Canvas sheet's work by the day it is due on the zone's clock, soonest first, under "Today", "Tomorrow", the
// weekday for the rest of the week ahead, then a short date ("Mon, Nov 16"); undated work comes last under "No due
// date", and work due before today (a list kept since yesterday) is left out.
export function dueDays<T extends { due: string | null }>(work: T[], timeZone: string, now: number): { day: string; items: T[] }[] {
  const today = localDate(timeZone, new Date(now));
  const at = (item: T) => Date.parse(item.due ?? "") || Infinity;
  const days = new Map<string, T[]>();
  for (const item of [...work].sort((a, b) => at(a) - at(b))) {
    const date = at(item) < Infinity ? localDate(timeZone, new Date(at(item))) : "";
    if (date && date < today) continue;
    const day = date ? dayName(date, today) : "No due date";
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days].map(([day, items]) => ({ day, items }));
}

// A row's time, only when it isn't 11:59 PM: Canvas work is nearly always due then, and the day heading says the day.
export const dueTime = (due: string | null, timeZone: string) =>
  due && localIso(due, timeZone).slice(11, 16) !== "23:59" ? formatTime(due, timeZone) : null;

function dayName(date: string, today: string) {
  const ahead = Math.round((Date.parse(date) - Date.parse(today)) / DAY);
  if (ahead === 0) return "Today";
  if (ahead === 1) return "Tomorrow";
  return dateLabel(date, ahead < 7 ? { weekday: "long" } : { weekday: "short", month: "short", day: "numeric" });
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
// The week the Week opens on: this one, or from Sunday the one ahead.
export const weekOf = (date: string) => mondayOf(addDays(date, 1));
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
// indent: how many earlier events this one is drawn over; col of cols: its share of the width left after the indent.
export type Placed<T> = { event: T; top: number; bottom: number; col: number; cols: number; indent: number };

// Events starting this close together share the width; later ones cascade, so the title above stays readable.
export const CASCADE_MINUTES = 30;

// A day's timed events as grid boxes, by start (longer first on a tie), laid out like Google Calendar: events that
// start together sit side by side (each takes the first column free at its start); an event that starts later
// is drawn over the right side of the ones it overlaps, one indent deeper, so a long event keeps its width.
// A short event still draws `minMinutes` tall, so overlap counts that height too. Unreadable times are left out.
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
      return [{ event, top, bottom, col: 0, cols: 1, indent: 0 }];
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  const drawnEnd = (box: Placed<T>) => Math.max(box.bottom, box.top + minMinutes);
  const groups: number[][] = []; // per side-by-side group: each column's drawn end
  const groupOf: number[] = [];
  placed.forEach((box, i) => {
    const open = placed.slice(0, i).filter((other) => drawnEnd(other) > box.top);
    const latest = open.findLast((other) => other.top === Math.max(...open.map((o) => o.top)));
    let group: number;
    if (latest && box.top - latest.top < CASCADE_MINUTES) {
      group = groupOf[placed.indexOf(latest)];
      box.indent = latest.indent;
    } else {
      group = groups.push([]) - 1;
      box.indent = open.length > 0 ? Math.max(...open.map((o) => o.indent)) + 1 : 0;
    }
    const columns = groups[group];
    const free = columns.findIndex((end) => end <= box.top);
    box.col = free >= 0 ? free : columns.length;
    columns[box.col] = drawnEnd(box);
    groupOf[i] = group;
  });
  placed.forEach((box, i) => (box.cols = groups[groupOf[i]].length));
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

// The whole hours the week shows: from its earliest timed event to its latest, never less than 8 AM to 9 PM. Each
// box (wall minutes) keeps `tail` minutes after its start, so a short event's drawn box ends inside the grid.
export function hourRange(boxes: Gap[], tail = 0) {
  const from = Math.min(8, ...boxes.map((box) => Math.floor(box.top / 60)));
  const to = Math.max(21, ...boxes.map((box) => Math.ceil(Math.min(1440, Math.max(box.bottom, box.top + tail)) / 60)));
  return { from, to };
}

// "2:30 – 4:00 PM", or "11:30 AM – 1:00 PM" across noon.
export function timeRange(start: string | number, end: string | number, timeZone: string) {
  const [from, to] = [formatTime(new Date(start), timeZone), formatTime(new Date(end), timeZone)];
  const meridiem = /\s[AP]M$/.exec(to)?.[0]; // ICU may put a narrow no-break space before AM
  return `${meridiem && from.endsWith(meridiem) ? from.slice(0, -meridiem.length) : from} – ${to}`;
}
