// Self-check for the Linear, Trello and Google Docs readers and connect-config, with a stubbed fetch (no network, no
// tokens): node src/lib/connect-apps.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { docLink, docTitle, linearItems, readDoc, trelloItems } = await import("./connect-apps.ts");
const { configured } = await import("./connect-config.ts");

// What the stub saw, and what it answers next.
let seen: { url: string; init?: RequestInit }[] = [];
let answer: () => Response | Promise<Response> = () => Response.json({});
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  seen.push({ url: String(url), init });
  return answer();
}) as typeof fetch;
const TOKEN = "lin_api_secret0123456789";

// ---------- Linear ----------
answer = () =>
  Response.json({
    data: {
      viewer: {
        assignedIssues: {
          nodes: [
            { id: "a", identifier: "ENG-7", title: "No date", description: null, url: "https://linear.app/x/issue/ENG-7", dueDate: null },
            {
              id: "b",
              identifier: "ENG-12",
              title: "Fix login",
              description: "Repro at https://example.com/login?token=abc and code 12345678.\n\n\n\nThanks!\nAna",
              url: "https://linear.app/x/issue/ENG-12",
              dueDate: "2026-11-06",
            },
            { id: "c", identifier: "ENG-3", title: "Sooner", description: "", url: "https://linear.app/x/issue/ENG-3", dueDate: "2026-11-05" },
            { id: "d", identifier: "ENG-4", title: "Bad link", url: "javascript:alert(1)", dueDate: "2026-11-01" },
          ],
        },
      },
    },
  });
const linear = await linearItems(TOKEN);
assert.equal(linear.state, "ok");
if (linear.state !== "ok") throw new Error("unreachable");
assert.deepEqual(
  linear.items.map((item) => [item.title, item.due]),
  [
    ["ENG-3 Sooner", "2026-11-05"],
    ["ENG-12 Fix login", "2026-11-06"],
    ["ENG-7 No date", null],
  ],
  "soonest due first, undated last, a non-https link dropped, the title is 'ENG-12 Fix login'",
);
const login = linear.items[1];
assert.equal(login.kind, "task");
assert.equal(login.app, "linear");
assert.ok(login.detail && !login.detail.includes("https://") && !login.detail.includes("12345678"), `cleaned like mail: ${login.detail}`);
assert.equal(linear.items[0].detail, null, "an empty description is no detail");
assert.equal(seen[0].url, "https://api.linear.app/graphql");
assert.equal((seen[0].init?.headers as Record<string, string>).authorization, TOKEN, "the key rides in the header");
assert.match(JSON.parse(String(seen[0].init?.body)).query, /nin: \["completed", "canceled"\]/, "completed and canceled issues are left out");
assert.ok(!seen[0].url.includes(TOKEN), "never in the URL");

answer = () => Response.json({ errors: [{ message: "Authentication required", extensions: { code: "AUTHENTICATION_ERROR" } }] }, { status: 400 });
assert.deepEqual(await linearItems(TOKEN), { state: "no-access" }, "a refused key");
answer = () => new Response("oops", { status: 500 });
assert.deepEqual(await linearItems(TOKEN), { state: "error" });
answer = () => Promise.reject(new Error("offline"));
assert.deepEqual(await linearItems(TOKEN), { state: "error" }, "network trouble");
const long = "x".repeat(200);
answer = () => Response.json({ data: { viewer: { assignedIssues: { nodes: [{ id: "e", identifier: "ENG-1", title: long, description: long.repeat(3), url: "https://linear.app/e" }] } } } });
const cut = await linearItems(TOKEN);
assert.ok(cut.state === "ok" && cut.items[0].title.length === 120 && (cut.items[0].detail?.length ?? 0) <= 280, "titles 120, details 280 at most");

// ---------- Trello ----------
seen = [];
answer = () =>
  Response.json([
    { id: "t1", name: "Write the brief", desc: "See https://trello.com/c/abc", due: "2026-11-07T06:30:00.000Z", dueComplete: false, url: "https://trello.com/c/t1" },
    { id: "t2", name: "Done one", due: "2026-11-05T17:00:00.000Z", dueComplete: true, url: "https://trello.com/c/t2" },
    { id: "t3", name: "  No due  ", desc: "", due: null, url: "https://trello.com/c/t3" },
    { id: "t4", name: "Soon", due: "2026-11-05T20:00:00.000Z", url: "https://trello.com/c/t4" },
  ]);
const trello = await trelloItems("trellotoken0123456789abcdef0123456789", "pubkey", "America/Los_Angeles");
assert.equal(trello.state, "ok");
if (trello.state !== "ok") throw new Error("unreachable");
assert.deepEqual(
  trello.items.map((item) => [item.id, item.title, item.due]),
  [
    ["t4", "Soon", "2026-11-05"],
    ["t1", "Write the brief", "2026-11-06"],
    ["t3", "No due", null],
  ],
  "complete cards drop out; due dates are her own day (6:30 UTC is the evening before in LA)",
);
assert.ok(seen[0].url.startsWith("https://api.trello.com/1/members/me/cards?filter=open"), seen[0].url);
assert.ok(!seen[0].url.includes("trellotoken"), "the token never rides in the URL");
assert.match((seen[0].init?.headers as Record<string, string>).authorization, /^OAuth oauth_consumer_key="pubkey", oauth_token="trellotoken/);
answer = () => new Response("invalid token", { status: 401 });
assert.deepEqual(await trelloItems("x".repeat(40), "pubkey", "UTC"), { state: "no-access" }, "an expired token");
answer = () => Response.json({ not: "a list" });
assert.deepEqual(await trelloItems("x".repeat(40), "pubkey", "UTC"), { state: "error" });

// ---------- Google Docs ----------
const id = "195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE";
assert.deepEqual(docLink(`Plan this https://docs.google.com/document/d/${id}/edit?usp=sharing please`), { link: `https://docs.google.com/document/d/${id}/edit?usp=sharing`, id });
assert.equal(docLink(`https://docs.google.com/document/u/1/d/${id}/edit`)?.id, id, "a second Google account's link");
assert.equal(docLink("https://docs.google.com/spreadsheets/d/abc/edit"), null, "a sheet is not a doc");
assert.equal(docTitle(`attachment; filename="DocsAPIQuickstart.txt"; filename*=UTF-8''Docs%20API%20Quickstart.txt`), "Docs API Quickstart");
assert.equal(docTitle(`attachment; filename="Essay plan.txt"`), "Essay plan");
assert.equal(docTitle(null), "Google Doc");

seen = [];
answer = () =>
  new Response(`﻿Essay plan\nDraft by Friday. Sources: https://example.com/x\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="Essay.txt"; filename*=UTF-8''Essay%20plan.txt` },
  });
const doc = await readDoc(id);
assert.equal(seen[0].url, `https://docs.google.com/document/d/${id}/export?format=txt`);
assert.equal(doc.state, "ok");
if (doc.state !== "ok") throw new Error("unreachable");
assert.equal(doc.title, "Essay plan");
assert.equal(doc.url, `https://docs.google.com/document/d/${id}/edit`);
assert.ok(doc.text.startsWith("Essay plan") && !doc.text.includes("https://"), `no BOM, no links: ${doc.text}`);
answer = () => new Response("x".repeat(9000), { headers: { "content-type": "text/plain" } });
const big = await readDoc(id);
assert.ok(big.state === "ok" && big.text.length === 6000, "up to 6000 characters");

// A private doc ends at Google's sign-in page (HTML) after the redirect, or a 401/403/404.
answer = () => new Response("<html>Sign in</html>", { headers: { "content-type": "text/html; charset=utf-8" } });
assert.deepEqual(await readDoc(id), { state: "private" }, "the sign-in page");
for (const status of [401, 403, 404]) {
  answer = () => new Response("<html></html>", { status, headers: { "content-type": "text/html" } });
  assert.deepEqual(await readDoc(id), { state: "private" }, String(status));
}
answer = () => new Response("busy", { status: 503, headers: { "content-type": "text/html" } });
assert.deepEqual(await readDoc(id), { state: "error" });

// ---------- connect-config ----------
assert.equal(configured("linear", {}), true, "Linear needs nothing");
assert.equal(configured("gdocs", {}), true, "Google Docs needs nothing");
assert.equal(configured("notion", { NOTION_CLIENT_ID: "a" }), false, "both halves of the client");
assert.equal(configured("notion", { NOTION_CLIENT_ID: "a", NOTION_CLIENT_SECRET: "b" }), true);
assert.equal(configured("slack", { SLACK_CLIENT_ID: "a", SLACK_CLIENT_SECRET: " " }), false, "a blank value is not set");
assert.equal(configured("trello", { NEXT_PUBLIC_TRELLO_KEY: "k" }), true);
assert.equal(configured("trello", {}), false);

console.log("connect-apps check passed");
