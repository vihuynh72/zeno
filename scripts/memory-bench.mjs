// Memory bench: does Zeno store, group, retrieve, update and forget what a person tells it?
// Talks to a running server as fake users bench-<runid>-<n>@zeno.local, scores the stored rows and the
// replies with keyword matchers (no LLM judge), then deletes this run's rows. About 32 Muse calls per run.
// Run: node --env-file=.env.local scripts/memory-bench.mjs [--base http://127.0.0.1:3210] [--runs 1] [--keep] [--json path]
// See docs/MEMORY-BENCH.md.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { encode } from "@auth/core/jwt";
import { neon } from "@neondatabase/serverless";

// ---- Scenario: one SJSU student. A matcher is a list of any-of keyword groups: a text matches when every
// group has a keyword that starts a word in it, ignoring case.
const PERSONA = "Maya Tran";

// The grouped profile (src/lib/day.ts MEMORY_GROUPS). `groups` is where a person would look for the fact: one
// memory, one group; a second is allowed only where both read equally well.
const GROUPS = ["about", "routines", "projects", "interests", "people", "work-style", "patterns"];

// Lasting facts said in passing (case 1) and asked for outright (case 4). `seed` is saved through
// POST /api/memory when talk missed the fact, so retrieval, duplicate, update and forget always have a row.
const FACTS = [
  { id: "library-shifts", groups: ["routines", "about"], match: [["library", "shift"], ["tue", "thu"]], seed: "Works library shifts on Tuesdays and Thursdays from 8 to noon." },
  { id: "bio-lab", groups: ["routines"], match: [["bio"], ["lab"], ["wed"]], seed: "Has bio lab every Wednesday at 2 PM." },
  { id: "focus-before-11", groups: ["work-style"], match: [["11", "eleven"]], seed: "Focuses best before 11 AM." },
  { id: "tiny-first-steps", groups: ["work-style"], match: [["tiny", "small", "short", "10", "ten min", "ten-min"], ["step", "start", "task", "chunk"]] },
  { id: "pomodoro", groups: ["work-style"], match: [["pomodoro", "25"]] },
  { id: "soccer", groups: ["routines", "interests"], match: [["soccer"]], seed: "Plays intramural soccer on Monday nights at 7." },
];
const EXPLICIT = [
  { id: "capstone-due", groups: ["projects"], match: [["capstone"], ["dec", "12/5"]], seed: "Capstone is due December 5." },
  { id: "bio-major", groups: ["about"], match: [["bio"], ["major", "junior"]] },
];
// Said in passing and never worth storing (cases 2 and 3). Health is report-only: docs/PLAN-NOV.md keeps health
// details that help planning, so storing it is neither a hit nor a miss.
const JUNK = [
  { id: "tired-today", kind: "transient", match: [["tired", "slept", "sleep", "exhausted"]] },
  { id: "cold-brew", kind: "transient", match: [["cold brew", "coffee", "caffeine"]] },
  { id: "slow-wifi", kind: "transient", match: [["wifi", "wi-fi", "internet"]] },
  { id: "rent-money", kind: "sensitive", match: [["rent", "money", "400", "broke", "financ"]] },
  { id: "medication", kind: "health", match: [["lexapro", "medication", "meds", "antidepress", "ssri", "prescri"]] },
];

// One planning conversation; `about` names what each turn carries. Turn 3 also sets a goal.
const PLANNING = [
  { say: "Hey, trying to get my week under control. I work library shifts Tuesday and Thursday from 8 to noon, so those mornings are gone.", about: ["library-shifts"] },
  { say: "Bio lab is every Wednesday at 2 and it eats the whole afternoon. Ugh, I'm so tired today, barely slept.", about: ["bio-lab", "tired-today"] },
  { say: "I focus best before 11, after lunch my brain is mush. Can you help me finish my stats problem set by Friday?", about: ["focus-before-11"], goal: true },
  { say: "Tiny first steps help me start, like ten minutes max, or I just freeze. I'm on my second cold brew already lol.", about: ["tiny-first-steps", "cold-brew"] },
  { say: "I study in 25 minute pomodoros with 5 minute breaks, that's what actually works for me.", about: ["pomodoro"] },
  { say: "Monday nights I have intramural soccer at 7, so that evening is out.", about: ["soccer"] },
  { say: "The wifi on campus is crawling today, so annoying.", about: ["slow-wifi"] },
  { say: "Money's really tight this month, I'm 400 short on rent and kind of panicking.", about: ["rent-money"] },
  { say: "I started Lexapro last week and it makes me foggy in the mornings.", about: ["medication"] },
  { say: "Please remember this: my capstone is due December 5.", about: ["capstone-due"] },
  { say: "Also remember that I'm a junior, majoring in biology.", about: ["bio-major"] },
];
const GOAL = [["stat", "problem set"]];

// Asked in new conversations (empty history), so only memory can answer (case 8).
const RECALL_BEFORE = [
  { ask: "When's my bio lab?", expect: [["wed"], ["2", "two"]] },
  { ask: "Is Tuesday morning good for deep work?", expect: [["library", "shift", "noon"]] },
  { ask: "What time of day should I do my hardest work?", expect: [["11", "eleven"]] },
  { ask: "When's my capstone due?", expect: [["dec"], ["5", "fifth", "five"]] },
];
const RECALL_AFTER = [{ ask: "Which day is my library shift now?", expect: [["friday"]] }];

const RESTATE = { say: "Oh btw, I have bio lab every Wednesday at 2, can't miss it.", fact: "bio-lab" }; // case 5
// Case 5b: the same fact in other words, which text normalization alone cannot catch.
const REWORD = { say: "Just so you know, biology lab happens on Wednesday afternoons at two, every single week.", fact: "bio-lab" };
const UPDATE = { say: "Heads up, my library shifts moved to Friday afternoons now.", old: "library-shifts", new: [["library", "shift"], ["friday"]] }; // case 6
const FORGET = { say: "Can you forget what I told you about soccer? I don't want that saved.", fact: "soccer" }; // case 7

// Case 9: a messy syllabus plus notes for a second user, with 6 lasting facts, an errand, 1 junk line and 1 health
// line. The bench users have no calendar, so every to-do can't be booked and is kept as a "To do:" memory (Vi,
// 2026-11-01: nothing pasted is lost).
const IMPORT_TEXT = `CS 146 Data Structures, Fall syllabus
Lectures Mon/Wed 10:30-11:45 in DH 450
Midterm 2: Nov 18, in class. Final project due Dec 9 by 11:59pm.
Late work loses 10% per day.

my notes
- bookstore shift every saturday 9 to 1
- vending machine ate my dollar again lol
- i actually study best at night after 9, mornings are useless
- buy poster board + tape, ask Jess about a ride
- refill my insulin at the pharmacy friday before 6
- capstone group meets thursdays 6pm on discord`;
const IMPORT_FACTS = [
  // Not "wed": the final project's deadline memory reads "CS 146 final project, due Wednesday, December 9."
  { id: "cs146-lectures", groups: ["routines", "about"], match: [["146", "data structures"], ["mon", "10:30", "lecture"]] },
  { id: "midterm-nov-18", groups: ["projects"], match: [["midterm"], ["nov", "18"]] },
  { id: "final-project-dec-9", groups: ["projects"], match: [["final"], ["dec", "12/9"]] },
  { id: "bookstore-saturdays", groups: ["routines", "about"], match: [["bookstore"], ["sat"]] },
  { id: "studies-at-night", groups: ["work-style"], match: [["study", "studies", "work"], ["night", "after 9", "9 pm", "9pm"]] },
  { id: "capstone-group-thursdays", groups: ["routines", "projects"], match: [["capstone", "group"], ["thu"]] },
  { id: "poster-board-todo", groups: ["projects"], match: [["to do"], ["poster"]] },
];
const IMPORT_JUNK = [
  { id: "vending-machine", kind: "transient", match: [["vending", "dollar"]] },
  // Report only, like talk's: the refill is a to-do, so it is kept as one.
  { id: "insulin", kind: "health", match: [["insulin", "pharmacy", "diabet", "prescri", "refill"]] },
];

// Case 10: a reply that claims a save or a delete the turn's actions do not show.
const CLAIMS = [
  {
    re: /\b(i'll|i will|i'm going to|gonna)\s+(remember|keep (that|this|it) in mind|note|make a note|hold on to)\b|\bnoted\b|\b(i've|i have)\s+(remembered|noted)\b|\b(keep|keeping) (that|this|it) in mind\b|\bmade a note\b/i,
    needs: ["remembered"],
  },
  // "Saved" or "updated" may be about the goal, so any saving action backs it.
  { re: /\bsaved\b|\bstored\b|\b(i've|i have|i)\s+(added|updated)\b|\bupdated (that|this|it)\b|\bi'll save\b/i, needs: ["remembered", "forgot", "goal-set", "roadmap-changed"] },
  {
    // Not a bare "wiped": "sorry you're wiped tonight" means tired (seen in the first baseline).
    re: /\b(i've|i have|i)\s+(forgotten|forgot|deleted|removed|erased|cleared)\b|\b(i'll|i will)\s+forget\b|\b(forgotten|deleted|erased)\b|\b(forgot|wiped) (it|that)\b|\bwon't remember\b/i,
    needs: ["forgot"],
  },
];

// ---- Matching and scoring
const norm = (text) => String(text ?? "").replace(/[‘’]/g, "'").replace(/[‐-―]/g, "-");
const keyword = (word) => new RegExp(`${/^\w/.test(word) ? "\\b" : ""}${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
const matches = (text, groups) => groups.every((group) => group.some((word) => keyword(word).test(norm(text))));
const found = (rows, item) => rows.filter((row) => matches(row, item.match));
const byId = (id) => [...FACTS, ...EXPLICIT].find((item) => item.id === id);
// The old fact is stale when a row still says it without the new day; "moved from Tue/Thu to Friday" is fine.
const stale = (row) => matches(row, byId(UPDATE.old).match) && !matches(row, UPDATE.new);
const falseClaim = (reply, actions) =>
  CLAIMS.some((claim) => claim.re.test(norm(reply)) && !actions.some((action) => claim.needs.includes(action.type)));
const ratio = (flags) => (flags.length ? flags.filter(Boolean).length / flags.length : 1);
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil((p / 100) * values.length) - 1)] ?? 0;

// One memory, one group: every row of a stored fact sits in the same group, and that group is one it allows.
const oneGroup = (rows, item) => rows.length > 0 && new Set(rows.map((row) => row.group)).size === 1 && item.groups.includes(rows[0].group);
const groupCheck = (rows, items, from) =>
  items
    .map((item) => ({ id: item.id, from, rows: rows.filter((row) => matches(row.text, item.match)) }))
    .filter((item) => item.rows.length > 0)
    .map((item) => ({ ...item, ok: oneGroup(item.rows, [...FACTS, ...EXPLICIT, ...IMPORT_FACTS].find((fact) => fact.id === item.id)) }));

// Points out of 100, so later runs compare on one number. Duplicates and false claims score 1/(1+count).
// Weights changed on 2026-11-01 (group accuracy added, retrieval 20 to 15, explicit recall 10 to 5).
const overall = (m) =>
  15 * m.storeRecallTalk +
  5 * m.explicitRecall +
  10 * m.storeRecallImport +
  5 * m.importPrecision +
  15 * m.retrievalAccuracy +
  10 * m.groupAccuracy +
  10 * m.updateCorrect +
  10 * m.forgetCorrect +
  10 * (1 - m.junkRate) +
  5 / (1 + m.duplicates) +
  5 / (1 + m.falseClaims);

// Self-check of the matchers before any model call is spent.
assert.ok(matches("Thursdays", [["thu"]]) && !matches("though", [["thu"]]) && matches("Wi‑Fi’s slow", [["wi-fi"]]));
for (const item of [...FACTS, ...EXPLICIT].filter((fact) => fact.seed)) {
  const hits = [...FACTS, ...EXPLICIT, ...JUNK].filter((other) => matches(item.seed, other.match)).map((other) => other.id);
  assert.deepEqual(hits, [item.id], `seed for ${item.id} must match only its own fact`);
}
assert.ok([...FACTS, ...EXPLICIT, ...IMPORT_FACTS].every((item) => item.groups.length > 0 && item.groups.every((group) => GROUPS.includes(group))));
assert.ok(matches(REWORD.say, byId(REWORD.fact).match) && !matches(REWORD.say, byId("library-shifts").match));
assert.ok(oneGroup([{ group: "routines" }], byId("bio-lab")) && !oneGroup([{ group: "about" }], byId("bio-lab")));
assert.ok(!oneGroup([{ group: "routines" }, { group: "interests" }], byId("soccer")), "one fact split over two groups");
assert.ok(stale(byId(UPDATE.old).seed) && !stale("Library shifts moved from Tuesday and Thursday to Friday afternoons."));
assert.ok(falseClaim("Got it, I'll remember that.", []) && !falseClaim("I've saved your stats goal.", [{ type: "goal-set" }]));
assert.ok(falseClaim("Done, I’ve forgotten it.", [{ type: "remembered" }]) && !falseClaim("Your lab is Wednesday at two.", []));
assert.ok(falseClaim("Saved: capstone due December fifth.", []) && falseClaim("Okay, forgot it.", []) && falseClaim("Done, I forgot the soccer bit.", []));
assert.ok(!falseClaim("That's saved, and I'm sorry you're wiped tonight Maya.", [{ type: "remembered" }]));
const importFact = (id) => IMPORT_FACTS.find((item) => item.id === id);
assert.ok(matches("To do: Buy poster board and tape", importFact("poster-board-todo").match) && !matches("Buy poster board", importFact("poster-board-todo").match));
assert.ok(!matches("CS 146 final project, due Wednesday, December 9.", importFact("cs146-lectures").match), "a deadline memory is not the lectures");
assert.ok(matches("Has CS 146 lectures Mon/Wed 10:30 to 11:45.", importFact("cs146-lectures").match));

// ---- Talking to the server
const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: "http://127.0.0.1:3210" },
    runs: { type: "string", default: "1" },
    keep: { type: "boolean", default: false },
    json: { type: "string" },
  },
});
const base = args.base.replace(/\/$/, "");
const runs = Math.max(1, Number.parseInt(args.runs, 10) || 1);
const runId = Date.now().toString(36);
assert.ok(process.env.AUTH_SECRET && process.env.DATABASE_URL, "run with --env-file=.env.local so AUTH_SECRET and DATABASE_URL are set");

// The same session cookie Auth.js sets on http; the bench users have no Google token, so calendar and email read as no-access.
async function userFor(n) {
  const email = `bench-${runId}-${n}@zeno.local`;
  const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { name: PERSONA, email, sub: email } });
  return { email, cookie: `authjs.session-token=${token}; tz=America/Los_Angeles` };
}

async function request(user, method, path, body) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { cookie: user.cookie, ...(body && { "content-type": "application/json" }) },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    return { status: response.status, data: await response.json().catch(() => ({})), ms: Date.now() - started };
  } catch (error) {
    return { status: 0, data: { state: error.name }, ms: Date.now() - started };
  }
}

// Full rows ({ text, group, source }); memories() is just their texts.
async function memoryRows(user) {
  let answer = await request(user, "GET", "/api/memory");
  // One retry: a network blip on this free read should not throw away the run's model calls.
  if (answer.data.state !== "ok") answer = await sleep(3000).then(() => request(user, "GET", "/api/memory"));
  assert.equal(answer.data.state, "ok", `GET /api/memory answered ${answer.status} ${answer.data.state}`);
  return answer.data.memories;
}
const memories = async (user) => (await memoryRows(user)).map((memory) => memory.text);

async function runOnce(index, detail) {
  const talker = await userFor(index * 2 + 1);
  const importer = await userFor(index * 2 + 2);
  Object.assign(detail, { users: [talker.email, importer.email], turns: [], seeded: [] });
  assert.deepEqual(await memories(talker), [], "a fresh bench user must start with no memories");

  async function say(history, phase, message, about = []) {
    const { status, data, ms } = await request(talker, "POST", "/api/talk", { message, history: history.slice(-12) });
    const ok = data.state === "ok";
    const turn = { phase, message, about, state: data.state ?? `http ${status}`, reply: ok ? data.reply : null, actions: ok ? data.actions : [], ms };
    turn.falseClaim = ok && falseClaim(turn.reply, turn.actions);
    // Like the client, a failed turn never enters the history.
    if (ok) history.push({ role: "user", content: message }, { role: "assistant", content: data.reply });
    detail.turns.push(turn);
    process.stdout.write(".");
    return turn;
  }
  const ask = async (probes, phase) => {
    const out = [];
    for (const probe of probes) {
      const turn = await say([], phase, probe.ask);
      out.push({ ask: probe.ask, reply: turn.reply, ok: matches(turn.reply, probe.expect) });
    }
    return out;
  };

  const imported = await request(importer, "POST", "/api/import", { text: IMPORT_TEXT });
  const importFull = imported.data.state === "ok" ? imported.data.memories : [];
  const importRows = importFull.map((memory) => memory.text);
  const importFacts = IMPORT_FACTS.map((item) => ({ id: item.id, rows: found(importRows, item) }));
  const importJunkRows = importRows.filter((row) => IMPORT_JUNK.some((item) => item.kind !== "health" && matches(row, item.match)));
  const importFactRows = importRows.filter((row) => !importJunkRows.includes(row) && IMPORT_FACTS.some((item) => matches(row, item.match)));
  detail.import = { state: imported.data.state ?? `http ${imported.status}`, ms: imported.ms, rows: importRows, facts: importFacts };

  const main = [];
  for (const line of PLANNING) await say(main, "planning", line.say, line.about);
  const afterTalkRows = await memoryRows(talker);
  const afterTalk = afterTalkRows.map((memory) => memory.text);
  detail.afterTalk = afterTalkRows.map((memory) => `[${memory.group}] ${memory.text}`);
  detail.facts = FACTS.map((item) => ({ id: item.id, rows: found(afterTalk, item) }));
  detail.explicit = EXPLICIT.map((item) => ({ id: item.id, rows: found(afterTalk, item) }));
  // Measured before any seeding, on what talk and import stored themselves.
  detail.groups = [...groupCheck(afterTalkRows, [...FACTS, ...EXPLICIT], "talk"), ...groupCheck(importFull, IMPORT_FACTS, "import")];
  const unwanted = [
    ...JUNK.map((item) => ({ id: item.id, kind: item.kind, from: "talk", rows: found(afterTalk, item) })),
    ...IMPORT_JUNK.map((item) => ({ id: item.id, kind: item.kind, from: "import", rows: found(importRows, item) })),
  ];
  detail.junk = unwanted.filter((item) => item.kind !== "health");
  detail.health = unwanted.filter((item) => item.kind === "health");
  const combo = detail.turns.find((turn) => turn.message === PLANNING.find((line) => line.goal).say);
  detail.combo = {
    goalSet: combo.actions.some((action) => action.type === "goal-set"),
    remembered: combo.actions.some((action) => action.type === "remembered" && matches(action.label, byId(combo.about[0]).match)),
  };

  for (const item of [...FACTS, ...EXPLICIT].filter((fact) => fact.seed && found(afterTalk, fact).length === 0)) {
    const { data } = await request(talker, "POST", "/api/memory", { text: item.seed, group: item.groups[0] });
    assert.equal(data.state, "ok", `seeding ${item.id} failed`);
    detail.seeded.push(item.id);
  }

  detail.recall = await ask(RECALL_BEFORE, "recall");

  const restated = await say([], "duplicate", RESTATE.say);
  detail.restate = { reply: restated.reply, actions: restated.actions, rows: found(await memories(talker), byId(RESTATE.fact)) };
  const reworded = await say([], "duplicate", REWORD.say);
  const afterDup = await memories(talker);
  detail.reworded = { reply: reworded.reply, actions: reworded.actions, rows: found(afterDup, byId(REWORD.fact)) };
  detail.duplicates = [...FACTS, ...EXPLICIT]
    .map((item) => ({ id: item.id, rows: found(afterDup, item) }))
    .filter((item) => item.rows.length > 1);

  const updated = await say([], "update", UPDATE.say);
  const afterUpdate = await memories(talker);
  detail.update = {
    reply: updated.reply,
    actions: updated.actions,
    staleRows: afterUpdate.filter(stale),
    newRows: afterUpdate.filter((row) => matches(row, UPDATE.new)),
  };
  detail.update.correct = detail.update.staleRows.length === 0 && detail.update.newRows.length > 0;

  const forgot = await say([], "forget", FORGET.say);
  const afterForget = await memories(talker);
  detail.forget = { reply: forgot.reply, actions: forgot.actions, rowsLeft: found(afterForget, byId(FORGET.fact)) };
  detail.forget.correct = detail.forget.rowsLeft.length === 0;

  detail.recall.push(...(await ask(RECALL_AFTER, "recall-after-update")));

  // Case 11, report only: does the model-written opening use what Zeno remembers or the goal?
  const opening = await request(talker, "GET", "/api/day/opening");
  const line = opening.data.state === "ok" ? opening.data.opening : null;
  detail.opening = {
    state: opening.data.state ?? `http ${opening.status}`,
    ms: opening.ms,
    text: line,
    options: opening.data.options ?? [],
    mentionsGoal: matches(line, GOAL),
    mentionsMemory: [...FACTS, ...EXPLICIT].filter((item) => matches(line, item.match)).map((item) => item.id),
  };
  detail.finalRows = await memories(talker);

  const talkMs = detail.turns.map((turn) => turn.ms);
  const metrics = {
    storeRecallTalk: ratio(detail.facts.map((item) => item.rows.length > 0)),
    storeRecallImport: ratio(importFacts.map((item) => item.rows.length > 0)),
    importPrecision: importFactRows.length + importJunkRows.length ? importFactRows.length / (importFactRows.length + importJunkRows.length) : 1,
    explicitRecall: ratio(detail.explicit.map((item) => item.rows.length > 0)),
    groupAccuracy: ratio(detail.groups.map((item) => item.ok)),
    junkRate: 1 - ratio(detail.junk.map((item) => item.rows.length === 0)),
    healthKept: detail.health.filter((item) => item.rows.length > 0).length,
    duplicates: detail.duplicates.reduce((sum, item) => sum + item.rows.length - 1, 0),
    updateCorrect: Number(detail.update.correct),
    forgetCorrect: Number(detail.forget.correct),
    retrievalAccuracy: ratio(detail.recall.map((item) => item.ok)),
    falseClaims: detail.turns.filter((turn) => turn.falseClaim).length,
    comboTurn: Number(detail.combo.goalSet && detail.combo.remembered),
    // Timeouts and model errors score as misses above; a run with any is worth repeating before comparing.
    requestErrors: [...detail.turns, detail.import, detail.opening].filter((item) => item.state !== "ok").length,
    talkP50: percentile(talkMs, 50),
    talkP95: percentile(talkMs, 95),
    // shortcut: a lower bound (1 call, plus 1 when a tool saved something; import and opening 1 each), count "Model call" server log lines for the exact number.
    modelCalls: detail.turns.reduce((sum, turn) => sum + 1 + (turn.actions.length > 0 ? 1 : 0), 2),
  };
  metrics.overall = overall(metrics);
  detail.metrics = metrics;
}

// Plain-language misses with their evidence, for the console and the JSON.
function failures(detail) {
  const out = [];
  const short = (text) => (text == null ? "(no reply)" : `"${String(text).slice(0, 160)}"`);
  const acts = (actions) => (actions?.length ? actions.map((action) => `${action.type}: ${action.label}`).join("; ") : "none");
  for (const item of [...(detail.facts ?? []), ...(detail.explicit ?? [])].filter((fact) => fact.rows.length === 0)) {
    const turn = detail.turns.find((one) => one.about.includes(item.id));
    out.push(`not stored ${item.id}: said "${turn?.message}" -> ${short(turn?.reply)} [actions: ${acts(turn?.actions)}]`);
  }
  if (detail.import && detail.import.state !== "ok") out.push(`import ${detail.import.state} after ${detail.import.ms} ms, so nothing was imported`);
  for (const item of (detail.import?.facts ?? []).filter((fact) => fact.rows.length === 0)) out.push(`import missed ${item.id}`);
  for (const item of (detail.junk ?? []).filter((junk) => junk.rows.length > 0)) out.push(`junk stored (${item.kind}, ${item.from}) ${item.id}: ${item.rows.join(" | ")}`);
  for (const item of (detail.groups ?? []).filter((group) => !group.ok)) {
    out.push(`wrong group ${item.id} (${item.from}): ${item.rows.map((row) => `[${row.group}] ${row.text}`).join(" | ")}`);
  }
  for (const item of detail.duplicates ?? []) out.push(`duplicate ${item.id}: ${item.rows.join(" | ")}`);
  if (detail.reworded?.rows.length > 1) out.push(`reworded duplicate -> ${short(detail.reworded.reply)} [actions: ${acts(detail.reworded.actions)}]`);
  for (const item of (detail.health ?? []).filter((health) => health.rows.length > 0)) {
    out.push(`health kept (report only, allowed when it helps planning; ${item.from}) ${item.id}: ${item.rows.join(" | ")}`);
  }
  if (detail.update && !detail.update.correct) {
    out.push(`update wrong: stale [${detail.update.staleRows.join(" | ")}], new [${detail.update.newRows.join(" | ")}] -> ${short(detail.update.reply)} [actions: ${acts(detail.update.actions)}]`);
  }
  if (detail.forget && !detail.forget.correct) {
    out.push(`forget wrong: left [${detail.forget.rowsLeft.join(" | ")}] -> ${short(detail.forget.reply)} [actions: ${acts(detail.forget.actions)}]`);
  }
  for (const item of (detail.recall ?? []).filter((probe) => !probe.ok)) out.push(`recall miss "${item.ask}" -> ${short(item.reply)}`);
  for (const turn of detail.turns.filter((one) => one.falseClaim)) out.push(`false claim on "${turn.message}" -> ${short(turn.reply)} [actions: ${acts(turn.actions)}]`);
  for (const turn of detail.turns.filter((one) => one.state !== "ok")) out.push(`talk ${turn.state} on "${turn.message}"`);
  if (detail.seeded?.length) out.push(`seeded through POST /api/memory: ${detail.seeded.join(", ")}`);
  return out;
}

// Only this run's users' rows, ever: every statement is filtered on this pattern, so a bench running at the same
// time keeps its own rows.
async function deleteBenchRows() {
  const sql = neon(process.env.DATABASE_URL);
  const left = {};
  for (const table of ["steps", "goals", "memories", "tasks", "user_state"]) {
    await sql.query(`DELETE FROM ${table} WHERE user_email LIKE $1`, [`bench-${runId}-%@zeno.local`]);
    const [row] = await sql.query(`SELECT count(*)::int AS count FROM ${table} WHERE user_email LIKE $1`, [`bench-${runId}-%@zeno.local`]);
    left[table] = row.count;
  }
  return left;
}

// ---- Main
const startedAt = new Date().toISOString();
console.log(`memory bench ${runId}: ${runs} run(s) against ${base}`);
const results = [];
let failure = null;
try {
  for (let index = 0; index < runs; index++) {
    const detail = {};
    results.push(detail);
    await runOnce(index, detail);
    process.stdout.write(` run ${index + 1} done\n`);
  }
} catch (error) {
  failure = error;
}
let cleanup = "skipped (--keep)";
// Three tries, since a failed cleanup leaves bench rows behind.
for (let attempt = 1; !args.keep && attempt <= 3; attempt++) {
  try {
    cleanup = await deleteBenchRows();
    break;
  } catch (error) {
    // Never print the connection string: the message and code are enough.
    cleanup = `failed: ${error.code ?? ""} ${String(error.message).slice(0, 120)}`;
    await sleep(5000);
  }
}

const scored = results.filter((detail) => detail.metrics);
const mean = {};
for (const key of Object.keys(scored[0]?.metrics ?? {})) mean[key] = scored.reduce((sum, detail) => sum + detail.metrics[key], 0) / scored.length;
const allMs = scored.flatMap((detail) => detail.turns.map((turn) => turn.ms));
const ROWS = [
  ["store recall (talk)", "storeRecallTalk", "%"],
  ["store recall (import)", "storeRecallImport", "%"],
  ["import precision", "importPrecision", "%"],
  ["explicit-request recall", "explicitRecall", "%"],
  ["group accuracy", "groupAccuracy", "%"],
  ["junk rate (lower is better)", "junkRate", "%"],
  ["health kept (report only)", "healthKept", "n"],
  ["duplicate rows", "duplicates", "n"],
  ["update correct", "updateCorrect", "%"],
  ["forget correct", "forgetCorrect", "%"],
  ["retrieval accuracy", "retrievalAccuracy", "%"],
  ["false claims", "falseClaims", "n"],
  ["remember + set_goal turn", "comboTurn", "%"],
  ["request errors", "requestErrors", "n"],
  ["talk p50 ms", "talkP50", "ms"],
  ["talk p95 ms", "talkP95", "ms"],
  ["model calls (approx)", "modelCalls", "n"],
  ["OVERALL /100", "overall", "score"],
];
const show = (value, unit) =>
  value === undefined ? "-" : unit === "%" ? `${Math.round(value * 100)}%` : unit === "score" ? value.toFixed(1) : unit === "ms" ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
const header = ["metric".padEnd(28), ...scored.map((_, index) => `run ${index + 1}`.padStart(8)), "mean".padStart(8)].join("");
console.log(`\n${header}\n${"-".repeat(header.length)}`);
for (const [label, key, unit] of ROWS) {
  console.log([label.padEnd(28), ...scored.map((detail) => show(detail.metrics[key], unit).padStart(8)), show(mean[key], unit).padStart(8)].join(""));
}
if (scored.length) {
  console.log(`\npooled talk latency: p50 ${percentile(allMs, 50)} ms, p95 ${percentile(allMs, 95)} ms over ${allMs.length} turns`);
  console.log(`model calls (approx, lower bound): ${scored.reduce((sum, detail) => sum + detail.metrics.modelCalls, 0)} in all`);
  if (scored.some((detail) => detail.metrics.requestErrors)) console.log("note: request errors count as misses above, so rerun before comparing scores");
}
results.forEach((detail, index) => {
  detail.failures = failures({ turns: [], ...detail });
  const opening = detail.opening ? ` | opening: goal ${detail.opening.mentionsGoal ? "yes" : "no"}, memory [${detail.opening.mentionsMemory.join(", ")}] ${detail.opening.text ? `"${detail.opening.text}"` : detail.opening.state}` : "";
  console.log(`\nrun ${index + 1} (${detail.users?.join(", ")})${opening}`);
  for (const line of detail.failures) console.log(`  - ${line}`);
});
console.log(`\ncleanup: ${typeof cleanup === "string" ? cleanup : `rows left for bench users ${JSON.stringify(cleanup)}`}`);

const file = args.json ?? fileURLToPath(new URL(`../bench/results/memory-${runId}.json`, import.meta.url));
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify({ runId, base, startedAt, runs: results, mean, cleanup }, null, 2)}\n`);
console.log(`results: ${file}`);
if (failure) {
  console.error(`bench stopped early: ${failure.message}`);
  process.exitCode = 1;
}
if (typeof cleanup === "object" && Object.values(cleanup).some(Boolean)) process.exitCode = 1;
