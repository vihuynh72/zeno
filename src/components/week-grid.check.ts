// Self-check for the week grid's layout math (in desk-rows.ts). Run like Vercel does, in UTC:
// TZ=UTC node src/components/week-grid.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// desk-rows.ts imports tz.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { addDays, dateLabel, freeGaps, instantAt, layoutDay, mondayOf, planFrom, planStart, timeRange, wallMinutes, weekLabel } =
  await import("./desk-rows.ts");

const LA = "America/Los_Angeles";
const at = (iso: string) => Date.parse(iso);
const timed = (title: string, start: string, end: string) => ({ title, start, end, allDay: false });
const boxes = (placed: { event: { title: string }; top: number; bottom: number; col: number; cols: number }[]) =>
  placed.map(({ event, top, bottom, col, cols }) => [event.title, top, bottom, col, cols]);

// Calendar dates: Monday of the week (Mon–Sun), across months, years and a leap day.
assert.equal(mondayOf("2026-11-01"), "2026-10-26"); // a Sunday belongs to the week before
assert.equal(mondayOf("2026-11-02"), "2026-11-02");
assert.equal(mondayOf("2027-01-02"), "2026-12-28");
assert.equal(addDays("2028-02-28", 1), "2028-02-29");
assert.equal(addDays("2026-11-02", -7), "2026-10-26");
assert.equal(weekLabel("2026-11-02"), "Nov 2 – 8");
assert.equal(weekLabel("2026-10-26"), "Oct 26 – Nov 1");
assert.equal(weekLabel("2026-12-28"), "Dec 28 – Jan 3");
assert.equal(dateLabel("2026-11-02", { weekday: "short" }), "Mon");

// Wall-clock minutes on an ordinary day, and clipping to the column's own date.
assert.equal(wallMinutes(at("2026-11-02T17:30:00Z"), "2026-11-02", LA), 570); // 9:30 AM PST
assert.equal(wallMinutes(at("2026-11-02T07:00:00Z"), "2026-11-02", LA), 0); // 11 PM the day before
assert.equal(wallMinutes(at("2026-11-03T08:00:00Z"), "2026-11-02", LA), 1440); // next midnight
assert.equal(wallMinutes(at("2026-11-02T00:30:00Z"), "2026-11-02", "Asia/Tokyo"), 570);

// Wall clock to instant, on both DST days (Nov 1 falls back, a 25-hour day; Mar 8 springs forward, 23 hours).
assert.equal(new Date(instantAt("2026-11-02", 570, LA)).toISOString(), "2026-11-02T17:30:00.000Z");
assert.equal(new Date(instantAt("2026-11-01", 0, LA)).toISOString(), "2026-11-01T07:00:00.000Z"); // midnight PDT
assert.equal(new Date(instantAt("2026-11-01", 540, LA)).toISOString(), "2026-11-01T17:00:00.000Z"); // 9 AM PST
assert.equal(new Date(instantAt("2026-03-08", 60, LA)).toISOString(), "2026-03-08T09:00:00.000Z"); // 1 AM PST
assert.equal(new Date(instantAt("2026-03-08", 540, LA)).toISOString(), "2026-03-08T16:00:00.000Z"); // 9 AM PDT
assert.equal(new Date(instantAt("2026-11-02", 1440, LA)).toISOString(), "2026-11-03T08:00:00.000Z");
assert.equal(new Date(instantAt("2026-11-02", 570, "Asia/Kolkata")).toISOString(), "2026-11-02T04:00:00.000Z"); // +5:30
for (const [date, minutes] of [["2026-11-01", 615], ["2026-03-08", 1425], ["2026-11-02", 0]] as const) {
  assert.equal(wallMinutes(instantAt(date, minutes, LA), date, LA), minutes, `${date} ${minutes} round trip`);
}

// DST days place events by the wall clock, like Google: 9 AM is the 9 AM row on both, whatever the elapsed time.
assert.deepEqual(
  boxes(layoutDay([timed("Run", "2026-11-01T17:00:00Z", "2026-11-01T18:00:00Z")], "2026-11-01", LA)),
  [["Run", 540, 600, 0, 1]],
);
assert.deepEqual(
  boxes(layoutDay([timed("Run", "2026-03-08T16:00:00Z", "2026-03-08T17:00:00Z")], "2026-03-08", LA)),
  [["Run", 540, 600, 0, 1]],
);
// In the repeated hour (1:30 PDT to 1:15 PST is 45 real minutes) the box keeps its real length.
assert.deepEqual(
  boxes(layoutDay([timed("Night shift", "2026-11-01T08:30:00Z", "2026-11-01T09:15:00Z")], "2026-11-01", LA)),
  [["Night shift", 90, 135, 0, 1]],
);
// An event across midnight is clipped to each day it touches.
const movie = timed("Movie", "2026-11-08T06:00:00Z", "2026-11-08T09:00:00Z"); // Sat 10 PM to Sun 1 AM PST
assert.deepEqual(boxes(layoutDay([movie], "2026-11-07", LA)), [["Movie", 1320, 1440, 0, 1]]);
assert.deepEqual(boxes(layoutDay([movie], "2026-11-08", LA)), [["Movie", 0, 60, 0, 1]]);

// Overlaps sit side by side; a column frees up when its event ends; back-to-back events don't share.
const mon = (time: string) => `2026-11-02T${time}:00-08:00`;
const busy = [
  timed("D", mon("11:00"), mon("12:00")),
  timed("A", mon("09:00"), mon("10:00")),
  timed("B", mon("09:30"), mon("10:30")),
  timed("C", mon("10:00"), mon("11:00")),
  timed("E", mon("13:00"), mon("13:05")),
  timed("F", mon("13:10"), mon("13:40")),
  { title: "Birthday", start: "2026-11-02", end: "2026-11-03", allDay: true },
  timed("Broken", "", ""),
];
assert.deepEqual(boxes(layoutDay(busy, "2026-11-02", LA)), [
  ["A", 540, 600, 0, 2],
  ["B", 570, 630, 1, 2],
  ["C", 600, 660, 0, 2],
  ["D", 660, 720, 0, 1],
  ["E", 780, 785, 0, 1],
  ["F", 790, 820, 0, 1],
]);
// A 5-minute event still draws about half an hour tall, so the next one moves beside it.
assert.deepEqual(boxes(layoutDay(busy, "2026-11-02", LA, 27)).slice(4), [
  ["E", 780, 785, 0, 2],
  ["F", 790, 820, 1, 2],
]);
// Three at once: the longest starts left, and the fourth reuses the first column that is free.
assert.deepEqual(
  boxes(
    layoutDay(
      [
        timed("H", mon("14:00"), mon("15:00")),
        timed("G", mon("14:00"), mon("16:00")),
        timed("J", mon("15:00"), mon("15:30")),
        timed("I", mon("14:30"), mon("15:30")),
      ],
      "2026-11-02",
      LA,
    ),
  ),
  [
    ["G", 840, 960, 0, 3],
    ["H", 840, 900, 1, 3],
    ["I", 870, 930, 2, 3],
    ["J", 900, 930, 1, 3],
  ],
);
assert.deepEqual(layoutDay([], "2026-11-02", LA), []);

// Free gaps between busy boxes inside the window; slivers under 15 minutes are not offered.
const placed = layoutDay(busy, "2026-11-02", LA);
assert.deepEqual(freeGaps(placed, 420, 1380), [
  { top: 420, bottom: 540 },
  { top: 720, bottom: 780 },
  { top: 820, bottom: 1380 },
]);
assert.deepEqual(freeGaps(placed, 700, 1380), [
  { top: 720, bottom: 780 },
  { top: 820, bottom: 1380 },
]);
assert.deepEqual(freeGaps([{ top: 1300, bottom: 1440 }], 420, 1380), [{ top: 420, bottom: 1300 }]);
assert.deepEqual(freeGaps([], 420, 1380), [{ top: 420, bottom: 1380 }]);
assert.deepEqual(freeGaps([{ top: 0, bottom: 1440 }], 420, 1380), []);

// Planning starts now (to the next 5 minutes) today, at 7 AM on later days, never in the past or past 30 days.
assert.equal(planFrom("2026-11-01", "2026-11-02", 600), null);
assert.equal(planFrom("2026-11-02", "2026-11-02", 601), 605);
assert.equal(planFrom("2026-11-02", "2026-11-02", 300), 420);
assert.equal(planFrom("2026-11-02", "2026-11-02", 1379), null);
assert.equal(planFrom("2026-11-03", "2026-11-02", 1000), 420);
assert.equal(planFrom(addDays("2026-11-02", 29), "2026-11-02", 0), 420);
assert.equal(planFrom(addDays("2026-11-02", 30), "2026-11-02", 0), null);

// A tap starts the block on the quarter hour before it, kept inside the gap.
assert.equal(planStart({ top: 420, bottom: 540 }, 487, 30), 480);
assert.equal(planStart({ top: 420, bottom: 540 }, 530, 30), 510);
assert.equal(planStart({ top: 605, bottom: 700 }, 610, 30), 605);

assert.match(timeRange("2026-11-02T17:30:00Z", "2026-11-02T18:00:00Z", LA), /^9:30 – 10:00\sAM$/);
assert.match(timeRange("2026-11-02T19:30:00Z", "2026-11-02T21:00:00Z", LA), /^11:30\sAM – 1:00\sPM$/);

console.log("week-grid self-check passed");
