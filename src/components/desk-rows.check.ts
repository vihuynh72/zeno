// Self-check for desk-rows.ts: node src/components/desk-rows.check.ts (the week grid's math: week-grid.check.ts)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { DayEvent } from "@/lib/day";

// desk-rows.ts imports tz.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { bookedEvents, canvasHost, composeUrl, dueDays, dueTime, gmailRow, httpsOnly, markEvents, senderName, snippetLine } = await import("./desk-rows.ts");

// Every mail row opens (Nov 4, Vi: "certain emails you can't even click on"): mail with an id opens in Zeno, code or bank
// mail at its message in this account's Gmail, never in Zeno, and a row with no id as Gmail's search for its subject.
const inbox = "https://mail.google.com/mail/?authuser=maya%40school.edu";
assert.equal(gmailRow({ id: "18c2f", subject: "Lab 3" }, inbox), null);
assert.equal(gmailRow({ id: "18c2f", subject: "Your code is [number]", sensitive: true }, inbox), `${inbox}#inbox/18c2f`);
assert.equal(gmailRow({ subject: 'Lab 3 "moved" & more' }, inbox), `${inbox}#search/subject%3A%22Lab%203%20%22moved%22%20%26%20more%22`);
assert.equal(gmailRow({ subject: "Lab 3" }), "https://mail.google.com/mail/#search/subject%3A%22Lab%203%22", "no account link: plain Gmail");

// A reply draft opens as Gmail's compose window for this account, filled in; she sends it (Nov 4). "Re:" once.
const compose = new URL(composeUrl(`${inbox}#inbox`, "kim@school.edu", "Office hours?", "Hi Kim,\n\nWed at 2 & Thu work.\n\nMaya"));
assert.equal(`${compose.origin}${compose.pathname}`, "https://mail.google.com/mail/");
assert.deepEqual(Object.fromEntries(compose.searchParams), {
  authuser: "maya@school.edu",
  view: "cm",
  fs: "1",
  to: "kim@school.edu",
  su: "Re: Office hours?",
  body: "Hi Kim,\n\nWed at 2 & Thu work.\n\nMaya",
});
assert.equal(new URL(composeUrl("https://mail.google.com/mail/", "a@b.co", "RE: Lab 3", "x")).searchParams.get("su"), "RE: Lab 3");
const spaced = composeUrl("https://mail.google.com/mail/", "a@b.co", "Lab 3", "1 + 1 is 2");
assert.ok(!spaced.includes("+") && spaced.includes("Lab%203"), "spaces as %20, never +");
assert.equal(new URL(spaced).searchParams.get("body"), "1 + 1 is 2", "a typed + stays a +");

const event = (title: string, start: string, end: string, allDay = false): DayEvent => ({ title, start, end, allDay });
const day = [
  event("Birthday", "2026-10-31", "2026-11-01", true),
  event("Standup", "2026-10-31T09:00:00Z", "2026-10-31T09:15:00Z"),
  event("Lecture", "2026-10-31T10:00:00Z", "2026-10-31T11:00:00Z"),
  event("Lunch", "2026-10-31T12:00:00Z", "2026-10-31T13:00:00Z"),
];
const at = (time: string) => Date.parse(`2026-10-31T${time}Z`);

// During the lecture: standup is past, the lecture is now, lunch waits unmarked, the all-day event stays plain.
assert.deepEqual(markEvents(day, at("10:30:00")), [null, "past", "now", null]);
// An event is over at its end time; between events the next one is marked.
assert.deepEqual(markEvents(day, at("11:00:00")), [null, "past", "past", "next"]);
assert.deepEqual(markEvents(day, at("08:00:00")), [null, "next", null, null]);
assert.deepEqual(markEvents(day, at("14:00:00")), [null, "past", "past", "past"]);
// Overlapping events: the first one on now is marked. Unreadable times stay plain.
assert.deepEqual(markEvents([...day.slice(2), event("Office hours", "2026-10-31T10:15:00Z", "2026-10-31T10:45:00Z")], at("10:30:00")), [
  "now",
  null,
  null,
]);
assert.deepEqual(markEvents([event("Broken", "", "")], at("10:00:00")), [null]);
assert.deepEqual(markEvents([], at("10:00:00")), []);

// Setup's batch booked (live, Nov 1: 3 deadlines and 5 to-dos): today's desk gets the timed blocks, as Zeno blocks;
// an offer, a booking in flight, a failed one and an undone one (an offer again) add nothing.
const todo = (title: string, start: string) => ({ title, kind: "todo" as const, start: `2026-11-02T${start}:00Z`, end: `2026-11-02T${start.slice(0, 3)}30:00Z`, eventId: `e-${title}` });
const batch = [{ title: "Lab report", kind: "deadline" as const, date: "2026-11-06", eventId: "e-due" }, todo("Graphs", "02:00"), todo("Read ch 4", "03:00")];
assert.deepEqual(
  bookedEvents([
    { state: "booked", blocks: batch },
    ...(["offer", "busy", "failed"] as const).map((state) => ({ state, blocks: [todo(state, "05:00")] })),
  ]),
  [
    { title: "Graphs", start: "2026-11-02T02:00:00Z", end: "2026-11-02T02:30:00Z", allDay: false, zeno: true },
    { title: "Read ch 4", start: "2026-11-02T03:00:00Z", end: "2026-11-02T03:30:00Z", allDay: false, zeno: true },
  ],
);

assert.equal(senderName("Dana Lee <dana@school.edu>"), "Dana Lee");
assert.equal(senderName('"Lee, Dana" <dana@school.edu>'), "Lee, Dana");
assert.equal(senderName("dana@school.edu"), "dana@school.edu");
assert.equal(senderName("<dana@school.edu>"), "dana@school.edu");
assert.equal(senderName("Unknown sender"), "Unknown sender");

// Asking mail shows its snippet's first line as plain text: Gmail's escapes decode; unknown or broken ones stay as sent.
assert.equal(snippetLine("I&#39;d cite the second source &amp; fix page 3."), "I'd cite the second source & fix page 3.");
assert.equal(snippetLine("&quot;Lab&quot; &lt;3 &#x27;ok&#X27; caf&#233;&nbsp;now"), "\"Lab\" <3 'ok' café now");
assert.equal(snippetLine("Does Wednesday at 2 work?\nThanks, Dana"), "Does Wednesday at 2 work?");
assert.equal(snippetLine("&bogus; &#0; &#xFFFFFFF; & plain"), "&bogus; &#0; &#xFFFFFFF; & plain");
assert.equal(snippetLine("  "), "");

// Event and Gmail links open only as https pages; anything else (a script URL, plain http, nothing) is no link.
assert.equal(httpsOnly("https://www.google.com/calendar/event?eid=abc"), "https://www.google.com/calendar/event?eid=abc");
assert.equal(httpsOnly("https://mail.google.com/mail/?authuser=maya@school.edu"), "https://mail.google.com/mail/?authuser=maya@school.edu");
for (const bad of ["javascript:alert(1)", " https://x.com", "http://www.google.com/calendar", "", null, undefined]) {
  assert.equal(httpsOnly(bad), undefined, String(bad));
}

// The Canvas sheet names the school's host, however the address was typed.
assert.equal(canvasHost("sjsu.instructure.com"), "sjsu.instructure.com");
assert.equal(canvasHost("  https://SJSU.instructure.com/courses/123?x=1 "), "sjsu.instructure.com");
assert.equal(canvasHost("http://canvas.school.edu/"), "canvas.school.edu");

// The Canvas sheet groups work by the day it is due on the person's clock. Monday Nov 2, noon in Los Angeles: 11:59 PM
// tonight is already Tuesday in UTC but still Today; work due last night is gone; a week out shows its date.
const work = (id: string, due: string | null) => ({ id, due });
const monday = Date.parse("2026-11-02T20:00:00Z");
const list = [
  work("lab-report", "2026-11-09T20:00:00Z"),
  work("reading-notes", "2026-11-03T07:59:00Z"),
  work("essay-outline", "2026-11-05T23:00:00Z"),
  work("bonus-reading", null),
  work("problem-set", "2026-11-07T01:00:00Z"),
  work("late-lab", "2026-11-02T07:59:00Z"),
  work("lab-quiz", "2026-11-03T21:30:00Z"),
  work("sunday", "2026-11-09T07:00:00Z"),
  work("this-morning", "2026-11-02T17:00:00Z"),
];
const days = (zone: string, items = list) => dueDays(items, zone, monday).map(({ day, items }) => [day, items.map((item) => item.id)]);
assert.deepEqual(days("America/Los_Angeles"), [
  ["Today", ["this-morning", "reading-notes"]],
  ["Tomorrow", ["lab-quiz"]],
  ["Thursday", ["essay-outline"]],
  ["Friday", ["problem-set"]],
  ["Sunday", ["sunday"]],
  ["Mon, Nov 9", ["lab-report"]],
  ["No due date", ["bonus-reading"]],
]);
assert.deepEqual(days("UTC", [work("reading-notes", "2026-11-03T07:59:00Z")]), [["Tomorrow", ["reading-notes"]]]);
assert.deepEqual(days("America/Los_Angeles", []), []);

// A row shows its time only when it isn't 11:59 PM on the person's clock (to the second, as Canvas often writes it).
const times = (zone: string) => ["2026-11-03T07:59:00Z", "2026-11-03T07:59:59Z", "2026-11-03T21:30:00Z", null].map((due) => dueTime(due, zone)?.replace(/\s/g, " ") ?? null);
assert.deepEqual(times("America/Los_Angeles"), [null, null, "1:30 PM", null]);
assert.deepEqual(times("UTC"), ["7:59 AM", "7:59 AM", "9:30 PM", null]);

console.log("desk-rows self-check passed");
