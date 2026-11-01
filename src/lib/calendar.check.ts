// Self-check for calendar.ts: node src/lib/calendar.check.ts
// Slot math, block validation, week bucketing across DST, and the Google request shapes against a stubbed fetch.
// With DATABASE_URL (node --env-file=.env.local ...) it also books and undoes against the real database as a
// throwaway calendar-check-…@zeno.local user whose rows it deletes after.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// calendar.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const {
  CALENDAR_WRITE, bookBlocks, bucketWeek, calendarFailure, calendarWriteFor, createZenoCalendar, deleteBlock, eventFor,
  freeSlots, gapsBetween, getTodayEvents, insertBlock, instantOn, isMonday, localDays, thisMonday, unbookBlock,
  upcomingDeadlines, validBlocks, wakingWindows, weekEvents,
} = await import("./calendar.ts");

const LA = "America/Los_Angeles";
const at = (iso: string) => Date.parse(iso);
const isoOf = (ms: number) => new Date(ms).toISOString();

// ---- Google calls go to a stub; anything else (the database driver) still reaches the network ----
type Call = { method: string; url: string; auth: string | null; type: string | null; body: unknown };
const realFetch = globalThis.fetch;
let calls: Call[] = [];
let reply: (call: Call) => Response = () => Response.json({});
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.startsWith("https://www.googleapis.com/")) return realFetch(input, init);
  const headers = new Headers(init?.headers);
  const call = {
    method: init?.method ?? "GET",
    url,
    auth: headers.get("authorization"),
    type: headers.get("content-type"),
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
  calls.push(call);
  return reply(call);
}) as typeof fetch;
const stub = (handler: (call: Call) => Response) => {
  calls = [];
  reply = handler;
};
const googleError = (status: number, reason: string) =>
  Response.json({ error: { code: status, message: reason, errors: [{ reason }] } }, { status });
const API = "https://www.googleapis.com/calendar/v3";

// ---- Write permission: only the granted write scope counts ----
assert.equal(calendarWriteFor({}), "no-access");
assert.equal(calendarWriteFor({ accessToken: "t", error: "RefreshTokenError", scope: CALENDAR_WRITE }), "no-access");
assert.equal(calendarWriteFor({ accessToken: "t" }), "needs-permission", "a session from before scopes were tracked");
assert.equal(calendarWriteFor({ accessToken: "t", scope: "openid https://www.googleapis.com/auth/calendar.readonly" }), "needs-permission");
assert.equal(calendarWriteFor({ accessToken: "t", scope: `${CALENDAR_WRITE}.extra` }), "needs-permission", "a longer scope is not it");
assert.equal(calendarWriteFor({ accessToken: "t", scope: `openid ${CALENDAR_WRITE} email` }), "ok");

const failure = (status: number, body = "") => Object.assign(new Error("Calendar request failed"), { status, body });
assert.equal(calendarFailure(failure(401)), "no-access");
assert.equal(calendarFailure(failure(403, "Request had insufficient authentication scopes.")), "needs-permission");
assert.equal(calendarFailure(failure(403, '{"errors":[{"reason":"rateLimitExceeded"}]}')), "error", "a rate limit is not a permission");
assert.equal(calendarFailure(failure(500)), "error");
assert.equal(calendarFailure(new Error("network down")), "error");

// ---- Free gaps ----
{
  const T = at("2026-11-02T16:00:00Z"); // Monday 8:00 PST
  const h = (hours: number) => T + hours * 3_600_000;
  const window = [{ start: T, end: h(15) }];
  const busy = [
    { start: h(4), end: h(4 + 10 / 60) }, // 12:00-12:10
    { start: h(1.5), end: h(2.5) }, // overlaps the next one: merged 9:00-10:30
    { start: h(1), end: h(2) },
    { start: h(2.5), end: h(3) }, // touches it: merged 9:00-11:00
    { start: h(4 + 20 / 60), end: h(5) }, // a 10-minute gap before it is too short
    { start: h(-2), end: h(0.5) }, // started before the window
    { start: h(14), end: h(16) }, // runs past the window's end
    { start: h(17), end: h(18) }, // after the window
  ];
  const snapshot = JSON.stringify(busy);
  assert.deepEqual(gapsBetween(busy, window, 15), [
    { start: isoOf(h(0.5)), end: isoOf(h(1)) },
    { start: isoOf(h(3)), end: isoOf(h(4)) },
    { start: isoOf(h(5)), end: isoOf(h(14)) },
  ]);
  assert.equal(JSON.stringify(busy), snapshot, "the busy list is not changed");
  assert.deepEqual(gapsBetween(busy, window, 60).map((slot) => slot.start), [isoOf(h(3)), isoOf(h(5))], "only gaps that fit");
  assert.deepEqual(gapsBetween([{ start: h(-1), end: h(16) }], window, 5), [], "a fully busy window");
  assert.deepEqual(gapsBetween([], window, 5), [{ start: isoOf(T), end: isoOf(h(15)) }], "an empty calendar");
  const many = Array.from({ length: 14 }, (_, day) => ({ start: T + day * 86_400_000, end: T + day * 86_400_000 + 3_600_000 }));
  const capped = gapsBetween([], many, 30);
  assert.equal(capped.length, 12, "at most 12");
  assert.equal(capped[0].start, isoOf(T), "soonest first");
}

// ---- Waking hours in local time, DST days included ----
{
  const windows = (now: string, days = 1, hours?: { from: number; to: number }, zone = LA) =>
    wakingWindows(zone, new Date(now), days, hours).map(({ start, end }) => [isoOf(start), isoOf(end)]);
  // 7:58 PST: the window opens at 8:00 and closes at 23:00 PST.
  assert.deepEqual(windows("2026-11-03T15:58:00Z"), [["2026-11-03T16:00:00.000Z", "2026-11-04T07:00:00.000Z"]]);
  assert.deepEqual(windows("2026-11-03T18:01:30Z")[0][0], "2026-11-03T18:05:00.000Z", "now rounds up to 5 minutes");
  assert.deepEqual(windows("2026-11-03T18:05:00Z")[0][0], "2026-11-03T18:05:00.000Z", "a whole 5 minutes stays");
  assert.deepEqual(windows("2026-11-04T07:30:00Z"), [], "after 23:00 nothing is left today");
  // Nov 1 2026, clocks fall back at 2:00 PDT: 8:00 and 23:00 are PST that day.
  assert.deepEqual(windows("2026-11-01T08:30:00Z"), [["2026-11-01T16:00:00.000Z", "2026-11-02T07:00:00.000Z"]], "fall back");
  // Mar 8 2026, clocks spring forward at 2:00 PST: 8:00 and 23:00 are PDT that day.
  assert.deepEqual(windows("2026-03-08T09:00:00Z"), [["2026-03-08T15:00:00.000Z", "2026-03-09T06:00:00.000Z"]], "spring forward");
  // Three days across the change, Saturday 13:00 PDT onward.
  assert.deepEqual(windows("2026-10-31T20:00:00Z", 3), [
    ["2026-10-31T20:00:00.000Z", "2026-11-01T06:00:00.000Z"],
    ["2026-11-01T16:00:00.000Z", "2026-11-02T07:00:00.000Z"],
    ["2026-11-02T16:00:00.000Z", "2026-11-03T07:00:00.000Z"],
  ]);
  // A custom window to midnight on the 25-hour day ends at the real midnight.
  assert.deepEqual(windows("2026-11-01T08:30:00Z", 1, { from: 6, to: 24 }), [["2026-11-01T14:00:00.000Z", "2026-11-02T08:00:00.000Z"]]);
  // A half-hour zone.
  assert.deepEqual(windows("2026-11-02T00:00:00Z", 1, undefined, "Asia/Kolkata"), [["2026-11-02T02:30:00.000Z", "2026-11-02T17:30:00.000Z"]]);
}

// ---- freeSlots asks Google the right way ----
{
  stub((call) =>
    call.url.includes("/calendarList")
      ? Response.json({
          items: [
            { id: "me@example.com", primary: true, selected: true, backgroundColor: "#9fe1e7" },
            { id: "hidden@example.com", selected: false },
            { id: "club@group.calendar.google.com", selected: true },
            { id: "zeno-cal@group.calendar.google.com", selected: false, description: "Added by Zeno" },
          ],
        })
      : Response.json({
          calendars: {
            "me@example.com": { busy: [{ start: "2026-11-03T17:00:00Z", end: "2026-11-03T18:00:00Z" }] },
            "club@group.calendar.google.com": { errors: [{ domain: "global", reason: "notFound" }] },
            "zeno-cal@group.calendar.google.com": { busy: [{ start: "2026-11-03T16:30:00Z", end: "2026-11-03T16:40:00Z" }] },
          },
        }),
  );
  const slots = await freeSlots("tok", LA, { minutes: 15 }, new Date("2026-11-03T15:58:00Z"));
  assert.deepEqual(slots, [
    { start: "2026-11-03T16:00:00.000Z", end: "2026-11-03T16:30:00.000Z" },
    { start: "2026-11-03T16:40:00.000Z", end: "2026-11-03T17:00:00.000Z" },
    { start: "2026-11-03T18:00:00.000Z", end: "2026-11-04T07:00:00.000Z" },
  ], "a Zeno block counts as busy even when its calendar is listed unselected");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "GET");
  assert.ok(calls[0].url.startsWith(`${API}/users/me/calendarList?`));
  assert.equal(calls[0].auth, "Bearer tok");
  assert.deepEqual(calls[1], {
    method: "POST",
    url: `${API}/freeBusy`,
    auth: "Bearer tok",
    type: "application/json",
    body: {
      timeMin: "2026-11-03T16:00:00.000Z",
      timeMax: "2026-11-04T07:00:00.000Z",
      timeZone: LA,
      items: [{ id: "me@example.com" }, { id: "club@group.calendar.google.com" }, { id: "zeno-cal@group.calendar.google.com" }],
    },
  });
  stub(() => Response.json({}));
  assert.deepEqual(await freeSlots("tok", LA, { minutes: 5 }, new Date("2026-11-04T07:30:00Z")), []);
  assert.equal(calls.length, 0, "no waking time left: Google is not asked");
}

// ---- Blocks from a request are validated ----
{
  const now = new Date("2026-11-02T17:00:00Z"); // Monday 9:00 PST
  const stepId = "0b6c3a52-6d1e-4c43-9d43-8f0a2b1c9e10";
  const step = (start: string, end: string, extra = {}) => ({ title: "Email Prof Patel", kind: "step", start, end, ...extra });
  const one = (block: unknown) => validBlocks([block], LA, now);

  assert.deepEqual(
    one(step("2026-11-02T09:30:00-08:00", "2026-11-02T09:40:00-08:00", { title: "  Email \n Prof\tPatel ", stepId, eventId: "spoofed" })),
    [{ title: "Email Prof Patel", kind: "step", stepId, start: "2026-11-02T17:30:00.000Z", end: "2026-11-02T17:40:00.000Z" }],
    "times normalize to UTC; whitespace collapses; a client eventId is dropped",
  );
  assert.deepEqual(one({ title: "Due: Lab report", kind: "deadline", date: "2026-11-06", stepId }), [
    { title: "Lab report", kind: "deadline", date: "2026-11-06" },
  ], "Due: is added by booking, and a deadline never links a step");
  assert.deepEqual(one({ title: "Buy stamps", kind: "todo", start: "2026-11-02T18:00:00Z", end: "2026-11-02T18:05:00Z", stepId: null }), [
    { title: "Buy stamps", kind: "todo", start: "2026-11-02T18:00:00.000Z", end: "2026-11-02T18:05:00.000Z" },
  ]);
  assert.ok(one({ title: "x".repeat(120), kind: "deadline", date: "2026-11-02" }), "120 characters, due today");
  assert.ok(one({ title: "Essay", kind: "deadline", date: "2027-03-02" }), "120 days out");
  assert.ok(one(step("2026-11-02T08:50:00-08:00", "2026-11-02T09:20:00-08:00")), "started 10 minutes ago");
  assert.ok(one(step("2026-11-02T10:00:00-08:00", "2026-11-02T14:00:00-08:00")), "240 minutes");
  assert.ok(one(step("2026-12-02T08:00:00-08:00", "2026-12-02T08:30:00-08:00")), "ends inside 30 days");

  const bad: [unknown, string][] = [
    [{ title: "Essay", kind: "deadline", date: "2027-03-03" }, "121 days out"],
    [{ title: "Essay", kind: "deadline", date: "2026-11-01" }, "yesterday"],
    [{ title: "Essay", kind: "deadline", date: "2026-02-30" }, "not a real date"],
    [{ title: "Essay", kind: "deadline", date: "2026-11-6" }, "not YYYY-MM-DD"],
    [{ title: "Essay", kind: "deadline" }, "no date"],
    [{ title: "Due:", kind: "deadline", date: "2026-11-06" }, "nothing left after Due:"],
    [{ title: "x".repeat(121), kind: "todo", start: "2026-11-02T18:00:00Z", end: "2026-11-02T18:30:00Z" }, "121 characters"],
    [{ title: "   ", kind: "todo", start: "2026-11-02T18:00:00Z", end: "2026-11-02T18:30:00Z" }, "blank title"],
    [{ title: 42, kind: "todo", start: "2026-11-02T18:00:00Z", end: "2026-11-02T18:30:00Z" }, "title not text"],
    [{ title: "Meet", kind: "meeting", start: "2026-11-02T18:00:00Z", end: "2026-11-02T18:30:00Z" }, "unknown kind"],
    [step("2026-11-02T09:30:00-08:00", "2026-11-02T09:40:00-08:00", { stepId: "step-1" }), "stepId not a uuid"],
    [step("2026-11-02T09:30:00", "2026-11-02T09:40:00"), "no offset"],
    [step("2026-11-02T09:40:00-08:00", "2026-11-02T09:30:00-08:00"), "start after end"],
    [step("2026-11-02T09:30:00-08:00", "2026-11-02T09:34:00-08:00"), "4 minutes"],
    [step("2026-11-02T10:00:00-08:00", "2026-11-02T14:01:00-08:00"), "241 minutes"],
    [step("2026-11-02T08:40:00-08:00", "2026-11-02T09:20:00-08:00"), "started 20 minutes ago"],
    [step("2026-11-02T08:46:00-08:00", "2026-11-02T08:55:00-08:00"), "already over"],
    [step("2026-12-02T09:00:00-08:00", "2026-12-02T09:30:00-08:00"), "ends past 30 days"],
    [step("soon", "later"), "not times"],
    [null, "null"],
  ];
  for (const [block, why] of bad) assert.equal(one(block), null, why);
  assert.equal(validBlocks([], LA, now), null, "none");
  assert.equal(validBlocks("blocks", LA, now), null, "not a list");
  const twelve = Array.from({ length: 12 }, () => ({ title: "Essay", kind: "deadline", date: "2026-11-06" }));
  assert.equal(validBlocks(twelve, LA, now)?.length, 12);
  assert.equal(validBlocks([...twelve, twelve[0]], LA, now), null, "13 is too many");
  assert.equal(validBlocks([twelve[0], { title: "", kind: "todo" }], LA, now), null, "one bad block fails the batch");
}

// ---- Weeks: Monday to Sunday in local days, DST weeks included ----
{
  assert.equal(thisMonday(LA, new Date("2026-11-01T20:00:00Z")), "2026-10-26", "Sunday noon");
  assert.equal(thisMonday(LA, new Date("2026-11-02T07:30:00Z")), "2026-10-26", "Sunday 23:30 PST is already Monday in UTC");
  assert.equal(thisMonday(LA, new Date("2026-11-02T08:30:00Z")), "2026-11-02", "Monday 0:30 PST");
  assert.ok(isMonday("2026-11-02") && isMonday("2026-03-02"));
  for (const value of ["2026-11-03", "2026-02-30", "monday", undefined, 20261102]) assert.equal(isMonday(value), false, String(value));

  const hours = (days: { start: number; end: number }[]) => days.map((day) => (day.end - day.start) / 3_600_000);
  const fall = localDays(LA, instantOn(LA, "2026-10-26"), 7);
  assert.deepEqual(fall.map((day) => day.date), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  assert.equal(isoOf(fall[0].start), "2026-10-26T07:00:00.000Z");
  assert.equal(isoOf(fall[6].end), "2026-11-02T08:00:00.000Z");
  assert.deepEqual(hours(fall), [24, 24, 24, 24, 24, 24, 25], "Nov 1 has 25 hours");
  assert.deepEqual(hours(localDays(LA, instantOn(LA, "2026-03-02"), 7)), [24, 24, 24, 24, 24, 24, 23], "Mar 8 has 23 hours");
  for (const zone of ["Pacific/Auckland", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Etc/GMT+12", "Asia/Kolkata", "UTC"]) {
    assert.equal(localDays(zone, instantOn(zone, "2026-11-02"), 1)[0].date, "2026-11-02", zone);
  }

  const event = (title: string, start: string, end: string, allDay = false) => ({ id: title, title, start, end, allDay, zeno: false, color: null });
  const week = bucketWeek(
    [
      event("Late Sunday", "2026-11-01T23:30:00-08:00", "2026-11-02T00:15:00-08:00"),
      event("First 1:30", "2026-11-01T01:30:00-07:00", "2026-11-01T01:45:00-07:00"),
      event("Second 1:30", "2026-11-01T01:30:00-08:00", "2026-11-01T01:45:00-08:00"),
      event("Overnight", "2026-10-30T23:00:00-07:00", "2026-10-31T01:00:00-07:00"),
      event("Retreat", "2026-10-31", "2026-11-02", true),
      event("Last week", "2026-10-25", "2026-10-26", true),
      event("Monday 0:00", "2026-10-26T00:00:00-07:00", "2026-10-26T00:30:00-07:00"),
    ],
    fall,
  );
  assert.deepEqual(
    week.map((day) => [day.date, day.events.map((item) => item.title)]),
    [
      ["2026-10-26", ["Monday 0:00"]],
      ["2026-10-27", []],
      ["2026-10-28", []],
      ["2026-10-29", []],
      ["2026-10-30", ["Overnight"]],
      ["2026-10-31", ["Retreat", "Overnight"]],
      ["2026-11-01", ["Retreat", "First 1:30", "Second 1:30", "Late Sunday"]],
    ],
  );
}

// ---- Reading events from every shown calendar ----
{
  const calendarList = Response.json({
    items: [
      { id: "me@example.com", primary: true, selected: true, backgroundColor: "#9fe1e7" },
      { id: "zeno-cal@group.calendar.google.com", selected: true, backgroundColor: "url(javascript:alert(1))" },
      { id: "broken@group.calendar.google.com", selected: true, backgroundColor: "#ffad46" },
      { id: "hidden@group.calendar.google.com", selected: false, backgroundColor: "#000000" },
    ],
  });
  const items: Record<string, unknown[]> = {
    "me@example.com": [
      { id: "a", summary: "Bio lab", start: { dateTime: "2026-11-02T10:00:00-08:00" }, end: { dateTime: "2026-11-02T11:00:00-08:00" } },
      { id: "b", summary: "Holiday", start: { date: "2026-11-02" }, end: { date: "2026-11-03" } },
    ],
    "zeno-cal@group.calendar.google.com": [
      {
        id: "z",
        summary: "Email Prof Patel",
        start: { dateTime: "2026-11-02T09:30:00-08:00" },
        end: { dateTime: "2026-11-02T09:40:00-08:00" },
        extendedProperties: { private: { zenoKind: "step" } },
      },
    ],
  };
  const reader = (call: Call) => {
    if (call.url.includes("/calendarList")) return calendarList.clone();
    const id = decodeURIComponent(call.url.split("/calendars/")[1].split("/events")[0]);
    return id.startsWith("broken") ? googleError(404, "notFound") : Response.json({ items: items[id] ?? [] });
  };

  stub(reader);
  const today = await getTodayEvents("tok", LA);
  assert.deepEqual(today.map((item) => [item.title, item.zeno, item.allDay]), [
    ["Holiday", false, true],
    ["Email Prof Patel", true, false],
    ["Bio lab", false, false],
  ]);
  const listed = calls.filter((call) => call.url.includes("/events?"));
  assert.equal(listed.length, 3, "every shown calendar, never the hidden one");
  const params = new URL(listed[0].url).searchParams;
  assert.equal(params.get("singleEvents"), "true");
  assert.equal(params.get("orderBy"), "startTime");
  assert.equal(params.get("timeZone"), LA);
  assert.ok(listed.every((call) => call.auth === "Bearer tok"));

  stub(reader);
  const days = await weekEvents("tok", LA, "2026-11-02");
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-11-02");
  assert.deepEqual(days[0].events.map((item) => [item.id, item.color, item.zeno]), [
    ["b", "#9fe1e7", false],
    ["z", null, true],
    ["a", "#9fe1e7", false],
  ], "Google's calendar color, or null when it is not a plain hex color");
  const range = new URL(calls.find((call) => call.url.includes("/events?"))!.url).searchParams;
  assert.equal(range.get("timeMin"), "2026-11-02T08:00:00.000Z");
  assert.equal(range.get("timeMax"), "2026-11-09T08:00:00.000Z");

  stub((call) => (call.url.includes("/calendarList") ? calendarList.clone() : googleError(500, "backendError")));
  await assert.rejects(getTodayEvents("tok", LA), /500/, "every calendar failing is an error");
}

// ---- Writing to the Zeno calendar ----
{
  stub(() => Response.json({ id: "zeno-cal@group.calendar.google.com", summary: "Zeno" }));
  assert.equal(await createZenoCalendar("tok", LA), "zeno-cal@group.calendar.google.com");
  assert.deepEqual(calls, [
    {
      method: "POST",
      url: `${API}/calendars`,
      auth: "Bearer tok",
      type: "application/json",
      body: { summary: "Zeno", description: "Added by Zeno", timeZone: LA },
    },
  ]);

  const stepId = "0b6c3a52-6d1e-4c43-9d43-8f0a2b1c9e10";
  stub(() => Response.json({ id: "evt1" }));
  const timed = { title: "Email Prof Patel", kind: "step" as const, stepId, start: "2026-11-02T17:30:00.000Z", end: "2026-11-02T17:40:00.000Z" };
  assert.equal(await insertBlock("tok", "zeno-cal@group.calendar.google.com", LA, timed), "evt1");
  assert.deepEqual(calls, [
    {
      method: "POST",
      url: `${API}/calendars/zeno-cal%40group.calendar.google.com/events`,
      auth: "Bearer tok",
      type: "application/json",
      body: {
        summary: "Email Prof Patel",
        start: { dateTime: "2026-11-02T17:30:00.000Z", timeZone: LA },
        end: { dateTime: "2026-11-02T17:40:00.000Z", timeZone: LA },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
        extendedProperties: { private: { zenoKind: "step", zenoStepId: stepId } },
      },
    },
  ]);
  stub(() => Response.json({ id: "evt2" }));
  await insertBlock("tok", "zeno-cal@group.calendar.google.com", LA, { title: "Lab report", kind: "deadline", date: "2026-12-31" });
  assert.deepEqual(calls[0].body, {
    summary: "Due: Lab report",
    start: { date: "2026-12-31" },
    end: { date: "2027-01-01" },
    transparency: "transparent",
    extendedProperties: { private: { zenoKind: "deadline" } },
  });
  assert.deepEqual(eventFor({ title: "Buy stamps", kind: "todo", start: timed.start, end: timed.end }, LA).extendedProperties, {
    private: { zenoKind: "todo" },
  });

  // Undo reads the event for its step, then deletes it, both on the Zeno calendar only.
  const path = `${API}/calendars/zeno-cal%40group.calendar.google.com/events/evt1`;
  stub((call) => (call.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ extendedProperties: { private: { zenoKind: "step", zenoStepId: stepId } } })));
  assert.equal(await deleteBlock("tok", "zeno-cal@group.calendar.google.com", "evt1"), stepId);
  assert.deepEqual(calls.map((call) => [call.method, call.url, call.auth, call.body]), [
    ["GET", `${path}?fields=extendedProperties`, "Bearer tok", undefined],
    ["DELETE", path, "Bearer tok", undefined],
  ]);
  stub(() => googleError(410, "deleted"));
  assert.equal(await deleteBlock("tok", "zeno-cal@group.calendar.google.com", "evt1"), null, "already gone is undone");
  assert.equal(calls.length, 1, "nothing to delete");
  stub((call) => (call.method === "DELETE" ? googleError(410, "deleted") : Response.json({ extendedProperties: { private: { zenoStepId: stepId } } })));
  assert.equal(await deleteBlock("tok", "zeno-cal@group.calendar.google.com", "evt1"), stepId, "deleted in between still unlinks");
  stub((call) => (call.method === "DELETE" ? googleError(500, "backendError") : Response.json({})));
  await assert.rejects(deleteBlock("tok", "zeno-cal@group.calendar.google.com", "evt1"), /500/);
}

// ---- Booking and undo against the real database (only with DATABASE_URL) ----
if (process.env.DATABASE_URL) {
  const { currentGoal, setGoal } = await import("./goals.ts");
  const { getSql } = await import("./db.ts");
  const email = `calendar-check-${crypto.randomUUID()}@zeno.local`;
  try {
    const goal = await setGoal(email, "Lab report", [{ title: "Email Prof Patel", minutes: 5 }, { title: "Draft results", minutes: 25 }]);
    const stepId = goal.steps[0].id;
    const blocks = [
      { title: "Email Prof Patel", kind: "step" as const, stepId, start: "2026-11-02T17:30:00.000Z", end: "2026-11-02T17:40:00.000Z" },
      { title: "Lab report", kind: "deadline" as const, date: "2026-11-06" },
    ];
    let calendars = 0;
    let events = 0;
    let deletedCalendar = false;
    const google = (call: Call) => {
      if (call.method === "POST" && call.url === `${API}/calendars`) return Response.json({ id: `zeno-${++calendars}@group.calendar.google.com` });
      if (call.method === "GET" && /\/calendars\/[^/]+\?fields=id$/.test(call.url)) {
        return deletedCalendar ? googleError(404, "notFound") : Response.json({ id: "ok" });
      }
      if (call.method === "POST" && call.url.endsWith("/events")) return Response.json({ id: `evt${++events}` });
      return googleError(500, "unexpected");
    };

    stub(google);
    const booked = await bookBlocks("tok", email, LA, blocks);
    assert.deepEqual(booked.map((block) => block.eventId), ["evt1", "evt2"]);
    assert.deepEqual(calls.map((call) => `${call.method} ${call.url.replace(API, "")}`), [
      "POST /calendars",
      "POST /calendars/zeno-1%40group.calendar.google.com/events",
      "POST /calendars/zeno-1%40group.calendar.google.com/events",
    ], "the first booking makes the calendar");
    const [state] = await getSql()`SELECT zeno_calendar_id FROM user_state WHERE user_email = ${email}`;
    assert.equal(state.zeno_calendar_id, "zeno-1@group.calendar.google.com");
    const linked = (await currentGoal(email))!.steps;
    assert.equal(linked[0].eventId, "evt1");
    assert.equal(linked[0].scheduledAt, "2026-11-02T17:30:00.000Z");
    assert.equal(linked[1].eventId, null, "other steps stay unbooked");

    stub(google);
    await bookBlocks("tok", email, LA, [blocks[1]]);
    assert.deepEqual(calls.map((call) => call.method), ["GET", "POST"], "later bookings reuse the calendar");

    deletedCalendar = true;
    stub(google);
    await bookBlocks("tok", email, LA, [blocks[1]]);
    deletedCalendar = false;
    assert.ok(calls[1].url === `${API}/calendars` && calls[2].url.includes("zeno-2%40"), "a deleted calendar is made again");
    assert.equal((await getSql()`SELECT zeno_calendar_id FROM user_state WHERE user_email = ${email}`)[0].zeno_calendar_id, "zeno-2@group.calendar.google.com");

    // One insert failing keeps the rest; all failing on scope says needs-permission.
    stub((call) => (call.url.endsWith("/events") && call.body && (call.body as { summary: string }).summary.startsWith("Due") ? googleError(500, "backendError") : google(call)));
    assert.deepEqual((await bookBlocks("tok", email, LA, blocks)).map((block) => block.kind), ["step"], "only what Google confirmed");
    stub((call) => (call.url.endsWith("/events") ? googleError(403, "Request had insufficient authentication scopes.") : google(call)));
    await assert.rejects(bookBlocks("tok", email, LA, blocks), (error) => calendarFailure(error) === "needs-permission");

    // Deadlines come from the Zeno calendar's all-day events, days left in local time.
    stub(() =>
      Response.json({
        items: [
          { summary: "Due: Lab report", start: { date: "2026-11-06" }, end: { date: "2026-11-07" } },
          { summary: "Email Prof Patel", start: { dateTime: "2026-11-02T09:30:00-08:00" }, end: { dateTime: "2026-11-02T09:40:00-08:00" } },
          { summary: "Due: Essay", start: { date: "2026-11-02" }, end: { date: "2026-11-03" } },
        ],
      }),
    );
    // Sunday Nov 1, 23:30 PST: still Nov 1 locally though Nov 2 in UTC.
    assert.deepEqual(await upcomingDeadlines("tok", email, LA, new Date("2026-11-02T07:30:00Z")), [
      { title: "Lab report", date: "2026-11-06", daysLeft: 5 },
      { title: "Essay", date: "2026-11-02", daysLeft: 1 },
    ]);
    const deadlineRange = new URL(calls[0].url);
    assert.ok(deadlineRange.pathname.endsWith("/calendars/zeno-2%40group.calendar.google.com/events"), "only the Zeno calendar");
    assert.equal(deadlineRange.searchParams.get("timeMin"), "2026-11-01T07:00:00.000Z");
    assert.equal(deadlineRange.searchParams.get("timeMax"), "2026-11-16T08:00:00.000Z", "through the 14th day after today");

    // Undo deletes from the Zeno calendar and clears the step's link.
    stub((call) => (call.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ extendedProperties: { private: { zenoKind: "step", zenoStepId: stepId } } })));
    await unbookBlock("tok", email, "evt1");
    assert.deepEqual(calls.map((call) => `${call.method} ${call.url.replace(API, "")}`), [
      "GET /calendars/zeno-2%40group.calendar.google.com/events/evt1?fields=extendedProperties",
      "DELETE /calendars/zeno-2%40group.calendar.google.com/events/evt1",
    ]);
    const unlinked = (await currentGoal(email))!.steps[0];
    assert.equal(unlinked.eventId, null);
    assert.equal(unlinked.scheduledAt, null);

    stub(google);
    await unbookBlock("tok", `calendar-check-nobody-${crypto.randomUUID()}@zeno.local`, "evt1");
    assert.equal(calls.length, 0, "no Zeno calendar: nothing to undo, nothing asked");
  } finally {
    await getSql()`DELETE FROM goals WHERE user_email = ${email}`;
    await getSql()`DELETE FROM user_state WHERE user_email = ${email}`;
  }
  console.log("calendar self-check passed (with the database)");
} else {
  console.log("calendar self-check passed (database part skipped: no DATABASE_URL)");
}
