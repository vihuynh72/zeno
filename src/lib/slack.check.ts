// Self-check for slack.ts with Slack stubbed (no network): node src/lib/slack.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// slack.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { slackItems, slackText } = await import("./slack.ts");
const logs: string[] = [];
console.error = (...args: unknown[]) => void logs.push(args.join(" "));

// ---- Slack's markup as words.
assert.equal(slackText("<@U1> can you look at <#C9|lab-3>?", "U1"), " can you look at #lab-3?");
assert.equal(slackText("ask <@U2> and <@U3|ana>", "U1"), "ask @someone and @ana");
assert.equal(slackText("<!here> rides &amp; snacks &lt;3", "U1"), "@here rides & snacks <3");
assert.equal(slackText("<!subteam^S1|@officers> vote?", "U1"), "@officers vote?");
assert.equal(slackText("see <https://docs.google.com/d/1?usp=sharing|the plan>", "U1"), "see the plan");
assert.equal(slackText("see <https://zoom.us/j/812?pwd=x|zoom.us/j/812>", "U1"), "see https://zoom.us/j/812?pwd=x", "a label that is an address");
assert.equal(slackText("mail <mailto:ana@school.edu|ana@school.edu>", "U1"), "mail [link]");

// ---- Messages that mention the person and ask something.
const now = Date.parse("2026-11-04T18:00:00Z");
const channel = { id: "C1", name: "lab-3", is_im: false, is_mpim: false };
const match = (ts: string, text: string, extra: object = {}) => ({
  ts,
  text,
  user: "U2",
  username: "ana",
  permalink: `https://school.slack.com/archives/C1/p${ts.replace(".", "")}`,
  channel,
  ...extra,
});
const matches = [
  match("1762279200.000100", "<@U1> can you send the slides from <https://drive.google.com/x?id=1|here>? Room code 48213377"),
  match("1762275600.000200", "<@U1> thanks, the deck looks great"),
  match("1762272000.000300", "<@U1> please review <https://github.com/a/b/pull/1>", { channel: { id: "D1", name: "U2", is_im: true } }),
  match("1762268400.000400", "When can you meet <@U1>", { username: "ben", channel: { id: "G1", name: "mpdm-ana--ben-1", is_mpim: true } }),
  match("1762264800.000500", "<@U1> I'll check?", { user: "U1", username: "maya" }),
  match("1762261200.000600", "<@U1> just a link https://x.com/a?b=1"),
  match("1762257600.000700", `<@U1> could you ${"really ".repeat(30)}help?`),
  match("1762254000.000800", "<@U1> need you there?", { permalink: "javascript:alert(1)" }),
  match("1762250400.000900", "&gt; can you?\nsure, see below"),
];

const calls: { url: string; body: URLSearchParams; auth: string }[] = [];
let answers: Record<string, () => Response> = {};
const reset = () => {
  answers = {
    "auth.test": () => Response.json({ ok: true, user_id: "U1", team: "School" }),
    "search.messages": () => Response.json({ ok: true, messages: { total: matches.length, matches } }),
  };
};
reset();
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  calls.push({ url, body: init?.body as URLSearchParams, auth: (init?.headers as Record<string, string>).Authorization });
  assert.ok(init?.signal, "an 8 s timeout");
  return answers[url.split("/").pop() ?? ""]();
}) as typeof fetch;

const answer = await slackItems("xoxp-token", now);
assert.equal(answer.state, "ok");
const items = answer.state === "ok" ? answer.items : [];

// auth.test for the person's id, then one search for their mention over the last 14 days, newest first.
assert.deepEqual(calls.map((call) => call.url), ["https://slack.com/api/auth.test", "https://slack.com/api/search.messages"]);
assert.ok(calls.every((call) => call.auth === "Bearer xoxp-token"));
assert.deepEqual(Object.fromEntries(calls[1].body), { query: "<@U1> after:2026-10-20", sort: "timestamp", sort_dir: "desc", count: "30" });

assert.deepEqual(items[0], {
  app: "slack",
  id: "C1-1762279200.000100",
  title: "can you send the slides from here? Room code [number]",
  url: "https://school.slack.com/archives/C1/p1762279200000100",
  kind: "message",
  due: null,
  detail: "#lab-3 · ana",
});
assert.deepEqual(
  items.slice(1).map(({ title, detail }) => [title, detail]),
  [
    ["please review [link]", "DM · ana"],
    ["When can you meet", "DM · ben"],
    [`could you ${"really ".repeat(30)}help?`.slice(0, 100), "#lab-3 · ana"],
  ],
  "no thanks, no message of their own, no link's ?, no bad permalink, no quoted ask",
);
assert.ok(items.every((item) => item.title.length <= 100));

// A token Slack refuses, by HTTP status or by its error, is no-access; anything else is error.
for (const [method, reply, state] of [
  ["auth.test", () => Response.json({ ok: false, error: "invalid_auth" }), "no-access"],
  ["auth.test", () => Response.json({ ok: false, error: "token_revoked" }), "no-access"],
  ["auth.test", () => new Response("", { status: 401 }), "no-access"],
  ["search.messages", () => Response.json({ ok: false, error: "missing_scope" }), "no-access"],
  ["search.messages", () => Response.json({ ok: false, error: "ratelimited" }), "error"],
  ["search.messages", () => new Response("busy", { status: 503 }), "error"],
  [
    "search.messages",
    () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    },
    "error",
  ],
] as const) {
  reset();
  answers[method] = reply;
  assert.deepEqual(await slackItems("xoxp-token", now), { state }, `${method} ${state}`);
}

// Failures are logged for the server's logs, never with the token.
assert.ok(logs.length > 0 && logs.every((line) => !line.includes("xoxp-token")), logs.join("\n"));

console.log("slack self-check passed");
