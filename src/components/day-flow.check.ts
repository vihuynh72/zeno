// Self-check for day-flow.ts: node src/components/day-flow.check.ts
import assert from "node:assert/strict";
import type { Goal, Step, TalkAction } from "@/lib/day";
import { cardSize, clock, greeting, nextScreen, openSteps } from "./day-flow.ts";

const step = (id: string, status: Step["status"]): Step => ({
  id,
  title: `Step ${id}`,
  minutes: 10,
  status,
  startedAt: null,
  doneAt: null,
});
const goal = (...steps: Step[]): Goal => ({ id: "g", title: "Essay", steps });
const acts = (...types: TalkAction["type"][]) => types.map((type) => ({ type, label: type }));

assert.equal(greeting(9, "Vi"), "Good morning, Vi.");
assert.equal(greeting(15, "Vi"), "Good afternoon, Vi.");
assert.equal(greeting(17, null), "Good evening.");
assert.equal(greeting(1, "Vi"), "Still up, Vi?");
assert.equal(greeting(5, null), "Good morning.");

// A step already started comes before earlier ones still to do; done and skipped drop out.
const mixed = goal(step("1", "done"), step("2", "todo"), step("3", "doing"), step("4", "skipped"), step("5", "todo"));
assert.deepEqual(openSteps(mixed).map((s) => s.id), ["3", "2", "5"]);
assert.deepEqual(openSteps(null), []);

// A new roadmap shows the plan; a started step goes to focus; small talk stays put.
const fresh = goal(step("1", "todo"), step("2", "todo"));
assert.equal(nextScreen("talk", acts("goal-set"), fresh), "plan");
assert.equal(nextScreen("focus", acts("roadmap-changed"), fresh), "plan");
assert.equal(nextScreen("plan", acts("step-started"), goal(step("1", "doing"))), "focus");
assert.equal(nextScreen("focus", acts("step-finished"), goal(step("1", "done"))), "checkin");
assert.equal(nextScreen("brief", [], null), "talk");
assert.equal(nextScreen("focus", acts("remembered"), fresh), "focus");
// A roadmap with nothing left to do is not a plan to show.
assert.equal(nextScreen("talk", acts("goal-set"), goal(step("1", "done"))), "talk");
// A step screen whose goal went away goes back to talking, not to dead pills.
assert.equal(nextScreen("plan", [], null), "talk");
assert.equal(nextScreen("focus", acts("forgot"), goal(step("1", "done"))), "talk");

assert.equal(cardSize("Good afternoon, Vi."), "l");
assert.equal(cardSize("x".repeat(120)), "m");
assert.equal(cardSize("x".repeat(200)), "s");

assert.equal(clock(600), "10:00");
assert.equal(clock(65.2), "1:06");
assert.equal(clock(-3), "0:00");

console.log("day-flow self-check passed");
