// Sample weeks for the /preview gallery. Importing this answers the browser's /api/calendar/* requests from the
// samples here, so the gallery never reads or books a real calendar, even when the browser is signed in.
// Bookings and undos succeed after a short wait, so the Plan here flow can be tried in the gallery; the week-book-*,
// week-undo-error and week-booking states answer them with a failure, a lost permission, or never.
import type { BookResponse, CalendarBlock, CalendarWrite, WeekEvent, WeekResponse } from "@/lib/day";
import type { Today } from "@/components/day-view";
import { addDays, browserZone, instantAt } from "@/components/desk-rows";
import { localDate } from "@/lib/tz";

export const WEEK_STATES = [
  "week-busy",
  "week-empty",
  "week-loading",
  "week-no-access",
  "week-permission",
  "week-error",
  "week-booking",
  "week-book-error",
  "week-book-permission",
  "week-undo-error",
];

const CLASS = "#7986cb";
const WORK = "#f6bf26";
const HOME = "#33b679";
const ADVISOR = "#e67c73";

// [day from Monday, start, end (next day past 24:00), title, calendar color or "zeno"]; no times means all day.
const BUSY: [number, string, string, string, string][] = [
  [0, "09:00", "09:50", "Biology lecture", CLASS],
  [0, "12:00", "13:00", "Lunch with Maya", HOME],
  [0, "14:30", "14:40", "Email Prof Patel about the extension", "zeno"],
  [1, "08:00", "12:00", "Library shift", WORK],
  [1, "10:00", "10:30", "Shift check-in call", WORK],
  [1, "15:00", "16:15", "Office hours", CLASS],
  [2, "09:00", "09:50", "Biology lecture", CLASS],
  [2, "11:00", "12:30", "Chem lab", CLASS],
  [2, "11:30", "12:00", "Advisor meeting", ADVISOR],
  [2, "", "", "Grandma's birthday", HOME],
  [3, "16:00", "16:25", "List three points for the essay", "zeno"],
  [3, "18:00", "19:30", "Study group for the history essay", CLASS],
  [4, "09:00", "09:50", "Biology lecture", CLASS],
  [4, "", "", "Due: History essay draft", "zeno"],
  [5, "10:00", "14:00", "Library shift", WORK],
  [5, "22:00", "25:00", "Movie night", HOME],
  [6, "17:00", "18:00", "Call home", HOME],
];

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

function sampleWeek(monday: string, empty: boolean, write: CalendarWrite): WeekResponse {
  const timeZone = browserZone();
  const events: WeekEvent[] = empty
    ? []
    : BUSY.map(([day, from, to, title, color], i) => {
        const date = addDays(monday, day);
        const allDay = !from;
        return {
          id: `sample-${i}`,
          title,
          start: allDay ? date : new Date(instantAt(date, minutes(from), timeZone)).toISOString(),
          end: allDay ? addDays(date, 1) : new Date(instantAt(date, minutes(to), timeZone)).toISOString(),
          allDay,
          zeno: color === "zeno",
          color: color === "zeno" ? null : color,
        };
      });
  // As the route buckets them: each day gets what touches it.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const [start, end] = [instantAt(date, 0, timeZone), instantAt(addDays(date, 1), 0, timeZone)];
    const touches = (event: WeekEvent) =>
      event.allDay ? event.start <= date && date < event.end : Date.parse(event.start) < end && Date.parse(event.end) > start;
    return { date, events: events.filter(touches) };
  });
  return { state: "ok", timeZone, days, write };
}

// Today's desk with free time, a Zeno block and deadlines, around the real clock like the gallery's other samples.
export function withPlans(today: Today): Today {
  const at = (minutes: number) => new Date(Math.floor(Date.now() / 1_800_000) * 1_800_000 + minutes * 60_000).toISOString();
  const date = localDate(browserZone());
  const zeno = { title: "Email Prof Patel about the extension", start: at(60), end: at(70), allDay: false, zeno: true };
  return {
    ...today,
    events: [...today.events.filter((event) => event.allDay || Date.parse(event.start) < Date.parse(zeno.start)), zeno, ...today.events.filter((event) => !event.allDay && Date.parse(event.start) >= Date.parse(zeno.start))],
    free: [
      { start: at(70), end: at(90) },
      { start: at(150), end: at(240) },
      { start: at(300), end: at(420) },
    ],
    deadlines: [
      { title: "Lab report", date, daysLeft: 0 },
      { title: "History essay draft", date: addDays(date, 4), daysLeft: 4 },
      { title: "Spring registration", date: addDays(date, 9), daysLeft: 9 },
    ],
  };
}

if (typeof window !== "undefined") {
  const real = window.fetch.bind(window);
  let booked = 0;
  const reply = (body: WeekResponse | BookResponse, status = 200) =>
    new Promise<Response>((resolve) => setTimeout(() => resolve(Response.json(body, { status })), 400));
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (!url.pathname.startsWith("/api/calendar/")) return real(input, init);
    const state = new URLSearchParams(location.search).get("state");
    if (url.pathname === "/api/calendar/week") {
      if (state === "week-loading") return new Promise<Response>(() => {});
      if (state === "week-no-access") return reply({ state: "no-access" }, 403);
      if (state === "week-error") return reply({ state: "error" }, 500);
      const start = url.searchParams.get("start") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return reply({ state: "bad-request" }, 400);
      return reply(sampleWeek(start, state === "week-empty", state === "week-permission" ? "needs-permission" : "ok"));
    }
    if (init?.method === "POST") {
      if (state === "week-booking") return new Promise<Response>(() => {});
      if (state === "week-book-error") return reply({ state: "error" }, 500);
      if (state === "week-book-permission") return reply({ state: "needs-permission" }, 403);
      const { blocks } = JSON.parse(String(init.body)) as { blocks: CalendarBlock[] };
      return reply({ state: "ok", booked: blocks.map((block) => ({ ...block, eventId: `samplebooked${++booked}` })) });
    }
    if (state === "week-undo-error") return reply({ state: "error" }, 500);
    return reply({ state: "ok", booked: [] });
  };
}
