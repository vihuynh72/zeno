// Self-check for goals.ts against the real database, as a throwaway user it deletes after:
// DATABASE_URL=... node src/lib/goals.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// goals.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { currentGoal, replaceRemainingSteps, savePrep, setGoal, setStepStatus, stepTitles } = await import("./goals.ts");
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
} finally {
  // Steps go with their goals.
  await getSql()`DELETE FROM goals WHERE user_email = ${email}`;
}

// Memory: one row per fact whatever its case, punctuation or spacing; caps that drop the oldest scanned facts first.
const { GROUP_CAPS, addMemory, listMemories } = await import("./goals.ts");
const memoryEmail = `profile-check-${crypto.randomUUID()}@zeno.local`;
const sql = getSql();
try {
  const lab = await addMemory(memoryEmail, "  Bio lab Wednesdays at 2pm. ", { group: "routines" });
  assert.deepEqual([lab?.text, lab?.group, lab?.source], ["Bio lab Wednesdays at 2pm.", "routines", "you"]);
  assert.equal(await addMemory(memoryEmail, "bio lab wednesdays at 2 PM", { group: "about", source: "calendar" }), null, "the same fact in any group");
  assert.equal(await addMemory(memoryEmail, " ... ", {}), null, "no words, nothing saved");
  assert.equal((await addMemory(memoryEmail, "Bio lab Thursdays at 2pm."))?.group, "about", "another day is another fact; the group defaults to about");

  // patterns keeps 10: what the person said stays, the oldest noticed patterns go first.
  const cap = GROUP_CAPS.patterns;
  for (let n = 1; n <= 3; n++) await addMemory(memoryEmail, `Said pattern ${n}`, { group: "patterns" });
  for (let n = 1; n <= cap; n++) await addMemory(memoryEmail, `Noticed pattern ${n}`, { group: "patterns", source: "pattern" });
  const patterns = (await listMemories(memoryEmail)).filter((memory) => memory.group === "patterns");
  assert.equal(patterns.length, cap);
  assert.deepEqual(
    patterns.map((memory) => memory.text),
    [...Array.from({ length: cap - 3 }, (_, index) => `Noticed pattern ${cap - index}`), "Said pattern 3", "Said pattern 2", "Said pattern 1"],
    "newest first; the 3 oldest noticed ones were dropped",
  );
  for (let n = 4; n <= cap + 1; n++) await addMemory(memoryEmail, `Said pattern ${n}`, { group: "patterns" });
  const full = (await listMemories(memoryEmail)).filter((memory) => memory.group === "patterns");
  assert.equal(full.length, cap + 1, "the person's own words stay past the group cap");
  assert.ok(full.every((memory) => memory.source === "you"));
  assert.equal(await addMemory(memoryEmail, "Noticed pattern late", { group: "patterns", source: "pattern" }), null, "a full group of their own words keeps them");

  // The whole profile keeps 120: past it, the oldest non-"you" fact goes.
  await sql`
    INSERT INTO memories (user_email, text, memory_group, source, created_at)
    SELECT ${memoryEmail}, 'Scanned fact ' || n, 'projects', 'email', now() - interval '1 day' + n * interval '1 second'
    FROM generate_series(1, 120 - ${(await listMemories(memoryEmail)).length}) AS n
  `;
  assert.ok(await addMemory(memoryEmail, "Has ADHD and starts best with a timer.", { group: "about" }));
  const all = await listMemories(memoryEmail);
  assert.equal(all.length, 120);
  assert.ok(!all.some((memory) => memory.text === "Scanned fact 1") && all.some((memory) => memory.text === "Scanned fact 2"));
  assert.deepEqual(
    [...new Set(all.map((memory) => memory.group))],
    ["about", "routines", "projects", "patterns"],
    "listed in Memory's group order",
  );
  assert.equal(all[0].text, "Has ADHD and starts best with a timer.", "newest first within a group");
} finally {
  await sql`DELETE FROM memories WHERE user_email = ${memoryEmail}`;
}

console.log("goals self-check passed");
