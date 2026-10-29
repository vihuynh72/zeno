// Self-check for tz.ts. Run like Vercel does, in UTC: TZ=UTC node src/lib/tz.check.ts
import assert from "node:assert/strict";
import { dayBounds, formatDate, formatTime, localHour, timeZoneFrom } from "./tz.ts";

const LA = "America/Los_Angeles";
const bounds = (zone: string, at: string) => {
  const { start, end } = dayBounds(zone, new Date(at));
  return [start.toISOString(), end.toISOString()];
};

// 3:15 PM PDT on Thursday Oct 29.
assert.deepEqual(bounds(LA, "2026-10-29T22:15:00Z"), ["2026-10-29T07:00:00.000Z", "2026-10-30T07:00:00.000Z"]);
assert.equal(localHour(LA, new Date("2026-10-29T22:15:00Z")), 15);
assert.match(formatTime("2026-10-29T22:15:00Z", LA), /^3:15\sPM$/);

// 6:30 PM PDT: UTC is already Oct 30, the person's day is still Oct 29.
assert.deepEqual(bounds(LA, "2026-10-30T01:30:00Z"), ["2026-10-29T07:00:00.000Z", "2026-10-30T07:00:00.000Z"]);
assert.equal(formatDate(new Date("2026-10-30T01:30:00Z"), LA), "Thursday, October 29");

// DST ends on Nov 1, a 25-hour day in Los Angeles.
assert.deepEqual(bounds(LA, "2026-11-01T18:00:00Z"), ["2026-11-01T07:00:00.000Z", "2026-11-02T08:00:00.000Z"]);

// Chile's DST skips midnight on Sep 6, so 11:09 PM on Sep 5 belongs to a day ending at the jump.
assert.deepEqual(bounds("America/Santiago", "2026-09-06T03:09:00Z"), ["2026-09-05T04:00:00.000Z", "2026-09-06T04:00:00.000Z"]);

assert.equal(timeZoneFrom("Not/A_Zone"), LA);
assert.equal(timeZoneFrom(undefined), LA);

// UTC+7 with no DST: 22:15Z is 5:15 AM on Friday Oct 30.
assert.equal(timeZoneFrom("Asia/Ho_Chi_Minh"), "Asia/Ho_Chi_Minh");
assert.deepEqual(bounds("Asia/Ho_Chi_Minh", "2026-10-29T22:15:00Z"), ["2026-10-29T17:00:00.000Z", "2026-10-30T17:00:00.000Z"]);
assert.equal(localHour("Asia/Ho_Chi_Minh", new Date("2026-10-29T22:15:00Z")), 5);

console.log("tz self-check passed");
