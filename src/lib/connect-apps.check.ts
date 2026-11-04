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

// ---------- Jira and Confluence ----------
const { atlassianSite, connectKey } = await import("./connect.ts");
const { adfText, atlassianLogin, confluenceItems, jiraItems } = await import("./connect-apps.ts");
// Nothing logged at all while they run: no token, no email, no provider body.
const logged: string[] = [];
const consoles = (["log", "info", "warn", "error", "debug"] as const).map((level) => {
  const real = console[level];
  console[level] = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  return () => (console[level] = real);
});
// Every timeout asked for, in ms.
const timeouts: number[] = [];
const realTimeout = AbortSignal.timeout;
AbortSignal.timeout = (ms: number) => (timeouts.push(ms), realTimeout.call(AbortSignal, ms));

// The site guard: only "<name>.atlassian.net", from whatever she pasted; anything else is refused before any fetch.
for (const pasted of ["acme.atlassian.net", "https://acme.atlassian.net", "http://ACME.atlassian.net/", " https://acme.atlassian.net/jira/software/projects/ENG/boards/1?x=1 ", "acme.atlassian.net#top"]) {
  assert.equal(atlassianSite(pasted), "acme.atlassian.net", pasted);
}
for (const pasted of [
  "",
  "evil.com",
  "localhost",
  "169.254.169.254",
  "acme.jira.com",
  "atlassian.net",
  "acme.atlassian.net.evil.com",
  "acme.atlassian.net@evil.com",
  "acme.atlassian.net\\@evil.com",
  "user:pw@acme.atlassian.net",
  "evil.com/acme.atlassian.net",
  "evil.com#.atlassian.net",
  "evil.com?.atlassian.net",
  "a.b.atlassian.net",
  "-acme.atlassian.net",
  "acme_x.atlassian.net",
  "acme.atlassian.net:8443",
  "acme.atlassian.net.",
  "ftp://acme.atlassian.net",
  "javascript://acme.atlassian.net",
  `${"a".repeat(64)}.atlassian.net`,
]) {
  assert.equal(atlassianSite(pasted), null, `refused: ${pasted}`);
}
assert.equal(atlassianSite(`${"a".repeat(63)}.atlassian.net`), `${"a".repeat(63)}.atlassian.net`, "63 is the longest name");
assert.equal(connectKey("confluence", "me@x.com"), connectKey("jira", "me@x.com"), "one Atlassian sign-in on the device");

const SECRET = "ATATT3xFfGF0-secret-token-0123456789abcdef";
const BASIC = Buffer.from(`ana@acme.com:${SECRET}`).toString("base64");
const pasted = (over: Record<string, unknown> = {}) => JSON.stringify({ site: "https://acme.atlassian.net/jira/for-you", email: " ana@acme.com ", token: SECRET, ...over });
assert.deepEqual(atlassianLogin(pasted()), { site: "acme.atlassian.net", email: "ana@acme.com", token: SECRET });
for (const bad of [pasted({ site: "evil.com" }), pasted({ site: "acme.atlassian.net@evil.com" }), pasted({ site: 7 }), pasted({ email: "nope" }), pasted({ email: "a:b@acme.com" }), pasted({ token: "short" }), pasted({ token: "has space in it" }), "not json", "null", JSON.stringify(["x"]), null, 42, "x".repeat(2001)]) {
  assert.equal(atlassianLogin(bad), null, `refused: ${String(bad).slice(0, 60)}`);
}
const ana = atlassianLogin(pasted());
if (!ana) throw new Error("unreachable");

// Jira
assert.equal(adfText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }] }, { type: "paragraph", content: [{ type: "text", text: "c" }] }] }), "a\nb\nc");
seen = [];
answer = () =>
  Response.json({
    issues: [
      {
        id: "10001",
        key: "ENG-12",
        fields: {
          summary: "Fix login",
          duedate: "2026-11-06",
          status: { name: "In Progress" },
          description: {
            type: "doc",
            version: 1,
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Users can't sign in. Repro at " }, { type: "text", text: "https://example.com/x", marks: [{ type: "link" }] }] },
              { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Safari 17, code 12345678" }] }] }] },
            ],
          },
        },
      },
      { id: "10002", key: "ENG-3", fields: { summary: "Sooner", duedate: "2026-11-05", description: null } },
      { id: "10003", key: "MY_APP-7", fields: { summary: "  No date  ", duedate: null } },
      { id: "10004", key: "../evil", fields: { summary: "A key that isn't one" } },
      { id: "10005", key: "ENG-9", fields: { summary: " " } },
      { id: "10006", key: "ENG-10", fields: null },
      null,
    ],
  });
const jira = await jiraItems(ana);
assert.equal(jira.state, "ok");
if (jira.state !== "ok") throw new Error("unreachable");
assert.deepEqual(
  jira.items.map((item) => [item.title, item.url, item.due]),
  [
    ["ENG-3 Sooner", "https://acme.atlassian.net/browse/ENG-3", "2026-11-05"],
    ["ENG-12 Fix login", "https://acme.atlassian.net/browse/ENG-12", "2026-11-06"],
    ["MY_APP-7 No date", "https://acme.atlassian.net/browse/MY_APP-7", null],
  ],
  "'KEY-12 Summary', /browse/KEY-12 on her site, soonest due first; no key or no summary, no item",
);
const fix = jira.items[1];
assert.deepEqual([fix.app, fix.id, fix.kind], ["jira", "10001", "task"]);
assert.equal(fix.detail, "Users can't sign in. Repro at [link]\nSafari 17, code [number]", "the description's text, cleaned like mail");
assert.equal(jira.items[0].detail, null);
assert.equal(seen.length, 1);
const asked = new URL(seen[0].url);
assert.equal(asked.origin, "https://acme.atlassian.net", "only her site");
assert.equal(asked.pathname, "/rest/api/3/search/jql");
assert.equal(asked.searchParams.get("jql"), "assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC");
assert.equal(asked.searchParams.get("fields"), "summary,duedate,status,description");
assert.equal(asked.searchParams.get("maxResults"), "30");
assert.equal((seen[0].init?.headers as Record<string, string>).authorization, `Basic ${BASIC}`, "email:token in the header");
assert.equal(seen[0].init?.redirect, "error", "a redirect is never followed");
assert.ok(!seen[0].url.includes(SECRET) && !seen[0].url.includes("ana@") && !seen[0].url.includes(BASIC), "never in the URL");

for (const status of [401, 403]) {
  answer = () => new Response(JSON.stringify({ errorMessages: [`bad ${SECRET}`] }), { status });
  assert.deepEqual(await jiraItems(ana), { state: "no-access" }, String(status));
}
answer = () => Response.json({ issues: [] }, { headers: { "x-seraph-loginreason": "AUTHENTICATED_FAILED" } });
assert.deepEqual(await jiraItems(ana), { state: "no-access" }, "a sign-in Jira didn't take, answered anyway");
answer = () => new Response(`oops ${SECRET}`, { status: 500 });
assert.deepEqual(await jiraItems(ana), { state: "error" }, "the body is never echoed");
answer = () => new Response("<html>not json</html>");
assert.deepEqual(await jiraItems(ana), { state: "error" });
answer = () => Response.json({ errorMessages: ["no"] });
assert.deepEqual(await jiraItems(ana), { state: "error" }, "no issues list");
answer = () => Promise.reject(new TypeError("fetch failed: unexpected redirect"));
assert.deepEqual(await jiraItems(ana), { state: "error" }, "a redirect fails the read");
answer = () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"));
assert.deepEqual(await jiraItems(ana), { state: "error" }, "a timeout");

// Confluence: who she is, then her incomplete tasks
seen = [];
const tasks = [
  { globalId: 11, id: 1, contentId: 98317, status: "incomplete", title: "Launch plan", body: '<span class="placeholder-inline-tasks">Send the deck <time datetime="2026-11-07" /></span>', dueDate: Date.UTC(2026, 10, 7) },
  { globalId: 12, id: 2, contentId: "98318", title: "Retro", body: "Book the room", dueDate: Date.UTC(2026, 10, 6, 6) },
  { globalId: 13, id: 3, contentId: 98319, title: "Notes", body: "<span> </span>" },
  { globalId: 14, id: 4, contentId: 98320, title: "Ideas", description: "Read https://example.com/a and 1234567 notes" },
  { globalId: 15, id: 5, contentId: "../x", title: "Bad page", body: "Never shown" },
  { id: 6, contentId: 98321, title: "Long", body: "y".repeat(300) },
];
answer = () => (seen.length === 1 ? Response.json({ type: "known", accountId: "5b10:abc-1", displayName: "Ana" }) : Response.json({ results: tasks, start: 0, limit: 30, size: 6 }));
const wiki = await confluenceItems(ana, "America/Los_Angeles");
assert.equal(wiki.state, "ok");
if (wiki.state !== "ok") throw new Error("unreachable");
assert.deepEqual(
  wiki.items.map((item) => [item.id, item.title, item.url, item.due, item.detail]),
  [
    ["12", "Book the room", "https://acme.atlassian.net/wiki/pages/viewpage.action?pageId=98318", "2026-11-05", "Retro"],
    ["11", "Send the deck", "https://acme.atlassian.net/wiki/pages/viewpage.action?pageId=98317", "2026-11-07", "Launch plan"],
    ["14", "Read [link] and [number] notes", "https://acme.atlassian.net/wiki/pages/viewpage.action?pageId=98320", null, "Ideas"],
    ["6", "y".repeat(120), "https://acme.atlassian.net/wiki/pages/viewpage.action?pageId=98321", null, "Long"],
  ],
  "task text cleaned and cut to 120, the page's link, due on her day (6:00 UTC is the evening before in LA; a day alone stays that day), the page title as detail",
);
assert.deepEqual([wiki.items[0].app, wiki.items[0].kind], ["confluence", "task"]);
assert.equal(seen.length, 2);
assert.equal(seen[0].url, "https://acme.atlassian.net/wiki/rest/api/user/current");
const search = new URL(seen[1].url);
assert.equal(search.origin + search.pathname, "https://acme.atlassian.net/wiki/rest/api/inlinetasks/search");
assert.deepEqual(Object.fromEntries(search.searchParams), { assignee: "5b10:abc-1", status: "incomplete", limit: "30" });
for (const one of seen) {
  assert.equal((one.init?.headers as Record<string, string>).authorization, `Basic ${BASIC}`);
  assert.equal(one.init?.redirect, "error");
  assert.ok(!one.url.includes(SECRET), "never in the URL");
}

const confluence = async (first: () => Response | Promise<Response>, second: () => Response | Promise<Response>) => {
  seen = [];
  answer = () => (seen.length === 1 ? first() : second());
  return confluenceItems(ana, "UTC");
};
const me = () => Response.json({ type: "known", accountId: "5b10:abc-1" });
assert.deepEqual(await confluence(() => new Response(`no ${SECRET}`, { status: 401 }), me), { state: "no-access" }, "refused at who she is");
assert.equal(seen.length, 1, "no task search after a refusal");
assert.deepEqual(await confluence(() => Response.json({ type: "anonymous", displayName: "Anonymous" }), me), { state: "no-access" }, "the anonymous user");
assert.deepEqual(await confluence(me, () => new Response("{}", { status: 403 })), { state: "no-access" }, "refused at the tasks");
assert.deepEqual(await confluence(() => new Response(`down ${SECRET}`, { status: 502 }), me), { state: "error" });
assert.deepEqual(await confluence(me, () => Response.json({ message: "no results here" })), { state: "error" });
assert.deepEqual(await confluence(() => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")), me), { state: "error" }, "a timeout");

assert.ok(timeouts.length > 0 && timeouts.every((ms) => ms === 8_000), `8 s for every Atlassian read: ${timeouts}`);
AbortSignal.timeout = realTimeout;
for (const restore of consoles) restore();
assert.deepEqual(logged, [], "nothing logged: no token, email or provider body");

// ---------- connect-config ----------
assert.equal(configured("jira", {}), true, "Jira needs nothing");
assert.equal(configured("confluence", {}), true, "Confluence needs nothing");
assert.equal(configured("linear", {}), true, "Linear needs nothing");
assert.equal(configured("gdocs", {}), true, "Google Docs needs nothing");
assert.equal(configured("notion", { NOTION_CLIENT_ID: "a" }), false, "both halves of the client");
assert.equal(configured("notion", { NOTION_CLIENT_ID: "a", NOTION_CLIENT_SECRET: "b" }), true);
assert.equal(configured("slack", { SLACK_CLIENT_ID: "a", SLACK_CLIENT_SECRET: " " }), false, "a blank value is not set");
assert.equal(configured("trello", { NEXT_PUBLIC_TRELLO_KEY: "k" }), true);
assert.equal(configured("trello", {}), false);

console.log("connect-apps check passed");
