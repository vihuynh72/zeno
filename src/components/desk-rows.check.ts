// Self-check for desk-rows.ts: node src/components/desk-rows.check.ts (the week grid's math: week-grid.check.ts)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { DayEvent } from "@/lib/day";

// desk-rows.ts imports tz.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { bookedEvents, markEvents, senderName, unescapeHtml } = await import("./desk-rows.ts");

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

assert.equal(unescapeHtml("I&#39;ll send it &amp; call &quot;soon&quot;"), `I'll send it & call "soon"`);
assert.equal(unescapeHtml("&lt;3 &#x1F44B; &AMP;"), "<3 \u{1F44B} &");
// Unknown names, prototype keys and out-of-range code points are left as written.
assert.equal(unescapeHtml("&constructor; &#0; &#99999999; &#x;"), "&constructor; &#0; &#99999999; &#x;");

console.log("desk-rows self-check passed");
