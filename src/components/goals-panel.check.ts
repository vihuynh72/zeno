// Self-check for the goals panel's rules in day-flow.ts (Nov 4): TZ=UTC node src/components/goals-panel.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { DayEmail, Deadline, Goal, Step } from "@/lib/day";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { dueLine, goalRow, panelGoals, panelSuggestions, suggestionRow } = await import("./day-flow.ts");

const step = (id: string, status: Step["status"], extra: Partial<Step> = {}): Step => ({
  id,
  title: `Step ${id}`,
  minutes: 10,
  status,
  startedAt: null,
  doneAt: null,
  ...extra,
});
const plan = (id: string, title: string, due: string | null = null, extra: Partial<Goal> = {}): Goal => ({ id, title, due, steps: [step(`${id}-1`, "todo")], ...extra });
const today = "2026-11-03"; // a Tuesday

// Deadline order, undated last, then by title: the same order whichever plan is current (first in the list).
const run = plan("g1", "Run a 5K", null, { rhythm: "3 runs a week" });
const paper = plan("g2", "PHIL 134 paper", "2026-11-06");
const taxes = plan("g3", "Send tax papers", "2026-11-15");
const album = plan("g4", "Album for Emma");
const order = (plans: Goal[]) => panelGoals(plans).map((one) => one.id);
assert.deepEqual(order([run, paper, taxes, album]), ["g2", "g3", "g4", "g1"]);
assert.deepEqual(order([album, taxes, run, paper]), ["g2", "g3", "g4", "g1"], "stable across reloads, whatever is current");
const input = [taxes, paper];
panelGoals(input);
assert.deepEqual(input.map((one) => one.id), ["g3", "g2"], "the page's list is never sorted in place");

// Suggestions: deadlines within 7 days with no plan (soonest first), then the newest asking email; 3 at most.
const deadline = (title: string, date: string): Deadline => ({ title, date, daysLeft: 0 });
const mail = (id: string, asks = true): DayEmail => ({ from: "Prof. Patel <patel@school.example>", subject: "Office hours this week?", snippet: "", unread: true, id, asks });
const deadlines = [
  deadline("BIO 101 quiz", "2026-11-05"),
  deadline("PHIL 134: Paper", "2026-11-06"), // the open plan covers it
  deadline("Old essay", "2026-11-01"), // passed
  deadline("Far project", "2026-11-11"), // 8 days out
  deadline("MATH 30 set", "2026-11-04"),
  deadline("CHEM lab", "2026-11-10"), // 7 days out counts
];
const titles = (list: ReturnType<typeof panelSuggestions>) =>
  list.map((one) => (one.kind === "deadline" ? one.deadline.title : one.kind === "mail" ? `mail:${one.email.id}` : one.goal.id));
assert.deepEqual(titles(panelSuggestions([paper], deadlines, [], today)), ["MATH 30 set", "BIO 101 quiz", "CHEM lab"]);
assert.deepEqual(titles(panelSuggestions([paper], deadlines, [mail("m0", false), mail("m1"), mail("m2")], today)), ["MATH 30 set", "BIO 101 quiz", "mail:m1"]);
assert.deepEqual(titles(panelSuggestions([], [], [mail("m1"), mail("m2")], today, ["m1"])), ["mail:m2"], "an email already planned here is not suggested again");
assert.deepEqual(titles(panelSuggestions([], deadlines, [], "")), [], "nothing is dated before the browser's clock");
assert.deepEqual(titles(panelSuggestions([], [deadline("Quiz 6", "2026-11-05"), deadline("BIO: Quiz 6", "2026-11-05")], [], today)), ["Quiz 6"], "one name, once");

// The due line: days left, never a past date as "left".
assert.equal(dueLine("2026-11-03", today), "due today");
assert.equal(dueLine("2026-11-04", today), "due tomorrow");
assert.equal(dueLine("2026-11-12", today), "due Thu Nov 12 · 9 days left");
assert.equal(dueLine("2027-01-10", today), "due Sun Jan 10 · 68 days left");
assert.equal(dueLine("2026-11-02", today), "was due Mon Nov 2");
assert.equal(dueLine("2026-11-12", ""), "");

// A goal row: the next step and its minutes, "Now:" while it runs, the desk's pick for the open goal, the rhythm.
const essay: Goal = {
  id: "e",
  title: "History essay",
  due: "2026-11-12",
  steps: [step("1", "done"), step("2", "todo", { title: "Draft the opening.", minutes: 15 }), step("3", "todo", { minutes: null })],
};
assert.deepEqual(goalRow(essay, today), { title: "History essay", aside: "", line: "Next: Draft the opening · 15 min", when: "due Thu Nov 12 · 9 days left" });
assert.equal(goalRow(essay, today, essay.steps[2]).line, "Next: Step 3", "the step the desk proposes");
assert.equal(goalRow(essay, today, essay.steps[0]).line, "Next: Draft the opening · 15 min", "a done step is never Next");
assert.equal(goalRow({ ...essay, steps: [step("1", "todo"), step("2", "doing", { minutes: 5 })] }, today).line, "Now: Step 2 · 5 min");
assert.equal(goalRow(run, today).when, "3 runs a week");
assert.equal(goalRow({ ...run, due: "2026-11-04" }, today).when, "3 runs a week · due tomorrow");
assert.equal(goalRow({ ...essay, steps: [step("1", "done")] }, today).line, "", "no open step, no Next");

// Suggestion rows: an email to answer, a deadline to plan.
assert.deepEqual(suggestionRow({ kind: "mail", email: mail("m1") }, today), { title: "Answer Prof. Patel", aside: "2 min", line: "Office hours this week?", when: "" });
assert.deepEqual(suggestionRow({ kind: "deadline", deadline: deadline("BIO 101 quiz", "2026-11-05") }, today), {
  title: "BIO 101 quiz",
  aside: "Plan it",
  line: "",
  when: "due Thu Nov 5 · 2 days left",
});

console.log("goals-panel checks passed");
