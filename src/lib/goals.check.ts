// Self-check for goals.ts against the real database, as a throwaway user it deletes after:
// DATABASE_URL=... node src/lib/goals.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// goals.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const {
  activateGoal, changeStepStatus, currentGoal, doneTitles, finishedDays, finishedYesterday, openGoals, orderGoals, recentSteps, replaceRemainingSteps, savePrep,
  setGoal, setStepStatus, stepTitles, titleKey,
} = await import("./goals.ts");
const { getSql } = await import("./db.ts");
const { localDate } = await import("./tz.ts");

// The home's goal options (Vi, Nov 3): the current plan first, then by due date with undated ones last, then the most
// recently updated; at most 5.
const open = (id: string, due: string | null, updatedAt: number, current = false) => ({ goal: { id, title: id, due, steps: [] }, current, updatedAt });
assert.deepEqual(
  orderGoals([
    open("undated-old", null, 1),
    open("fri", "2026-11-06", 1),
    open("undated-new", null, 5),
    open("current", "2026-12-01", 0, true),
    open("thu", "2026-11-05", 1),
    open("thu-newer", "2026-11-05", 9),
    open("sat", "2026-11-07", 1),
  ]).map((goal) => goal.id),
  ["current", "thu-newer", "thu", "fri", "sat"],
);
assert.deepEqual(orderGoals([open("old", null, 1), open("new", null, 2)]).map((goal) => goal.id), ["new", "old"]);
assert.deepEqual(orderGoals([]), []);

const email = `goals-check-${crypto.randomUUID()}@zeno.local`;
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
  assert.equal(await stepTitles("someone-else@zeno.local", todo.id), null, "another person's step is not found");
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

  // A reworded fact stays one row (Vi, Nov 2: a tidy list): a longer wording takes the row, but what Zeno finds never
  // overwrites the person's own words.
  assert.equal(
    await addMemory(memoryEmail, "Has bio lab every Wednesday at 2 PM in Duncan Hall.", { group: "routines", source: "calendar" }),
    null,
    "a scan's wording never replaces theirs",
  );
  const fuller = await addMemory(memoryEmail, "Bio lab Wednesdays at 2pm in Duncan Hall.", { group: "routines" });
  assert.deepEqual([fuller?.id, fuller?.text, fuller?.source], [lab?.id, "Bio lab Wednesdays at 2pm in Duncan Hall.", "you"], "their own longer wording takes the row");
  assert.equal(await addMemory(memoryEmail, "Bio lab on Wednesdays at 2 PM.", { source: "calendar" }), null, "a shorter finding adds nothing");
  const desk = await addMemory(memoryEmail, "Works at the campus library.", { source: "email" });
  const deskLonger = await addMemory(memoryEmail, "Works at the campus library front desk.", { source: "calendar" });
  assert.deepEqual([deskLonger?.id, deskLonger?.source], [desk?.id, "calendar"], "a longer finding takes a finding's row, with its source");
  assert.deepEqual(
    (await listMemories(memoryEmail)).filter((memory) => /library|wednesday/i.test(memory.text)).map((memory) => memory.text),
    ["Works at the campus library front desk.", "Bio lab Wednesdays at 2pm in Duncan Hall."],
    "one row each",
  );
  // What the person says is never dropped for a longer fact that holds its words: "with" is a filler word, and a club
  // they are in is not a meeting about it.
  const without = await addMemory(memoryEmail, "Likes studying without music.", { group: "work-style" });
  const withMusic = await addMemory(memoryEmail, "Likes studying with music.", { group: "work-style" });
  assert.ok(withMusic && withMusic.id !== without?.id, "said again the other way, it is a new row");
  await addMemory(memoryEmail, "Has a meeting with Ana about the robotics club.", { group: "projects" });
  assert.equal((await addMemory(memoryEmail, "Is in the robotics club."))?.text, "Is in the robotics club.", "a shorter fact of theirs saves");
  // A longer wording takes a row only in its group and of its kind: a to-do never takes a person's row, and a fact
  // never rewrites a deadline.
  const kim = await addMemory(memoryEmail, "Has Prof Kim for CHEM 1A.", { group: "people", source: "email" });
  const midterm = await addMemory(memoryEmail, "To do: Email Prof Kim about the CHEM 1A midterm", { group: "projects" });
  const essay = await addMemory(memoryEmail, "HIST 110: Essay 2, due Friday, November 6.", { group: "projects", source: "canvas" });
  const wwi = await addMemory(memoryEmail, "Has HIST 110 Essay 2 on WWI causes due Friday, November 6.", { group: "projects" });
  assert.ok(midterm && wwi && ![kim?.id, essay?.id].includes(midterm.id) && ![kim?.id, essay?.id].includes(wwi.id), "new rows");
  const kept = await listMemories(memoryEmail);
  assert.ok(kept.some((memory) => memory.id === kim?.id && memory.text === "Has Prof Kim for CHEM 1A." && memory.group === "people"));
  assert.ok(kept.some((memory) => memory.id === essay?.id && memory.text === "HIST 110: Essay 2, due Friday, November 6." && memory.source === "canvas"));
  // A to-do saved before Nov 2 never expired; a longer wording of it takes its row and the 14-day default.
  const [old] = await sql`
    INSERT INTO memories (user_email, text, memory_group, source) VALUES (${memoryEmail}, 'To do: Buy poster board', 'projects', 'you') RETURNING id
  `;
  const poster = await addMemory(memoryEmail, "To do: Buy poster board for the expo", { group: "projects" });
  const [{ expires }] = await sql`SELECT expires_on::text AS expires FROM memories WHERE id = ${old.id}`;
  assert.deepEqual([poster?.id, expires], [old.id, new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)], "a merged to-do clears too");

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
  const coaching = await addMemory(memoryEmail, "Has chess club every other Friday at 3 PM.", { group: "about", source: "calendar" });
  assert.ok(coaching && (await forgetMemory(memoryEmail, coaching.id)));
  assert.equal(await forgetMemory(memoryEmail, coaching.id), false, "removing twice finds nothing");
  assert.equal(
    await addMemory(memoryEmail, "has chess club every other Friday at 3pm", { group: "about", source: "calendar" }),
    null,
    "a scan never brings it back",
  );
  assert.equal(await addMemory(memoryEmail, "Has chess club every other Friday at 3 PM in the library.", { source: "calendar" }), null, "not even reworded");
  assert.equal((await addMemory(memoryEmail, "Has chess club every other Friday at 3 PM.", { group: "about" }))?.source, "you", "said again, it saves");

  // A row saved under the old rules (health "when it helps planning") is deleted on the next read and never listed;
  // the person's own to-do keeps its instructions, which only other people's mail may not give.
  await sql`
    INSERT INTO memories (user_email, text, memory_group, source)
    VALUES (${memoryEmail}, 'Has ADHD and sees a counselor on Tuesdays.', 'about', 'you'), (${memoryEmail}, 'To do: Read the lab instructions', 'projects', 'you')
  `;
  const listed = (await listMemories(memoryEmail)).map((memory) => memory.text);
  assert.ok(!listed.some((text) => /adhd/i.test(text)) && listed.includes("To do: Read the lab instructions"), "a private row is never listed");
  assert.equal((await sql`SELECT count(*)::int AS n FROM memories WHERE user_email = ${memoryEmail} AND text ILIKE '%adhd%'`)[0].n, 0, "and is gone");

  // The whole profile keeps 120: past it, the oldest non-"you" fact goes.
  await sql`
    INSERT INTO memories (user_email, text, memory_group, source, created_at)
    SELECT ${memoryEmail}, 'Scanned fact ' || n, 'projects', 'email', now() - interval '1 day' + n * interval '1 second'
    FROM generate_series(1, 120 - ${(await listMemories(memoryEmail)).length}) AS n
  `;
  assert.ok(await addMemory(memoryEmail, "Starts best with a timer and a tiny first step.", { group: "about" }));
  const all = await listMemories(memoryEmail);
  assert.equal(all.length, 120);
  assert.ok(!all.some((memory) => memory.text === "Scanned fact 1") && all.some((memory) => memory.text === "Scanned fact 2"));
  assert.deepEqual(
    [...new Set(all.map((memory) => memory.group))],
    ["about", "routines", "projects", "people", "work-style", "patterns"],
    "listed in Memory's group order",
  );
  assert.equal(all[0].text, "Starts best with a timer and a tiny first step.", "newest first within a group");
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
  const morning = "Works best in the morning.";
  assert.ok(await addMemory(laterEmail, morning, { group: "patterns", source: "pattern" }));
  const learned = await learnFromSteps(laterEmail, zone);
  assert.equal(learned?.text, "Works best late at night.");
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

// To-dos clear (Vi, Nov 2): an undated one 14 days after it is saved, and one at once when its plan's last step is done.
const todoEmail = `todos-check-${crypto.randomUUID()}@zeno.local`;
try {
  const chapter = await addMemory(todoEmail, "To do: Read chapter 4 for HIST 110", { group: "projects" });
  await addMemory(todoEmail, "To do: Email Prof Patel", { group: "projects" });
  const [{ expires }] = await sql`SELECT expires_on::text AS expires FROM memories WHERE id = ${chapter?.id}`;
  assert.equal(expires, new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10), "an undated to-do clears in 14 days");
  const plan = await setGoal(todoEmail, "Read chapter 4 for HIST 110", [
    { title: "Skim the headings", minutes: 5 },
    { title: "Read the first half", minutes: 20 },
  ]);
  await setStepStatus(todoEmail, plan.steps[0].id, "done");
  await setStepStatus(todoEmail, plan.steps[1].id, "skipped");
  assert.equal((await listMemories(todoEmail)).length, 2, "a skipped last step finishes no to-do");
  await setStepStatus(todoEmail, plan.steps[1].id, "done");
  assert.deepEqual((await listMemories(todoEmail)).map((memory) => memory.text), ["To do: Email Prof Patel"], "its last step done clears it");
  assert.deepEqual(await forgottenMemories(todoEmail), [], "dropped, not forgotten, so a later paste keeps it again");
  // The first longer wording takes the short to-do's row; the second is another to-do.
  await addMemory(todoEmail, "To do: Email Prof Patel about an extension", { group: "projects" });
  await addMemory(todoEmail, "To do: Email Prof Patel my project group", { group: "projects" });
  const patel = await setGoal(todoEmail, "Email Prof Patel", [{ title: "Write two lines", minutes: 5 }]);
  await setStepStatus(todoEmail, patel.steps[0].id, "done");
  assert.deepEqual(
    (await listMemories(todoEmail)).map((memory) => memory.text).sort(),
    ["To do: Email Prof Patel about an extension", "To do: Email Prof Patel my project group"],
    "a shorter plan title finishes neither longer to-do",
  );
} finally {
  await sql`DELETE FROM goals WHERE user_email = ${todoEmail}`;
  await sql`DELETE FROM memories WHERE user_email = ${todoEmail}`;
  await sql`DELETE FROM user_state WHERE user_email = ${todoEmail}`;
}

// Canvas deadlines: each sync replaces the last one's; the person's own deadline and their removals stay.
const { deadlineMemory, replaceCanvasDeadlines } = await import("./goals.ts");
const canvasEmail = `canvas-check-${crypto.randomUUID()}@zeno.local`;
try {
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const due = (title: string, n: number) => ({ text: deadlineMemory({ title, date: day(n) }), expiresOn: day(n + 1) });
  const own = await addMemory(canvasEmail, due("CS 146: Project 2", 4).text, { group: "projects", expiresOn: day(5) });
  await replaceCanvasDeadlines(canvasEmail, [due("BIO 121: Quiz 4", 2), due("CS 146: Project 2", 4), due("HIST 110: Essay 1", 6)]);
  const first = await listMemories(canvasEmail);
  assert.deepEqual(
    first.map((memory) => [memory.text, memory.group, memory.source]),
    [
      [due("HIST 110: Essay 1", 6).text, "projects", "canvas"],
      [due("BIO 121: Quiz 4", 2).text, "projects", "canvas"],
      [own?.text, "projects", "you"],
    ],
    "their own deadline stays theirs, once",
  );
  const quiz = first.find((memory) => memory.text.startsWith("BIO 121"));
  assert.ok(quiz && (await forgetMemory(canvasEmail, quiz.id)));
  await replaceCanvasDeadlines(canvasEmail, [due("BIO 121: Quiz 4", 2), due("MATH 30: Problem set 6", 3)]);
  assert.deepEqual(
    (await listMemories(canvasEmail)).map((memory) => memory.text),
    [due("MATH 30: Problem set 6", 3).text, own?.text],
    "the next sync replaces the last one's, and a removed one stays removed",
  );
  const [{ expires }] = await sql`SELECT expires_on::text AS expires FROM memories WHERE user_email = ${canvasEmail} AND source = 'canvas'`;
  assert.equal(expires, day(4), "kept until the day after it is due");
  await replaceCanvasDeadlines(canvasEmail, []);
  assert.deepEqual((await listMemories(canvasEmail)).map((memory) => memory.text), [own?.text], "Disconnect (DELETE /api/canvas) deletes every Canvas one, never theirs");
} finally {
  await sql`DELETE FROM memories WHERE user_email = ${canvasEmail}`;
  await sql`DELETE FROM user_state WHERE user_email = ${canvasEmail}`;
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
  const checkIn = "Has a doctor check-in every other Friday at 4 PM.";
  modelReplies = [
    JSON.stringify({
      facts: [
        { text: coaching, group: "about", source: "calendar", private: false },
        { text: major, group: "about", source: "email", private: false },
        { text: checkIn, group: "about", source: "calendar", private: false },
        { text: "Has ADHD coaching every other Friday at 5 PM.", group: "about", source: "calendar", private: true },
      ],
    }),
  ];
  const first = await scanProfile(scanEmail, session, zone, { first: true });
  assert.deepEqual(texts(first), [coaching, major], "the first scan learns");
  // Overall health in generic words goes back to the device, and a condition's name is kept nowhere (Vi, Nov 2).
  assert.deepEqual(first.state === "ok" && first.private, [{ text: checkIn, group: "about" }]);
  assert.equal((await sql`SELECT count(*)::int AS n FROM memories WHERE user_email = ${scanEmail} AND (text ILIKE '%adhd%' OR text ILIKE '%doctor%')`)[0].n, 0);
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

// Open plans and switching between them (Vi, Nov 3): every active or paused plan with a step left, the current one
// first; opening one makes it current and pauses the old one, never a done plan or another person's.
const switchEmail = `goals-switch-check-${crypto.randomUUID()}@zeno.local`;
try {
  const essay = await setGoal(switchEmail, "HIST 15 essay", [{ title: "Read the prompt", minutes: 5 }, { title: "Outline claim 1", minutes: 15 }], "2026-12-04");
  const lab = await setGoal(switchEmail, "BIO 20 lab report", [{ title: "Open the lab manual", minutes: 5 }], "2026-12-01");
  const quiz = await setGoal(switchEmail, "CS 146 quiz prep", [{ title: "List the topics", minutes: 5 }]);
  const note = await setGoal(switchEmail, "Email the TA", [{ title: "Write two lines", minutes: 5 }]);
  // Its last step done finishes it, and the plan paused last (the quiz) comes back as the current one.
  await setStepStatus(switchEmail, note.steps[0].id, "done");
  const titles = async () => (await openGoals(switchEmail)).map((goal) => goal.title);
  assert.deepEqual(await titles(), ["CS 146 quiz prep", "BIO 20 lab report", "HIST 15 essay"], "the current plan, then by due date; a done one is not open");
  assert.deepEqual((await openGoals(switchEmail))[2].steps.map((step) => step.title), ["Read the prompt", "Outline claim 1"], "each with its steps");

  // A step running in the current plan goes back in line when another plan opens.
  await setStepStatus(switchEmail, quiz.steps[0].id, "doing");
  assert.equal((await activateGoal(switchEmail, essay.id))?.id, essay.id);
  assert.equal((await currentGoal(switchEmail))?.id, essay.id, "the opened plan is current");
  assert.deepEqual(await titles(), ["HIST 15 essay", "BIO 20 lab report", "CS 146 quiz prep"], "the old one is paused, not lost");
  const left = (await openGoals(switchEmail)).find((goal) => goal.id === quiz.id)?.steps[0];
  assert.deepEqual([left?.status, left?.startedAt], ["todo", null], "its running step is back in line");
  // A refused one changes nothing: the current plan stays current and its running step keeps going.
  await setStepStatus(switchEmail, essay.steps[0].id, "doing");
  for (const [label, who, id] of [
    ["a done plan", switchEmail, note.id],
    ["another person's", `someone-else-${crypto.randomUUID()}@zeno.local`, lab.id],
    ["an unknown one", switchEmail, crypto.randomUUID()],
  ]) {
    assert.equal(await activateGoal(who, id), null, label);
  }
  assert.equal((await currentGoal(switchEmail))?.id, essay.id, "none of them paused the current one");
  assert.deepEqual((await activateGoal(switchEmail, essay.id))?.steps.map((step) => step.status), ["doing", "todo"], "nor stopped its step, and opening it again keeps it");

  // Yesterday's finished steps, on the person's clock: not today's.
  await setStepStatus(switchEmail, essay.steps[0].id, "done");
  const noon = dayBounds(zone, new Date(dayBounds(zone).start.getTime() - 1)).start.getTime() + 12 * 3_600_000;
  await sql`UPDATE steps SET done_at = ${new Date(noon).toISOString()} WHERE id = ${essay.steps[0].id}`;
  await setStepStatus(switchEmail, quiz.steps[0].id, "done");
  assert.deepEqual(await finishedYesterday(switchEmail, zone), ["Read the prompt"]);

  // A plan finished before its due date hides that deadline (the home, the Desk and the Week match by titleKey).
  assert.equal(titleKey("PHIL 134: Essay 2!"), "phil 134 essay 2");
  const early = await setGoal(switchEmail, "PHIL 134: Essay 2", [{ title: "Read the prompt", minutes: 5 }], "2099-12-31");
  assert.deepEqual(await doneTitles(switchEmail, "2026-11-03"), [], "an open plan is not done");
  await changeStepStatus(switchEmail, early.steps[0].id, "done");
  assert.deepEqual(await doneTitles(switchEmail, "2026-11-03"), ["PHIL 134: Essay 2"], "its last step finished it");
  assert.deepEqual(await doneTitles(switchEmail, "2100-01-01"), [], "past its due date it is not listed");

  // A stale page's "todo" never unfinishes a step finished elsewhere (the Mac clock, an MCP app).
  const twoStep = await setGoal(switchEmail, "CS 146: Problem set 5", [{ title: "Read problem 1", minutes: 5 }, { title: "Solve problem 1", minutes: 20 }], null);
  await changeStepStatus(switchEmail, twoStep.steps[0].id, "doing");
  await changeStepStatus(switchEmail, twoStep.steps[0].id, "done");
  const stale = await changeStepStatus(switchEmail, twoStep.steps[0].id, "todo");
  assert.equal(stale?.goal.steps[0].status, "done", "a todo from a stale page leaves a finished step done");
  // A paused plan whose last step is finished from an app becomes done, not paused forever.
  await setGoal(switchEmail, "ENVS 119: Quiz 11", [{ title: "Review chapter 11", minutes: 10 }], null);
  const finished = await changeStepStatus(switchEmail, twoStep.steps[1].id, "done");
  const [row] = await sql`SELECT status FROM goals WHERE id = ${finished?.goal.id ?? ""}`;
  assert.equal(row?.status, "done", "the paused plan's last step finished it");
} finally {
  await sql`DELETE FROM goals WHERE user_email = ${switchEmail}`;
}

console.log("goals self-check passed");
