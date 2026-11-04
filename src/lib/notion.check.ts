// Self-check for notion.ts with Notion stubbed (no network): node src/lib/notion.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// notion.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { notionItems } = await import("./notion.ts");
const logs: string[] = [];
console.error = (...args: unknown[]) => void logs.push(args.join(" "));

// Wednesday Nov 4, 9 PM in Los Angeles, already Nov 5 in UTC.
const now = new Date("2026-11-05T05:00:00Z");
const LA = "America/Los_Angeles";
const edited = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const rich = (text: string) => [{ plain_text: text }];
const row = (id: string, title: string, props: object, extra: object = {}) => ({
  object: "page",
  id,
  url: `https://www.notion.so/${id}`,
  last_edited_time: edited(1),
  archived: false,
  in_trash: false,
  parent: { type: "database_id", database_id: "db-tasks" },
  properties: { Name: { type: "title", title: rich(title) }, ...props },
  ...extra,
});
const status = (name: string | null) => ({ type: "status", status: name ? { name } : null });
const date = (start: string, end: string | null = null) => ({ type: "date", date: { start, end } });
const page = (id: string, title: string, daysAgo: number) => ({
  object: "page",
  id,
  url: `https://www.notion.so/${id}`,
  last_edited_time: edited(daysAgo),
  parent: { type: "workspace", workspace: true },
  properties: { title: { type: "title", title: rich(title) } },
});

const results = [
  row("t-later", "Write lab report", { Due: date("2026-11-12"), Status: status("In progress") }),
  row("t-today", "  Email   the TA ", { Due: date("2026-11-04"), Status: status("Not started") }),
  row("t-time", "Club budget", { Deadline: date("2026-11-06T07:30:00.000Z"), Done: { type: "checkbox", checkbox: false } }),
  row("t-none", "Pick a topic", { Due: date("2026-11-09"), Status: status(null) }),
  row("t-range", "Reading week", { When: date("2026-11-01", "2026-11-07"), Status: { type: "select", select: { name: "Doing" } } }),
  row("done", "Old essay", { Due: date("2026-11-20"), Status: status("Done") }),
  row("ticked", "Buy books", { Due: date("2026-11-20"), Done: { type: "checkbox", checkbox: true } }),
  row("selected", "Old lab", { Due: date("2026-11-20"), Status: { type: "select", select: { name: "Completed" } } }),
  row("late", "Overdue quiz prep", { Due: date("2026-11-03"), Status: status("Not started") }),
  row("no-status", "Movie night", { Date: date("2026-11-08") }, { parent: { type: "database_id", database_id: "db-events" } }),
  row("trashed", "Gone", { Due: date("2026-11-20"), Status: status("Not started") }, { in_trash: true }),
  row("bad-url", "Odd", { Due: date("2026-11-20"), Status: status("Not started") }, { url: "javascript:alert(1)" }),
  { object: "database", id: "db-tasks", title: rich("Tasks") },
  page("p-untitled", "", 1),
  page("p-long", "x".repeat(200), 2),
  ...Array.from({ length: 9 }, (_, i) => page(`p-${i}`, `Notes ${i}`, 3 + i)),
  page("p-old", "Last term", 31),
];

let calls: { url: string; init?: RequestInit }[] = [];
let search = () => Response.json({ object: "list", results });
const databases: Record<string, () => Response> = {
  "db-tasks": () => Response.json({ object: "database", id: "db-tasks", title: rich("Tasks") }),
  "db-events": () => Response.json({ object: "error", status: 404 }, { status: 404 }),
};
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  calls.push({ url, init });
  if (url === "https://api.notion.com/v1/search") return search();
  return databases[url.split("/").pop() ?? ""]();
}) as typeof fetch;

const answer = await notionItems("ntn_token", LA, now);
assert.equal(answer.state, "ok");
const items = answer.state === "ok" ? answer.items : [];

// One search: pages only, newest edits first, 30 of them, with the token and a pinned version.
assert.equal(calls[0].url, "https://api.notion.com/v1/search");
assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
  filter: { property: "object", value: "page" },
  sort: { direction: "descending", timestamp: "last_edited_time" },
  page_size: 30,
});
const headers = calls[0].init?.headers as Record<string, string>;
assert.equal(headers.Authorization, "Bearer ntn_token");
assert.equal(headers["Notion-Version"], "2022-06-28");
assert.ok(calls[0].init?.signal, "an 8 s timeout");

// Tasks: rows due today or later (in the person's zone) that aren't done, soonest first, with their database's name.
const tasks = items.filter((item) => item.kind === "task");
assert.deepEqual(
  tasks.map(({ id, title, due }) => [id, title, due]),
  [
    ["t-today", "Email the TA", "2026-11-04"],
    ["t-time", "Club budget", "2026-11-05"],
    ["t-range", "Reading week", "2026-11-07"],
    ["t-none", "Pick a topic", "2026-11-09"],
    ["t-later", "Write lab report", "2026-11-12"],
  ],
  "a time is read in the person's zone, a range is due on its last day, and no status chosen is not done",
);
assert.deepEqual(tasks[0], {
  app: "notion",
  id: "t-today",
  title: "Email the TA",
  url: "https://www.notion.so/t-today",
  kind: "task",
  due: "2026-11-04",
  detail: "Tasks",
});

// Pages: the rest edited in the last 30 days, newest first, at most 8, without a due date. A late row and a dated row
// without a status are pages; done, ticked, trashed and untitled ones never show.
const pages = items.filter((item) => item.kind === "page");
assert.deepEqual(
  pages.map((item) => item.id),
  ["late", "no-status", "p-long", "p-0", "p-1", "p-2", "p-3", "p-4"],
);
assert.equal(pages[0].detail, "Tasks");
assert.equal(pages[1].detail, null, "a database that can't be read leaves the detail out");
assert.equal(pages[2].title, "x".repeat(120), "titles are at most 120 characters");
assert.equal(pages[2].detail, null, "a top-level page has no database");
assert.ok(items.every((item) => item.due === null || /^\d{4}-\d{2}-\d{2}$/.test(item.due)));
assert.equal(items.length, 13);

// Each database is looked up once.
assert.deepEqual(calls.slice(1).map((call) => call.url).sort(), ["https://api.notion.com/v1/databases/db-events", "https://api.notion.com/v1/databases/db-tasks"]);

// A token Notion refuses is no-access; any other trouble is error, and nothing Notion said reaches the answer.
search = () => Response.json({ object: "error", status: 401, code: "unauthorized", message: "API token is invalid." }, { status: 401 });
assert.deepEqual(await notionItems("ntn_token", LA, now), { state: "no-access" });
search = () => Response.json({ object: "error", status: 429, code: "rate_limited" }, { status: 429 });
assert.deepEqual(await notionItems("ntn_token", LA, now), { state: "error" });
search = () => new Response("<html>bad gateway</html>", { status: 200 });
assert.deepEqual(await notionItems("ntn_token", LA, now), { state: "error" });
search = () => {
  throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
};
assert.deepEqual(await notionItems("ntn_token", LA, now), { state: "error" });

// Nothing edited lately is an empty list.
calls = [];
search = () => Response.json({ object: "list", results: [] });
assert.deepEqual(await notionItems("ntn_token", LA, now), { state: "ok", items: [] });
assert.equal(calls.length, 1);

// Failures are logged for the server's logs, never with the token.
assert.ok(logs.length > 0 && logs.every((line) => !line.includes("ntn_token")), logs.join("\n"));

console.log("notion self-check passed");
