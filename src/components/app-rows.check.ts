// Self-check for app-rows.ts (From your apps and For this goal): node src/components/app-rows.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { AppItem } from "@/lib/connect";
import type { Goal } from "@/lib/day";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { appRow, canvasItems, goalItems, goalText, sourceOf, waiting } = await import("./app-rows.ts");

const item = (app: AppItem["app"], id: string, title: string, due: string | null = null, detail: string | null = null): AppItem => ({
  app,
  id,
  title,
  url: `https://example.com/${id}`,
  kind: "task",
  due,
  detail,
});
const goal = (title: string, source: Goal["source"] = null): Goal => ({ id: title, title, steps: [{ id: `${title}-1`, title: "Write the essay outline", minutes: 15, status: "todo", startedAt: null, doneAt: null }], source });

const login = item("linear", "L1", "ENG-12 Fix login", "2026-11-06", "Users can't sign in");
const card = item("trello", "T1", "Book the venue", "2026-11-05");
const loose = item("trello", "T2", "Someday");
const essay = item("linear", "L2", "ENG-3 Essay outline");

// From your apps: a goal made from an item (its source) or with its title drops it; soonest due first, undated last.
const canvas = canvasItems([{ id: 9, course: "PHIL 134", title: "Essay 2", due: "2026-11-05T06:59:00Z", kind: "assignment", url: "https://sjsu.instructure.com/x" }], "America/Los_Angeles");
assert.deepEqual(canvas[0], { app: "canvas", id: "9", title: "Essay 2", url: "https://sjsu.instructure.com/x", kind: "task", due: "2026-11-04", detail: "PHIL 134" }, "Canvas's due is her own day");
const list = waiting([loose, login, card, essay, ...canvas], [goal("Fix the login bug", { app: "linear", id: "L1", url: login.url, title: login.title }), goal("someday!")]);
assert.deepEqual(
  list.map((one) => one.id),
  ["9", "T1", "L2"],
  "made-from and same-title items are gone",
);
assert.deepEqual(appRow(list[0], "2026-11-03"), { title: "Essay 2", aside: "Canvas", line: "PHIL 134", when: "due tomorrow" });
assert.deepEqual(appRow(card, "2026-11-03").aside, "Trello");

// Make it a goal: the title, due date and detail as her words; the item as the source.
assert.equal(goalText(login), "ENG-12 Fix login\nDue 2026-11-06\nUsers can't sign in");
assert.equal(goalText(canvas[0]), "Essay 2\nDue 2026-11-04", "Canvas's course is not a detail to plan from");
assert.deepEqual(sourceOf(card), { app: "trello", id: "T1", url: card.url, title: "Book the venue" });

// For this goal: its own item first even when no word matches, then its docs, then items that match it; once each.
const doc: AppItem = { ...item("gdocs", "D1", "Essay notes"), kind: "doc" };
const mine = goal("Finish essay", { app: "linear", id: "L1", url: login.url, title: login.title });
assert.deepEqual(
  goalItems(mine, [card, login, essay], [doc, doc]).map((one) => one.id),
  ["L1", "D1", "L2"],
  "own, doc, then a match (essay outline); the venue card doesn't match",
);
// Its item is gone from the app now (done there): the saved source still shows.
const gone = goalItems(mine, [], []);
assert.deepEqual(gone, [{ app: "linear", id: "L1", url: login.url, title: login.title, kind: "task", due: null, detail: null }]);
assert.deepEqual(goalItems(goal("Essay 2", { app: "canvas", id: "9", url: "https://x", title: "Essay 2" }), [], []), [], "Canvas has its own card");

console.log("app-rows check passed");
