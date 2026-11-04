// Self-check for pop-card.ts: node src/components/pop-card.check.ts (made-up steps, any server zone)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { Goal, Step } from "@/lib/day";

// pop-card.ts imports day-flow.ts through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { popCard } = await import("./pop-card.ts");

const step = (id: string, status: Step["status"]): Step => ({ id, title: `Step ${id}`, minutes: 10, status, startedAt: null, doneAt: null });
const plan = (...steps: Step[]): Goal => ({ id: "g", title: "PHIL 134 response", steps });
// The page's answers on each screen, as guided-day.tsx's screenAnswers gives them.
const FOCUS = ["Done", "Stuck?", "Stop for now"];
const AFTER_DONE = ["Keep going", "Switch goal", "That's enough today"];
const ALL_DONE = ["Back to my goals", "That's enough today"];

const running = plan(step("a", "done"), step("b", "doing"), step("c", "todo"));
const b = running.steps[1];

// Focus: the running step, with the page's own Done.
assert.deepEqual(popCard("focus", running, FOCUS), { kind: "step", step: b, answer: 0 });
assert.deepEqual(popCard("focus", running, [...FOCUS, "Draft it in Gmail"]), { kind: "step", step: b, answer: 0 });
// Stuck?: Done stays first, beside Make it smaller and Switch goal.
assert.deepEqual(popCard("focus", running, ["Done", "Make it smaller", "Switch goal"]), { kind: "step", step: b, answer: 0 });
// The running step even when a to-do step comes before it in the plan, as the page's Focus card picks it.
const outOfOrder = plan(step("c", "todo"), step("b", "doing"));
assert.deepEqual(popCard("focus", outOfOrder, FOCUS), { kind: "step", step: outOfOrder.steps[1], answer: 0 });
// Zeno asked something in Focus: its quick replies lead, so a reply that reads "Done" is never taken for the page's Done.
assert.deepEqual(popCard("focus", running, ["Done", "One point", "Done", "Stop for now"]), { kind: "step", step: b, answer: 2 });
assert.deepEqual(popCard("focus", running, ["One point", "Find an example", "Done", "Stop for now"]), { kind: "step", step: b, answer: 2 });
// A draft waits in Focus: the page offers Open in Gmail and Not now, so the window offers no Done either.
assert.deepEqual(popCard("focus", running, ["Open in Gmail", "Not now"]), { kind: "step", step: b, answer: -1 });

// After a Done with steps left: Zeno's line with Keep going, the page's first answer, which starts the next step.
const after = plan(step("a", "done"), step("b", "done"), step("c", "todo"));
assert.deepEqual(popCard("checkin", after, AFTER_DONE), { kind: "next", answer: 0 });
// After the plan's last step (a skipped one finishes it too): the line alone; Back to my goals stays on the page.
assert.deepEqual(popCard("checkin", plan(step("a", "done"), step("b", "done")), ALL_DONE), { kind: "last" });
assert.deepEqual(popCard("checkin", plan(step("a", "done"), step("b", "skipped")), ALL_DONE), { kind: "last" });
assert.deepEqual(popCard("checkin", null, ALL_DONE), { kind: "last" });

// The step ended: Stop for now and That's enough today (wrap), Switch goal, the home and another desk (ready), a talk
// turn, signing out, first sign-in, and the page before it knows whose day it is all close the window.
for (const screen of ["wrap", "ready", "talk", "signed-out", "setup", null] as const) {
  assert.equal(popCard(screen, running, FOCUS), null, String(screen));
}
// Focus with nothing left open (a plan changed under it) closes it too.
assert.equal(popCard("focus", plan(step("a", "done")), FOCUS), null);
assert.equal(popCard("focus", null, FOCUS), null);

console.log("pop-card self-check passed");
