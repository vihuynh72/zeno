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

// Memory: one row per fact whatever its case, punctuation or spacing; caps that drop the oldest scanned facts first.
const { GROUP_CAPS, addMemory, forgetMemory, listMemories } = await import("./goals.ts");
const memoryEmail = `profile-check-${crypto.randomUUID()}@zeno.local`;
const sql = getSql();
try {
  const lab = await addMemory(memoryEmail, "  Bio lab Wednesdays at 2pm. ", { group: "routines" });
  assert.deepEqual([lab?.text, lab?.group, lab?.source], ["Bio lab Wednesdays at 2pm.", "routines", "you"]);
  assert.equal(await addMemory(memoryEmail, "bio lab wednesdays at 2 PM", { group: "about", source: "calendar" }), null, "the same fact in any group");
  assert.equal(await addMemory(memoryEmail, " ... ", {}), null, "no words, nothing saved");
  assert.equal((await addMemory(memoryEmail, "Bio lab Thursdays at 2pm."))?.group, "about", "another day is another fact; the group defaults to about");

  // patterns keeps its 10 freshest noticed facts; what the person said never takes their slots.
  const cap = GROUP_CAPS.patterns;
  for (let n = 1; n <= 3; n++) await addMemory(memoryEmail, `Said pattern ${n}`, { group: "patterns" });
  for (let n = 1; n <= cap + 2; n++) await addMemory(memoryEmail, `Noticed pattern ${n}`, { group: "patterns", source: "pattern" });
  const patterns = (await listMemories(memoryEmail)).filter((memory) => memory.group === "patterns");
  assert.deepEqual(
    patterns.map((memory) => memory.text),
    [...Array.from({ length: cap }, (_, index) => `Noticed pattern ${cap + 2 - index}`), "Said pattern 3", "Said pattern 2", "Said pattern 1"],
    "newest first; the 2 oldest noticed ones were dropped and the person's words kept",
  );
  for (let n = 4; n <= cap + 1; n++) await addMemory(memoryEmail, `Said pattern ${n}`, { group: "patterns" });
  assert.ok(
    await addMemory(memoryEmail, "Noticed pattern late", { group: "patterns", source: "pattern" }),
    "a group full of the person's own words still takes a new noticed fact",
  );
  const full = (await listMemories(memoryEmail)).filter((memory) => memory.group === "patterns");
  assert.deepEqual(
    [full.filter((memory) => memory.source === "you").length, full.filter((memory) => memory.source === "pattern").length],
    [cap + 1, cap],
    "the person's own words all stay; noticed ones keep their freshest 10",
  );

  // A removed fact never comes back from a scan; the person can still say it again.
  const coaching = await addMemory(memoryEmail, "Has ADHD coaching every other Friday at 3 PM.", { group: "about", source: "calendar" });
  assert.ok(coaching && (await forgetMemory(memoryEmail, coaching.id)));
  assert.equal(await forgetMemory(memoryEmail, coaching.id), false, "removing twice finds nothing");
  assert.equal(
    await addMemory(memoryEmail, "has ADHD coaching every other Friday at 3pm", { group: "about", source: "calendar" }),
    null,
    "a scan never brings it back",
  );
  assert.equal((await addMemory(memoryEmail, "Has ADHD coaching every other Friday at 3 PM.", { group: "about" }))?.source, "you", "said again, it saves");

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
  await sql`DELETE FROM user_state WHERE user_email = ${memoryEmail}`;
}

// Deadline memories expire; patterns that stop holding go quietly, and one the person removed never comes back.
const { dropMemories, forgottenMemories } = await import("./goals.ts");
const { learnFromSteps } = await import("./patterns.ts");
const { nextDate } = await import("./calendar.ts");
const { dayBounds } = await import("./tz.ts");
const laterEmail = `patterns-check-${crypto.randomUUID()}@zeno.local`;
try {
  // Hidden once the day after the due date has begun at UTC-12, the last place a day ends; deleted by the next save.
  const lastDay = new Date(Date.now() - 12 * 3_600_000).toISOString().slice(0, 10);
  const gone = await addMemory(laterEmail, "Quiz 4, due yesterday.", { group: "projects", expiresOn: lastDay });
  const kept = await addMemory(laterEmail, "Quiz 5, due today.", { group: "projects", expiresOn: nextDate(lastDay) });
  assert.ok(gone && kept);
  assert.deepEqual((await listMemories(laterEmail)).map((memory) => memory.text), ["Quiz 5, due today."], "an expired deadline is hidden");
  assert.ok(await addMemory(laterEmail, "Quiz 4, due yesterday.", { group: "projects" }), "an expired row never counts as known");
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM memories WHERE id = ${gone.id}`;
  assert.equal(count, 0, "the next save deletes it");
  await dropMemories(laterEmail, [kept.id]);
  assert.ok(!(await listMemories(laterEmail)).some((memory) => memory.id === kept.id), "dropMemories deletes");
  await sql`DELETE FROM memories WHERE user_email = ${laterEmail}`;

  // Five steps finished late at night in Los Angeles over the last five days.
  const zone = "America/Los_Angeles";
  const owl = await setGoal(laterEmail, "Night owl", Array.from({ length: 5 }, (_, index) => ({ title: `Step ${index + 1}`, minutes: 5 })));
  for (const [index, item] of owl.steps.entries()) {
    await setStepStatus(laterEmail, item.id, "done");
    const night = dayBounds(zone, new Date(Date.now() - (index + 1) * 86_400_000)).start.getTime() + 23 * 3_600_000;
    await sql`UPDATE steps SET done_at = ${new Date(night).toISOString()} WHERE id = ${item.id}`;
  }
  const morning = "You finish most steps in the morning.";
  assert.ok(await addMemory(laterEmail, morning, { group: "patterns", source: "pattern" }));
  const learned = await learnFromSteps(laterEmail, zone);
  assert.equal(learned?.text, "You finish most steps late at night.");
  assert.deepEqual((await listMemories(laterEmail)).map((memory) => memory.text), [learned.text], "the morning pattern stopped holding");
  assert.deepEqual(await forgottenMemories(laterEmail), [], "Zeno's own clean-up is not the person's removal");

  // Undo on the Noted line (DELETE /api/memory/[id]) sticks: the same steps never save it again.
  assert.ok(await forgetMemory(laterEmail, learned.id));
  assert.equal(await learnFromSteps(laterEmail, zone), null, "quiet after Undo");
  assert.deepEqual(await listMemories(laterEmail), []);
  // The morning pattern Zeno dropped above comes back through learnFromSteps once the same steps move to 9 AM.
  for (const [index, item] of owl.steps.entries()) {
    const nine = dayBounds(zone, new Date(Date.now() - (index + 1) * 86_400_000)).start.getTime() + 9 * 3_600_000;
    await sql`UPDATE steps SET done_at = ${new Date(nine).toISOString()} WHERE id = ${item.id}`;
  }
  assert.equal((await learnFromSteps(laterEmail, zone))?.text, morning, "a pattern Zeno dropped can be noticed again");
} finally {
  await sql`DELETE FROM goals WHERE user_email = ${laterEmail}`;
  await sql`DELETE FROM memories WHERE user_email = ${laterEmail}`;
  await sql`DELETE FROM user_state WHERE user_email = ${laterEmail}`;
}

// The daily profile scan, with Google and Muse stubbed and the real database: once a local day, the same facts
// again on a repeat call, removed facts never relearned, and the day given back when the model or the mail fails.
const { scanProfile } = await import("./profile.ts");
const scanEmail = `profile-scan-check-${crypto.randomUUID()}@zeno.local`;
const zone = "America/Los_Angeles";
const session = { accessToken: "token-xyz", user: { name: "Maya Tran" } };
const realFetch = globalThis.fetch;
const realLog = console.log;
const modelBodies: { messages: { content: string }[]; response_format: { json_schema: { schema: { properties: { facts: { maxItems: number } } } } } }[] = [];
const gmailQueries: string[] = [];
let modelReplies: string[] = [];
let gmailStatus = 200;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "api.meta.ai") {
    modelBodies.push(JSON.parse(String(init?.body)));
    return json({ choices: [{ message: { content: modelReplies.shift() ?? '{"facts":[]}' } }] });
  }
  if (url.hostname === "www.googleapis.com") {
    if (url.pathname.endsWith("/calendarList")) return json({ items: [{ id: "maya@example.com", primary: true, selected: true }] });
    return json({
      items: [
        {
          summary: "Tutoring",
          recurrence: ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR"],
          start: { dateTime: "2026-10-02T15:00:00-07:00" },
          end: { dateTime: "2026-10-02T15:45:00-07:00" },
        },
      ],
    });
  }
  if (url.hostname === "gmail.googleapis.com") {
    if (gmailStatus !== 200) return json({ error: { code: gmailStatus } }, gmailStatus);
    gmailQueries.push(url.searchParams.get("q") ?? "");
    return json({ messages: [] });
  }
  return realFetch(input, init);
}) as typeof fetch;
const scannedAt = async () => {
  const [row] = await sql`SELECT profile_scanned_at FROM user_state WHERE user_email = ${scanEmail}`;
  return new Date(row.profile_scanned_at).getTime();
};
const dayBack = () => sql`UPDATE user_state SET profile_scanned_at = profile_scanned_at - interval '1 day' WHERE user_email = ${scanEmail}`;
const texts = (result: Awaited<ReturnType<typeof scanProfile>>) => (result.state === "ok" ? result.learned.map((memory) => memory.text) : result.state);
try {
  process.env.META_MODEL_API_KEY ??= "check-only";
  console.log = () => undefined;
  const coaching = "Has tutoring every other Friday at 3 PM.";
  const major = "Is a junior biology major at SJSU.";
  const adhd = "Has ADHD coaching every other Friday at 4 PM.";
  modelReplies = [
    JSON.stringify({
      facts: [
        { text: coaching, group: "about", source: "calendar", private: false },
        { text: major, group: "about", source: "email", private: false },
        { text: adhd, group: "about", source: "calendar", private: false },
      ],
    }),
  ];
  const first = await scanProfile(scanEmail, session, zone, { first: true });
  assert.deepEqual(texts(first), [coaching, major], "the first scan learns");
  // Private (overall health), so it goes back to the device and no row ever holds it.
  assert.deepEqual(first.state === "ok" && first.private, [{ text: adhd, group: "about" }]);
  assert.equal((await sql`SELECT count(*)::int AS n FROM memories WHERE user_email = ${scanEmail} AND text ILIKE '%adhd%'`)[0].n, 0);
  assert.ok(gmailQueries.every((q) => q.startsWith("newer_than:30d ")), "the first scan reads 30 days of mail");
  assert.equal(modelBodies[0].response_format.json_schema.schema.properties.facts.maxItems, 20);

  // A reload or a retry of setup the same day gets the same facts, without reading Google or calling the model.
  assert.deepEqual(texts(await scanProfile(scanEmail, session, zone, { first: true })), [coaching, major], "a repeat call sees them");
  assert.equal(modelBodies.length, 1, "and makes no model call");

  // Removed on day 1, never relearned on day 2, even reworded.
  const learned = await listMemories(scanEmail);
  assert.ok(await forgetMemory(scanEmail, learned.find((memory) => memory.text === coaching)?.id ?? ""));
  assert.deepEqual(texts(await scanProfile(scanEmail, session, zone)), [major], "a removed fact is not shown again");
  await dayBack();
  gmailQueries.length = 0;
  modelReplies = [
    JSON.stringify({
      facts: [
        { text: "Has tutoring every other Friday at 3pm.", group: "about", source: "calendar" },
        { text: "Plays intramural soccer Monday nights.", group: "routines", source: "calendar" },
      ],
    }),
  ];
  assert.deepEqual(texts(await scanProfile(scanEmail, session, zone)), ["Plays intramural soccer Monday nights."], "day 2 learns only what is new");
  assert.match(modelBodies[1].messages[1].content, /Removed by the person, never add again:\n- Has tutoring every other Friday at 3 PM\./);
  assert.equal(modelBodies[1].response_format.json_schema.schema.properties.facts.maxItems, 8, "a daily scan keeps up to 8");
  assert.ok(gmailQueries.length === 2 && gmailQueries.every((q) => /^after:\d+ /.test(q)), "a daily scan reads mail since the last one");

  // A model failure gives the day back.
  await dayBack();
  const before = await scannedAt();
  modelReplies = ["Sure! Here is what I found"];
  await assert.rejects(scanProfile(scanEmail, session, zone), /not JSON/);
  assert.equal(await scannedAt(), before, "the day is given back after a model failure");

  // Mail that cannot be read gives the day back too, after the calendar facts are saved.
  gmailStatus = 500;
  modelReplies = [JSON.stringify({ facts: [{ text: "Has stats section Wednesdays at 10 AM.", group: "routines", source: "calendar" }] })];
  assert.deepEqual(texts(await scanProfile(scanEmail, session, zone)), ["Has stats section Wednesdays at 10 AM."]);
  assert.equal(await scannedAt(), before, "unread mail is read again next time");
} finally {
  globalThis.fetch = realFetch;
  console.log = realLog;
  await sql`DELETE FROM memories WHERE user_email = ${scanEmail}`;
  await sql`DELETE FROM user_state WHERE user_email = ${scanEmail}`;
}

console.log("goals self-check passed");
