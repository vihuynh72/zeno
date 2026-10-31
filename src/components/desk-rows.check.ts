// Self-check for desk-rows.ts: node src/components/desk-rows.check.ts
import assert from "node:assert/strict";
import type { DayEvent } from "@/lib/day";
import { markEvents, senderName, unescapeHtml } from "./desk-rows.ts";

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
