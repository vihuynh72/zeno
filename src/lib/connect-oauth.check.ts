// Self-check for the Notion and Slack sign-in (no network): node src/lib/connect-oauth.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// These files import through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
process.env.AUTH_SECRET = "check-secret";
for (const name of ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET", "SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"]) delete process.env[name];
const { connectState, finishConnect, startConnect, stateOk } = await import("./connect-oauth.ts");
const { NOTION_OAUTH } = await import("./notion.ts");
const { SLACK_OAUTH } = await import("./slack.ts");

// ---- The state: bound to the app and the signed-in person, good for 10 minutes, never holding the email.
const at = Date.parse("2026-11-04T18:00:00Z");
const state = connectState("notion", "maya@school.edu", at);
assert.equal(stateOk(state, "notion", "maya@school.edu", at + 60_000), true);
assert.equal(state.includes("maya"), false, "no email in the URL");
assert.equal(stateOk(state, "notion", "ana@school.edu", at + 60_000), false, "someone else");
assert.equal(stateOk(state, "slack", "maya@school.edu", at + 60_000), false, "another app");
assert.equal(stateOk(state, "notion", "maya@school.edu", at + 10 * 60_000), false, "10 minutes old");
assert.equal(stateOk(state, "notion", "maya@school.edu", at - 1), false, "from the future");
assert.equal(stateOk(`${at + 1}.${state.split(".")[1]}`, "notion", "maya@school.edu", at + 60_000), false, "a changed time");
assert.equal(stateOk(`${state}x`, "notion", "maya@school.edu", at + 60_000), false);
for (const bad of [undefined, null, "", "abc", "1.2", 5]) assert.equal(stateOk(bad, "notion", "maya@school.edu", at), false, String(bad));

// ---- Start: 503 without the app's keys, 401 signed out, else off to the app with the request's own callback.
const origin = "https://zeno.example";
let res = startConnect(NOTION_OAUTH, origin, "maya@school.edu");
assert.equal(res.status, 503);
assert.equal(await res.text(), "Notion isn't set up on this server yet.");
process.env.NOTION_CLIENT_ID = "notion-id";
process.env.NOTION_CLIENT_SECRET = "notion-secret";
process.env.SLACK_CLIENT_ID = "slack-id";
process.env.SLACK_CLIENT_SECRET = "slack-secret";
assert.equal(startConnect(NOTION_OAUTH, origin, null).status, 401);

res = startConnect(NOTION_OAUTH, origin, "maya@school.edu");
assert.equal(res.status, 302);
let to = new URL(res.headers.get("location") ?? "");
assert.equal(`${to.origin}${to.pathname}`, "https://api.notion.com/v1/oauth/authorize");
assert.equal(to.searchParams.get("client_id"), "notion-id");
assert.equal(to.searchParams.get("response_type"), "code");
assert.equal(to.searchParams.get("owner"), "user");
assert.equal(to.searchParams.get("redirect_uri"), "https://zeno.example/api/connect/notion/callback");
assert.equal(stateOk(to.searchParams.get("state"), "notion", "maya@school.edu"), true);
assert.equal(res.headers.get("location")?.includes("notion-secret"), false, "the secret stays on the server");

res = startConnect(SLACK_OAUTH, "http://localhost:3000", "maya@school.edu");
to = new URL(res.headers.get("location") ?? "");
assert.equal(`${to.origin}${to.pathname}`, "https://slack.com/oauth/v2/authorize");
assert.equal(to.searchParams.get("client_id"), "slack-id");
assert.equal(to.searchParams.get("user_scope"), "search:read");
assert.equal(to.searchParams.get("scope"), null, "no bot scopes");
assert.equal(to.searchParams.get("redirect_uri"), "http://localhost:3000/api/connect/slack/callback", "a local server gets its own callback");
assert.equal(stateOk(to.searchParams.get("state"), "slack", "maya@school.edu"), true);

// ---- Callback: the code is traded here, and the token goes to /connect/<app> in the fragment only.
const calls: { url: string; init?: RequestInit }[] = [];
let reply = () => Response.json({ access_token: "ntn_secret token/+=", bot_id: "b1" });
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  calls.push({ url, init });
  return reply();
}) as typeof fetch;
const errors: string[] = [];
console.error = (...args: unknown[]) => void errors.push(args.join(" "));

const callback = (query: string) => new URL(`${origin}/api/connect/notion/callback?${query}`);
const good = connectState("notion", "maya@school.edu");
res = await finishConnect(NOTION_OAUTH, callback(`code=c0de&state=${good}`), origin, "maya@school.edu");
assert.equal(res.status, 303);
assert.equal(res.headers.get("location"), `/connect/notion#token=${encodeURIComponent("ntn_secret token/+=")}`);
assert.equal(res.headers.get("cache-control"), "no-store");
assert.equal(calls.length, 1);
assert.equal(calls[0].url, "https://api.notion.com/v1/oauth/token");
const headers = calls[0].init?.headers as Record<string, string>;
assert.equal(headers.Authorization, `Basic ${Buffer.from("notion-id:notion-secret").toString("base64")}`);
assert.ok(headers["Notion-Version"]);
assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
  grant_type: "authorization_code",
  code: "c0de",
  redirect_uri: "https://zeno.example/api/connect/notion/callback",
});

const failed = "/connect/notion#error=failed";
for (const [query, email] of [
  [`code=c0de&state=${good}`, null],
  [`code=c0de&state=${good}`, "ana@school.edu"],
  [`code=c0de&state=${connectState("notion", "maya@school.edu", Date.now() - 11 * 60_000)}`, "maya@school.edu"],
  [`code=c0de&state=${connectState("slack", "maya@school.edu")}`, "maya@school.edu"],
  [`code=c0de`, "maya@school.edu"],
  [`state=${good}`, "maya@school.edu"],
] as const) {
  calls.length = 0;
  res = await finishConnect(NOTION_OAUTH, callback(query), origin, email);
  assert.equal(res.headers.get("location"), failed, `${query} as ${email}`);
  assert.equal(calls.length, 0, "no code is traded without a good state");
}
res = await finishConnect(NOTION_OAUTH, callback(`error=access_denied&state=${good}`), origin, "maya@school.edu");
assert.equal(res.headers.get("location"), "/connect/notion#error=denied", "the person said no");

// A refused code, an app error page and no network are all just failed, and nothing the app said is logged.
reply = () => Response.json({ error: "invalid_grant", error_description: "ntn_leaked" }, { status: 400 });
res = await finishConnect(NOTION_OAUTH, callback(`code=c0de&state=${good}`), origin, "maya@school.edu");
assert.equal(res.headers.get("location"), failed);
reply = () => {
  throw new TypeError("fetch failed ntn_leaked");
};
res = await finishConnect(NOTION_OAUTH, callback(`code=c0de&state=${good}`), origin, "maya@school.edu");
assert.equal(res.headers.get("location"), failed);
assert.deepEqual(errors, ["Notion connect failed"]);

// Without the keys the callback fails too.
delete process.env.NOTION_CLIENT_SECRET;
res = await finishConnect(NOTION_OAUTH, callback(`code=c0de&state=${good}`), origin, "maya@school.edu");
assert.equal(res.headers.get("location"), failed);

// ---- Slack's trade: oauth.v2.access with the client's keys, and the person's own user token from authed_user.
calls.length = 0;
reply = () => Response.json({ ok: true, access_token: "xoxb-bot", authed_user: { id: "U1", access_token: "xoxp-user-1" } });
const slackState = connectState("slack", "maya@school.edu");
res = await finishConnect(SLACK_OAUTH, new URL(`${origin}/api/connect/slack/callback?code=s1&state=${slackState}`), origin, "maya@school.edu");
assert.equal(res.headers.get("location"), "/connect/slack#token=xoxp-user-1", "the user token, never a bot token");
assert.equal(calls[0].url, "https://slack.com/api/oauth.v2.access");
assert.deepEqual(Object.fromEntries(calls[0].init?.body as URLSearchParams), {
  code: "s1",
  redirect_uri: "https://zeno.example/api/connect/slack/callback",
  client_id: "slack-id",
  client_secret: "slack-secret",
});
reply = () => Response.json({ ok: false, error: "invalid_code" });
res = await finishConnect(SLACK_OAUTH, new URL(`${origin}/api/connect/slack/callback?code=s1&state=${slackState}`), origin, "maya@school.edu");
assert.equal(res.headers.get("location"), "/connect/slack#error=failed");

console.log("connect-oauth self-check passed");
