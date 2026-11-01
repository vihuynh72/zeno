// Self-check for goals.ts against the real database, as a throwaway user it deletes after:
// DATABASE_URL=... node src/lib/goals.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// goals.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { changeStepStatus, currentGoal, finishedDays, recentSteps, replaceRemainingSteps, savePrep, setGoal, setStepStatus, stepTitles } =
  await import("./goals.ts");
const { getSql } = await import("./db.ts");
const { localDate } = await import("./tz.ts");

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

  // Sources stay on their step, for its owner only, until the step is renamed.
  const todo = extended.steps[1];
  const sources = [{ title: "Limits practice", url: "https://example.com/limits", why: "Five short problems with answers" }];
  assert.equal(await stepTitles("someone-else@example.invalid", todo.id), null, "another person's step is not found");
  assert.deepEqual(await stepTitles(email, todo.id), { goal: "Quiz prep", step: "Try five practice limits" });
  await savePrep(email, todo.id, sources);
  assert.deepEqual((await currentGoal(email))?.steps[1].prep, sources, "the latest sources come back with the goal");
  await replaceRemainingSteps(email, quiz.id, [{ id: todo.id, title: "Try five practice limits", minutes: 10 }]);
  assert.deepEqual((await currentGoal(email))?.steps[1].prep, sources, "a kept title keeps its sources");
  await replaceRemainingSteps(email, quiz.id, [{ id: todo.id, title: "Try three practice limits", minutes: 10 }]);
  assert.equal((await currentGoal(email))?.steps[1].prep, null, "a renamed step drops them");

  // Once that goal is done, the paused one comes back where it was left.
  await setStepStatus(email, extended.steps[1].id, "done");
  const back = await currentGoal(email);
  assert.equal(back?.id, essay.id, "the paused goal comes back");
  assert.deepEqual(back.steps.map((step) => step.status), ["done", "todo"]);

  await setStepStatus(email, back.steps[1].id, "done");
  assert.equal(await currentGoal(email), null, "nothing is left");

  // Start, Start again, Done, Done again: a restart opens a fresh timer; a repeated Done keeps the first finish.
  const report = await setGoal(email, "Lab report", [
    { title: "Outline the methods", minutes: 5 },
    { title: "Read the rubric", minutes: 30 },
  ]);
  const [outline, rubric] = report.steps.map((step) => step.id);
  const started = await changeStepStatus(email, outline, "doing");
  const restarted = await changeStepStatus(email, outline, "doing");
  const finished = await changeStepStatus(email, outline, "done");
  const repeated = await changeStepStatus(email, outline, "done");
  const first = (change: typeof started) => change?.goal.steps[0];
  assert.deepEqual([started?.before, restarted?.before, finished?.before, repeated?.before], ["todo", "doing", "doing", "done"]);
  assert.ok(Date.parse(first(restarted)?.startedAt ?? "") > Date.parse(first(started)?.startedAt ?? ""), "Start again restarts the timer");
  assert.equal(first(repeated)?.doneAt, first(finished)?.doneAt, "a repeated Done keeps the first finish");
  assert.equal(first(repeated)?.startedAt, first(restarted)?.startedAt, "Done keeps the start");
  await setStepStatus(email, rubric, "skipped");

  // History: a step finished 31 days ago still counts for the streak's days, not for patterns.
  await getSql()`UPDATE steps SET done_at = now() - interval '31 days' WHERE id = ${essay.steps[0].id}`;
  const zone = "Pacific/Kiritimati"; // UTC+14: its date differs from the server's for 14 hours a day
  assert.deepEqual(
    await finishedDays(email, zone),
    { [localDate(zone, new Date(Date.now() - 31 * 86_400_000))]: 1, [localDate(zone)]: 4 },
    "finished steps per local date over the whole history; skips don't count",
  );
  const recent = await recentSteps(email);
  assert.deepEqual(recent.map((step) => step.status), ["done", "done", "done", "done", "skipped"], "the last 30 days, oldest first");
  assert.deepEqual(recent.map((step) => step.startedAt !== null), [false, false, false, true, false], "only the outline was started");
} finally {
  // Steps go with their goals.
  await getSql()`DELETE FROM goals WHERE user_email = ${email}`;
}

console.log("goals self-check passed");
