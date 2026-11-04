// Self-check for app-token.ts and app-tools.ts: what a connected app's token reaches, and for whom. The pure parts always
// run; the database parts need DATABASE_URL (node --env-file=.env.local src/lib/app-token.check.ts) and use two
// throwaway @zeno.local people, deleted after. No model call: plan_goal saves the rule plan.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";

// The tools import through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
delete process.env.META_MODEL_API_KEY;

const { bearerOf, mintToken, revokeToken, tokenOwner } = await import("./app-token.ts");
const { APP_TOOLS, PLANS_PER_DAY, companionDone, companionNow, companionReply, goalsText, nextText, nowOf } = await import("./app-tools.ts");
type Goal = import("./day.ts").Goal;
type Step = import("./day.ts").Step;

// The bearer token, however the header is spaced or cased; anything else is none.
const request = (authorization?: string) =>
  new Request("http://zeno.local/api/companion/now", authorization ? { headers: { authorization } } : undefined);
assert.equal(bearerOf(request("Bearer zeno_abc")), "zeno_abc");
assert.equal(bearerOf(request("bearer   zeno_abc ")), "zeno_abc");
assert.equal(bearerOf(request("Basic zeno_abc")), null);
assert.equal(bearerOf(request("Bearer")), null);
assert.equal(bearerOf(request()), null);

// A malformed token is refused before any database work, and a companion request without a working one gets 401.
assert.equal(await tokenOwner(""), null);
assert.equal(await tokenOwner("zeno_short"), null);
assert.equal(await tokenOwner(`Zeno_${"A".repeat(43)}`), null);
for (const authorization of [undefined, "Bearer zeno_short", "Basic abc"]) {
  const response = await companionReply(request(authorization), async () => assert.fail("no person without a token"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { state: "unauthorized" });
  assert.equal(response.headers.get("cache-control"), "no-store");
}

// The step an app shows: the running step, else the first one still to do; done counts finished steps only.
const step = (id: string, status: Step["status"], minutes: number | null, startedAt: string | null = null): Step => ({
  id,
  title: `Step ${id}`,
  minutes,
  status,
  startedAt,
  doneAt: status === "done" ? "2026-11-03T19:00:00.000Z" : null,
});
const essay: Goal = {
  id: "g1",
  title: "PHIL 134 essay",
  due: "2026-11-06",
  steps: [step("a", "done", 5), step("b", "todo", 10), step("c", "doing", 15, "2026-11-03T20:00:00.000Z"), step("d", "todo", null), step("e", "skipped", 5)],
};
assert.deepEqual(nowOf(essay), {
  state: "ok",
  step: { id: "c", title: "Step c", minutes: 15, startedAt: "2026-11-03T20:00:00.000Z", status: "doing" },
  goal: { title: "PHIL 134 essay", done: 1, total: 5, due: "2026-11-06" },
});
const waiting = nowOf({ ...essay, steps: essay.steps.filter((one) => one.id !== "c") });
assert.ok(waiting.state === "ok" && waiting.step?.id === "b" && waiting.step.status === "todo");
const finished = nowOf({ ...essay, due: null, steps: [step("a", "done", 5)] });
assert.deepEqual(finished, { state: "ok", step: null, goal: { title: "PHIL 134 essay", done: 1, total: 1, due: null } });
assert.deepEqual(nowOf(null), { state: "ok", step: null, goal: null });

// Short text with step ids, for next_step and list_goals.
const now = new Date("2026-11-03T20:12:20.000Z");
assert.equal(nextText(essay, now), "Running: Step c · 15 min · started 12 min ago · id c\nGoal: PHIL 134 essay · 1 of 5 done · due 2026-11-06");
assert.equal(nextText({ ...essay, steps: [step("b", "todo", 10)] }, now), "Next: Step b · 10 min · id b\nGoal: PHIL 134 essay · 0 of 1 done · due 2026-11-06");
assert.equal(nextText({ ...essay, steps: [step("a", "done", 5)] }), "Every step of PHIL 134 essay is done. plan_goal makes a new goal.");
assert.match(nextText(null), /^No current goal\./);
assert.equal(
  goalsText([essay, { id: "g2", title: "Calc quiz prep", due: null, steps: [step("f", "todo", 20)] }], "g1", now),
  [
    "PHIL 134 essay · 1 of 5 done · due 2026-11-06 · current",
    "- running: Step c · 15 min · started 12 min ago · id c",
    "- todo: Step b · 10 min · id b",
    "- todo: Step d · id d",
    "",
    "Calc quiz prep · 0 of 1 done",
    "- todo: Step f · 20 min · id f",
  ].join("\n"),
);
assert.equal(goalsText([], null), "No open goals. plan_goal makes one.");
assert.deepEqual(
  APP_TOOLS.map((tool) => tool.name),
  ["list_goals", "next_step", "plan_goal", "start_step", "finish_step"],
);

if (!process.env.DATABASE_URL) {
  console.log("app-token check: pure parts ok; the database parts need DATABASE_URL (node --env-file=.env.local).");
} else {
  const { getSql } = await import("./db.ts");
  const { currentGoal, openGoals } = await import("./goals.ts");
  const { localDate } = await import("./tz.ts");
  const sql = getSql();
  const maya = `app-token-check-${crypto.randomUUID()}@zeno.local`;
  const other = `app-token-check-${crypto.randomUUID()}@zeno.local`;
  try {
    // One token per person, kept only as its hash; a new one turns the old one off.
    const first = await mintToken(maya, "America/Los_Angeles");
    assert.match(first, /^zeno_[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(await tokenOwner(first), { email: maya, timeZone: "America/Los_Angeles" });
    const [row] = await sql`SELECT token_hash FROM app_tokens WHERE user_email = ${maya}`;
    assert.equal(row.token_hash, createHash("sha256").update(first).digest("hex"), "only the SHA-256 is stored");
    const token = await mintToken(maya, "Asia/Tokyo");
    assert.notEqual(token, first);
    assert.equal(await tokenOwner(first), null, "the old token stops working");
    assert.deepEqual(await tokenOwner(token), { email: maya, timeZone: "Asia/Tokyo" });
    assert.equal(await tokenOwner(`zeno_${"A".repeat(43)}`), null, "a well-formed wrong token");
    const theirs = await mintToken(other, "America/Los_Angeles");
    assert.equal((await sql`SELECT count(*)::int AS n FROM app_tokens WHERE user_email = ${maya}`)[0].n, 1, "one row per person");

    // The tools act as the token's owner and no one else.
    const run = async (who: string, name: string, args: Record<string, unknown> = {}) => {
      const owner = await tokenOwner(who);
      assert.ok(owner, "a working token");
      const tool = APP_TOOLS.find((one) => one.name === name);
      assert.ok(tool, name);
      return tool.run(owner, args);
    };
    assert.match((await run(token, "next_step")).text, /^No current goal\./);
    assert.match((await run(token, "list_goals")).text, /^No open goals\./);

    const tomorrow = localDate("Asia/Tokyo", new Date(Date.now() + 86_400_000));
    const planned = await run(token, "plan_goal", { title: "PHIL 134 essay", due: tomorrow });
    assert.equal(planned.isError, undefined);
    const goal = await currentGoal(maya);
    assert.ok(goal);
    const ids = goal.steps.map((one) => one.id);
    assert.deepEqual(
      goal.steps.map((one) => [one.title, one.minutes]),
      [
        ["Open PHIL 134 essay and read what it asks", 5],
        ["List the parts it needs", 10],
        ["Do the first part", 25],
      ],
      "the rule plan, without the model",
    );
    assert.equal(
      planned.text,
      [
        `Current goal now: PHIL 134 essay · 0 of 3 done · due ${tomorrow}`,
        `- todo: Open PHIL 134 essay and read what it asks · 5 min · id ${ids[0]}`,
        `- todo: List the parts it needs · 10 min · id ${ids[1]}`,
        `- todo: Do the first part · 25 min · id ${ids[2]}`,
      ].join("\n"),
    );
    assert.equal((await run(token, "plan_goal", { title: "phil 134 ESSAY!" })).isError, undefined);
    assert.deepEqual((await openGoals(maya)).map((one) => one.id), [goal.id], "the same title opens the plan, never a copy");
    for (const args of [{}, { title: " " }, { title: "Old essay", due: "2020-01-01" }, { title: "Essay", due: "Friday" }]) {
      assert.equal((await run(token, "plan_goal", args)).isError, true, JSON.stringify(args));
    }
    assert.equal((await run(token, "next_step")).text, `Next: Open PHIL 134 essay and read what it asks · 5 min · id ${ids[0]}\nGoal: PHIL 134 essay · 0 of 3 done · due ${tomorrow}`);

    // The other person sees none of it and can change none of it, with any of the tools or the companion.
    assert.match((await run(theirs, "next_step")).text, /^No current goal\./);
    assert.match((await run(theirs, "list_goals")).text, /^No open goals\./);
    assert.equal((await run(theirs, "start_step", { step_id: ids[0] })).isError, true);
    assert.equal((await run(theirs, "finish_step", { step_id: ids[0] })).isError, true);
    assert.equal((await run(theirs, "finish_step")).isError, true);
    assert.deepEqual(await companionNow(other), { state: "ok", step: null, goal: null });
    assert.deepEqual(await companionDone(other), { state: "ok", step: null, goal: null });
    assert.deepEqual((await currentGoal(maya))?.steps.map((one) => one.status), ["todo", "todo", "todo"], "untouched");

    // Start, then the Mac clock's now and Done.
    assert.equal((await run(token, "start_step", { step_id: ids[0] })).text, "Started: Open PHIL 134 essay and read what it asks, 5 min planned. finish_step when it's done.");
    const running = await companionNow(maya);
    assert.ok(running.state === "ok" && running.step);
    assert.deepEqual([running.step.id, running.step.status, Boolean(running.step.startedAt)], [ids[0], "doing", true]);
    assert.deepEqual(running.goal, { title: "PHIL 134 essay", done: 0, total: 3, due: tomorrow });
    const after = await companionDone(maya);
    assert.deepEqual(after, {
      state: "ok",
      step: { id: ids[1], title: "List the parts it needs", minutes: 10, startedAt: null, status: "todo" },
      goal: { title: "PHIL 134 essay", done: 1, total: 3, due: tomorrow },
    });
    assert.deepEqual(await companionDone(maya), after, "with nothing running, Done changes nothing");
    assert.equal((await run(token, "finish_step")).isError, true, "no running step to finish");
    assert.equal((await run(token, "finish_step", { step_id: ids[1] })).text, `Done: List the parts it needs. Next: Do the first part · 25 min · id ${ids[2]}`);
    assert.equal((await run(token, "start_step", { step_id: ids[0] })).isError, true, "a done step never restarts");
    assert.equal((await run(token, "start_step", { step_id: "not-a-step" })).isError, true);

    // A new plan pauses the essay; starting the essay's step makes it current again, with one running step across plans.
    await run(token, "plan_goal", { title: "Calc quiz prep" });
    const quiz = await currentGoal(maya);
    assert.ok(quiz && quiz.id !== goal.id);
    await run(token, "start_step", { step_id: quiz.steps[0].id });
    const listed = (await run(token, "list_goals")).text;
    assert.match(listed, /^Calc quiz prep · 0 of 3 done · current\n- running: Open Calc quiz prep and read what it asks · 5 min · started 0 min ago · id /);
    assert.match(listed, new RegExp(`\\n\\nPHIL 134 essay · 2 of 3 done · due ${tomorrow}\\n- todo: Do the first part · 25 min · id ${ids[2]}$`));
    await run(token, "start_step", { step_id: ids[2] });
    assert.equal((await currentGoal(maya))?.id, goal.id, "its plan is current again");
    assert.equal((await openGoals(maya)).flatMap((one) => one.steps).filter((one) => one.status === "doing").length, 1, "one running step");
    assert.equal((await run(token, "finish_step")).text, "Done: Do the first part. That's all of PHIL 134 essay.");
    assert.equal((await currentGoal(maya))?.id, quiz.id, "the paused plan comes back");

    // At most 20 new plans a day, per person.
    await sql`INSERT INTO goals (user_email, title, status) SELECT ${maya}, 'Filler ' || n, 'done' FROM generate_series(1, ${PLANS_PER_DAY}) n`;
    assert.match((await run(token, "plan_goal", { title: "One more" })).text, /^That's 20 new plans in a day/);
    assert.equal((await run(theirs, "plan_goal", { title: "One more" })).isError, undefined, "another person's plans don't count");

    // The companion routes answer for the token's owner; a turned-off token gets 401.
    const theirNow = await companionReply(request(`Bearer ${theirs}`), companionNow);
    assert.equal(theirNow.status, 200);
    assert.deepEqual(((await theirNow.json()) as { goal: unknown }).goal, { title: "One more", done: 0, total: 3, due: null });
    await revokeToken(maya);
    assert.equal(await tokenOwner(token), null, "turned off");
    assert.equal((await companionReply(request(`Bearer ${token}`), companionNow)).status, 401);
    console.log("app-token check: ok, with the database");
  } finally {
    for (const email of [maya, other]) {
      // Steps go with their goals.
      await sql`DELETE FROM goals WHERE user_email = ${email}`;
      await sql`DELETE FROM app_tokens WHERE user_email = ${email}`;
    }
  }
}
