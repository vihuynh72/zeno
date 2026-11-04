// Self-check for week-plan.ts: node src/components/week-plan.check.ts (made-up goals and a made-up week; any server zone)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { DoneStep, Goal, Step } from "@/lib/day";

// week-plan.ts imports desk-rows.ts, goal-rows.ts and tz.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { gapOf, goalTag, mins, planWeek, stepLabel } = await import("./week-plan.ts");
const { dateLabel } = await import("./desk-rows.ts");

const LA = "America/Los_Angeles";
let n = 0;
const step = (title: string, minutes: number | null, status: Step["status"] = "todo", doneAt: string | null = null): Step => ({
  id: `s${++n}`,
  title,
  minutes,
  status,
  startedAt: null,
  doneAt,
});
const goal = (id: string, title: string, steps: Step[], due: string | null = null, rhythm: string | null = null): Goal => ({ id, title, steps, due, rhythm });
const timed = (title: string, start: string, end: string) => ({ title, start, end, allDay: false });

// Each day as the Week writes it: "Wed 11: 10:00 AM ENVS 119 | PHIL: Outline reasons · 20m".
type Plan = ReturnType<typeof planWeek>;
const show = (plan: Plan) =>
  plan.map(({ date, items }) => {
    const lines = items.map((item) => {
      if (item.kind === "done") return `✓ ${stepLabel(item.goal, item.title)}${item.minutes ? ` · ${mins(item.minutes)}` : ""}`;
      if (item.kind === "event") return `${item.time ? `${item.time} ` : ""}${item.title}`;
      if (item.kind === "due") return `${item.goal.title} due`;
      if (item.kind === "rest") return `${goalTag(item.goal.title)}: rest day`;
      return `${stepLabel(item.goal.title, item.step.title)}${item.step.minutes ? ` · ${mins(item.step.minutes)}` : ""}`;
    });
    // ICU may write a narrow no-break space before AM.
    return `${dateLabel(date, { weekday: "short" })} ${Number(date.slice(8))}: ${lines.join(" | ")}`.replace(/\s/g, " ");
  });

// Small words: a course code or a distance names the goal; minutes are short; a rhythm sets the days between sessions.
assert.equal(goalTag("PHIL paper"), "PHIL");
assert.equal(goalTag("Write the PHIL 134 paper"), "PHIL");
assert.equal(goalTag("Run a 5K"), "5K");
assert.equal(goalTag("Call the bank"), "Call the bank");
assert.equal(goalTag("Learn Spanish"), "Learn Spanish");
assert.equal(goalTag("A plan"), "A plan"); // one capital letter is a word, not a code
assert.equal(stepLabel("PHIL paper", "Outline reasons"), "PHIL: Outline reasons");
assert.equal(stepLabel("Call the bank", "Call the bank"), "Call the bank");
assert.equal(stepLabel("Run a 5K", "Run"), "5K: Run");
assert.deepEqual([mins(5), mins(20), mins(60), mins(90), mins(125)], ["5m", "20m", "1h", "1h 30m", "2h 5m"]);
assert.equal(gapOf("3 runs a week"), 2);
assert.equal(gapOf("3x a week"), 2);
assert.equal(gapOf("twice a week"), 4);
assert.equal(gapOf("once a week"), 7);
assert.equal(gapOf("Run 20 minutes, 3 times a week"), 2); // the count is the one before "times", not the minutes
assert.equal(gapOf("5 days a week"), 1);
assert.equal(gapOf("Daily"), 1);
assert.equal(gapOf("20 minutes a day"), 1);
assert.equal(gapOf("Every day"), 1);
assert.equal(gapOf("Keep it going"), 2);

// The approved preview (Vi, Nov 4): Wednesday Nov 11; the paper is due Friday, the run keeps going, the bank call is done.
const phil = goal("g-phil", "PHIL paper", [step("Reread prompt", 20, "done", "2026-11-09T18:00:00Z"), step("Outline reasons", 20), step("Write part 1", 25)], "2026-11-13");
const run = goal("g-run", "Run a 5K", [step("Run-walk", 20, "done", "2026-11-10T02:00:00Z"), step("Run-walk", 25), step("Run-walk", 25)], null, "3 runs a week");
const done: DoneStep[] = [
  { title: "Reread prompt", goal: "PHIL paper", doneAt: "2026-11-09T18:00:00Z", minutes: 20 },
  { title: "Run-walk", goal: "Run a 5K", doneAt: "2026-11-10T02:00:00Z", minutes: 20 }, // Mon 6 PM in LA
  { title: "Call the bank", goal: "Call the bank", doneAt: "2026-11-10T19:00:00Z", minutes: null },
];
const events = [
  timed("ENVS 119", "2026-11-11T18:00:00Z", "2026-11-11T19:15:00Z"),
  timed("Last week's class", "2026-11-10T18:00:00Z", "2026-11-10T19:00:00Z"), // before today: the days behind show only what she did
  { title: "Due: PHIL paper", start: "2026-11-13", end: "2026-11-14", allDay: true }, // the goal's own due line says it
  { title: "Grandma's birthday", start: "2026-11-12", end: "2026-11-13", allDay: true },
];
// The run's last session was Monday (its own step's doneAt), so its next ones are today and Friday, each with a rest day after.
const preview = planWeek([phil, run], events, done, "2026-11-11", LA);
assert.deepEqual(show(preview), [
  "Mon 9: ✓ PHIL: Reread prompt · 20m | ✓ 5K: Run-walk · 20m",
  "Tue 10: ✓ Call the bank",
  "Wed 11: 10:00 AM ENVS 119 | PHIL: Outline reasons · 20m | 5K: Run-walk · 25m",
  "Thu 12: Grandma's birthday | PHIL: Write part 1 · 25m | 5K: rest day",
  "Fri 13: PHIL paper due | 5K: Run-walk · 25m",
  "Sat 14: 5K: rest day",
  "Sun 15: ",
  "Mon 16: ",
  "Tue 17: ",
  "Wed 18: ",
]);
// Deterministic: the same inputs give the same plan.
assert.deepEqual(planWeek([phil, run], events, done, "2026-11-11", LA), preview);

// Finished steps fall on the zone's day: 07:30 UTC Tuesday is Monday night in LA, Tuesday in UTC and Tokyo.
const late: DoneStep[] = [{ title: "Late read", goal: "PHIL paper", doneAt: "2026-11-10T07:30:00Z", minutes: 15 }];
const doneOn = (zone: string) => planWeek([], [], late, "2026-11-11", zone).findIndex((day) => day.items.length > 0);
assert.equal(doneOn(LA), 0);
assert.equal(doneOn("UTC"), 1);
assert.equal(doneOn("Asia/Tokyo"), 1);

// A paper due in 3 days with 6 steps: two a day, in order, today to the day before it's due, never on it.
const six = goal("g-six", "Paper", ["One", "Two", "Three", "Four", "Five", "Six"].map((title) => step(title, 20)), "2026-11-07");
const spread = (plan: Plan) => plan.map((day) => day.items.flatMap((item) => (item.kind === "step" ? [item.step.title] : [])));
assert.deepEqual(spread(planWeek([six], [], [], "2026-11-04", LA)).slice(2, 6), [["One", "Two"], ["Three", "Four"], ["Five", "Six"], []]);
// A busy day (5 timed events) holds about 20 minutes, so its second step moves to the next day with room.
const busy = Array.from({ length: 5 }, (_, i) => timed(`Class ${i}`, `2026-11-05T${16 + i}:00:00Z`, `2026-11-05T${16 + i}:45:00Z`));
assert.deepEqual(spread(planWeek([six], busy, [], "2026-11-04", LA)).slice(2, 6), [["One", "Two"], ["Three"], ["Four", "Five", "Six"], []]);
// Due tomorrow with no room left: its steps stay before the due date, over the hour, never on or after it.
const tight = goal("g-tight", "Tight", [step("A", 45), step("B", 45), step("C", 45)], "2026-11-05");
assert.deepEqual(spread(planWeek([tight], [], [], "2026-11-04", LA)).slice(2, 4), [["A", "B", "C"], []]);
// Overdue: everything left is today's.
assert.deepEqual(spread(planWeek([goal("g-late", "Late", [step("A", 10), step("B", 10)], "2026-11-02")], [], [], "2026-11-04", LA))[2], ["A", "B"]);
// Soonest due first: the later goal fits around it.
const soon = goal("g-soon", "Soon", [step("S1", 40), step("S2", 40)], "2026-11-06");
const later = goal("g-later", "Later", [step("L1", 30), step("L2", 30)], "2026-11-12");
assert.deepEqual(spread(planWeek([later, soon], [], [], "2026-11-04", LA)).slice(2, 7), [["S1"], ["S2"], ["L1"], [], ["L2"]]);

// Other goals: one step a weekday from today, never Saturday or Sunday, until the steps run out.
const spanish = goal("g-es", "Learn Spanish", ["A", "B", "C", "D"].map((title) => step(title, null)));
assert.deepEqual(spread(planWeek([spanish], [], [], "2026-11-06", LA)), [[], [], [], [], ["A"], [], [], ["B"], ["C"], ["D"]]);

// Rhythm: no session yet starts today; "rest day" only on the day right after each session; daily has none.
const fresh = goal("g-run2", "Run a 5K", [step("Run", 25), step("Run", 25), step("Run", 25)], null, "3 runs a week");
const kinds = (plan: Plan) => plan.map((day) => day.items.map((item) => item.kind).join(","));
assert.deepEqual(kinds(planWeek([fresh], [], [], "2026-11-04", LA)), ["", "", "step", "rest", "step", "rest", "step", "rest", "", ""]);
// Steps due soon spread first; a session keeps its day on top of them, with its rest day between.
assert.deepEqual(kinds(planWeek([fresh, six], [], [], "2026-11-04", LA)).slice(2, 6), ["step,step,step", "step,step,rest", "step,step,step", "due,rest"]);
const daily = goal("g-read", "Read", [step("Read", 15), step("Read", 15)], null, "every day");
assert.deepEqual(kinds(planWeek([daily], [], [], "2026-11-04", LA)), ["", "", "step", "step", "", "", "", "", "", ""]);
// A session done today puts the next one a gap later, with today's rest day tomorrow.
const ranToday = goal("g-run3", "Run a 5K", [step("Run", 25, "done", "2026-11-04T17:00:00Z"), step("Run", 25)], null, "3 runs a week");
assert.deepEqual(kinds(planWeek([ranToday], [], [], "2026-11-04", LA)), ["", "", "", "rest", "step", "rest", "", "", "", ""]);

// A Sunday shows the week ending, then next Monday to Wednesday; skipped and finished steps are never planned.
const sunday = planWeek([goal("g-x", "X", [step("Skipped", 10, "skipped"), step("Done", 10, "done", "2026-11-08T20:00:00Z"), step("Left", 10)], "2026-11-11")], [], [], "2026-11-08", LA);
assert.deepEqual(sunday.map((day) => day.date), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]);
assert.deepEqual(show(sunday).slice(6), ["Sun 8: X: Left · 10m", "Mon 9: ", "Tue 10: ", "Wed 11: X due"]);

console.log("week-plan checks passed");
