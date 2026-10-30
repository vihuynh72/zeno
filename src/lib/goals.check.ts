// Self-check for goals.ts against the real database, as a throwaway user it deletes after:
// DATABASE_URL=... node src/lib/goals.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// goals.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { currentGoal, replaceRemainingSteps, setGoal, setStepStatus } = await import("./goals.ts");
const { getSql } = await import("./db.ts");

const email = `goals-check-${crypto.randomUUID()}@example.invalid`;
try {
  const essay = await setGoal(email, "History essay", [
    { title: "Reread the prompt", minutes: 10 },
    { title: "Write a thesis", minutes: 15 },
  ]);
  await setStepStatus(email, essay.steps[0].id, "done");
  const quiz = await setGoal(email, "Quiz prep", [{ title: "Review limits", minutes: 20 }]);
  assert.equal((await currentGoal(email))?.id, quiz.id, "a new goal pauses the old one");

  // Finishing the last step, then adding one in the same turn, keeps that goal current.
  await setStepStatus(email, quiz.steps[0].id, "done");
  await replaceRemainingSteps(email, quiz.id, [{ title: "Try five practice limits", minutes: 15 }]);
  const extended = await currentGoal(email);
  assert.equal(extended?.id, quiz.id, "new steps reopen a finished goal");
  assert.deepEqual(extended.steps.map((step) => step.status), ["done", "todo"]);

  // Once that goal is done, the paused one comes back where it was left.
  await setStepStatus(email, extended.steps[1].id, "done");
  const back = await currentGoal(email);
  assert.equal(back?.id, essay.id, "the paused goal comes back");
  assert.deepEqual(back.steps.map((step) => step.status), ["done", "todo"]);

  await setStepStatus(email, back.steps[1].id, "done");
  assert.equal(await currentGoal(email), null, "nothing is left");
} finally {
  // Steps go with their goals.
  await getSql()`DELETE FROM goals WHERE user_email = ${email}`;
}

console.log("goals self-check passed");
