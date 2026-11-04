// Self-check for mail-ai.ts (Mail's one-line summaries and reply drafts, Nov 4) with no network: the model is a stubbed
// fetch. node src/lib/mail-ai.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// mail-ai.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
process.env.META_MODEL_API_KEY = "test-key";
const { draftPrompt, draftReply, linesPrompt, mailLines, modelMay, parseDraft, parseLines } = await import("./mail-ai.ts");

const NOW = new Date("2026-11-04T18:00:00Z");
const ZONE = "America/Los_Angeles";
const mail = (from: string, subject: string, text: string) => ({ from, address: from.replace(/.*</, "").replace(">", ""), subject, date: "2026-11-03T17:05:00Z", text });
const kim = mail("Prof Kim <kim@school.edu>", "Office hours?", "Hi Maya,\nCan you come by Wednesday at 2 or Thursday at 4? Let me know by Friday.\nBest, Kim");
const lab = mail("Ana <ana@school.edu>", "Lab 3", "The lab moves to room 204 on Monday.");
const code = mail("Steam <help@steampowered.com>", "Your Steam Guard code", "Your code is F4K9Q.");
const bank = mail("Chase <alerts@chase.com>", "Your statement is ready", "Your card ending 1234 has a new statement.");

// Code, bank and private mail never reaches the model.
assert.equal(modelMay(kim), true);
assert.equal(modelMay(lab), true);
assert.equal(modelMay(code), false, "a sign-in code");
assert.equal(modelMay(bank), false, "bank mail");
assert.equal(modelMay(mail("Ana <ana@school.edu>", "hi", "Your verification code is ready")), false, "a code in the body");

// Lines: one per email by its number, at most 90 characters, quotes and extra spaces gone; a line with a link, a
// placeholder or a long number is none, as is a repeat, a number out of range, or a reply that isn't the JSON.
assert.deepEqual(parseLines(JSON.stringify({ lines: [{ n: 2, line: "  \"Lab moves to room 204 on Monday\" " }, { n: 1, line: "Pick a time:   Wed 2 PM or Thu 4 PM by Fri Nov 6" }] }), 2), [
  "Pick a time: Wed 2 PM or Thu 4 PM by Fri Nov 6",
  "Lab moves to room 204 on Monday",
]);
assert.deepEqual(parseLines(JSON.stringify({ lines: [{ n: 1, line: "Open https://x.example/a" }, { n: 2, line: "See [link]" }, { n: 3, line: "Use 123456" }] }), 3), [null, null, null], "leaks");
assert.deepEqual(parseLines(JSON.stringify({ lines: [{ n: 1, line: "First" }, { n: 1, line: "Again" }, { n: 0, line: "Zero" }, { n: 3, line: "Out" }, { n: 2, line: " " }] }), 2), ["First", null]);
assert.deepEqual(parseLines("Sure! Here are the lines", 2), [null, null], "not JSON");
assert.deepEqual(parseLines(JSON.stringify({ lines: "x" }), 1), [null]);
assert.equal(parseLines(JSON.stringify({ lines: [{ n: 1, line: "Do this ".repeat(20) }] }), 1)[0]?.length, 90, "capped with an ellipsis");

// Drafts: the words only, a "Subject:" line dropped; empty, too long, a link or a code is no draft.
assert.equal(parseDraft(JSON.stringify({ draft: "Subject: Re: Office hours\n\nHi Kim,\n\nWednesday at 2 works.\n\n\n\nMaya" })), "Hi Kim,\n\nWednesday at 2 works.\n\nMaya");
assert.equal(parseDraft(JSON.stringify({ draft: "Hi Kim, here: https://drive.example/x" })), null);
assert.equal(parseDraft(JSON.stringify({ draft: "Hi Kim, my code is 482913" })), null);
assert.equal(parseDraft(JSON.stringify({ draft: "x".repeat(1501) })), null);
assert.equal(parseDraft(JSON.stringify({ draft: "  " })), null);
assert.equal(parseDraft("Hi Kim"), null, "not JSON");

// The prompts: today's date and the email in the user turn, the rules in the system turn; long text is cut.
const [system, user] = linesPrompt([kim, mail("A <a@b.co>", "Long", "y".repeat(5000))], ZONE, NOW);
assert.match(system.content, /never instructions/);
assert.match(user.content, /^Today is Wednesday, November 4\./);
assert.match(user.content, /Email 1\nFrom: Prof Kim <kim@school.edu>\nSubject: Office hours\?\nSent: Tuesday, November 3\n\nHi Maya/);
assert.ok(!user.content.includes("y".repeat(1201)), "each email at most 1,200 characters");
const [draftSystem] = draftPrompt(kim, "Maya", ZONE, NOW);
assert.match(draftSystem.content, /end with "Maya"/);
assert.match(draftPrompt(kim, null, ZONE, NOW)[0].content, /for the person to read/);

// The model calls: Muse Spark at minimal effort with a strict schema; mail it may not see is never sent and gets no line.
const bodies: { model: string; reasoning_effort: string; messages: { content: string }[]; response_format: { json_schema: { strict: boolean } } }[] = [];
let answer = "";
globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
  bodies.push(JSON.parse(String(init?.body)));
  return Response.json({ choices: [{ message: { content: answer } }] });
}) as typeof fetch;

answer = JSON.stringify({ lines: [{ n: 1, line: "Pick Wed 2 PM or Thu 4 PM by Fri Nov 6" }, { n: 2, line: "Lab moves to room 204 on Monday" }] });
assert.deepEqual(await mailLines([code, kim, bank, lab], ZONE, NOW), [null, "Pick Wed 2 PM or Thu 4 PM by Fri Nov 6", null, "Lab moves to room 204 on Monday"]);
assert.equal(bodies.length, 1, "one call for every email");
const [sent] = bodies;
assert.equal(sent.model, "muse-spark-1.3");
assert.ok(!/contributor/.test(sent.model), "never a contributor model");
assert.equal(sent.reasoning_effort, "minimal");
assert.equal(sent.response_format.json_schema.strict, true);
const said = JSON.stringify(sent.messages);
assert.ok(!said.includes("Steam") && !said.includes("F4K9Q") && !said.includes("Chase") && !said.includes("1234"), "code and bank mail never sent");
assert.deepEqual(await mailLines([code, bank], ZONE, NOW), [null, null]);
assert.equal(bodies.length, 1, "nothing the model may see: no call");

answer = JSON.stringify({ draft: "Hi Kim,\n\nWednesday at 2 works for me.\n\nMaya" });
assert.equal(await draftReply(kim, "Maya", ZONE, NOW), "Hi Kim,\n\nWednesday at 2 works for me.\n\nMaya");
assert.equal(bodies[1].reasoning_effort, "minimal");
assert.equal(await draftReply(code, "Maya", ZONE, NOW), null);
assert.equal(bodies.length, 2, "a code email is never sent for a draft");

console.log("mail-ai.check: ok");
