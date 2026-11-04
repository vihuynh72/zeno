import type { AppItem, AppItemsResponse } from "@/lib/connect";
import type { OAuthApp } from "@/lib/connect-oauth";
import { localDate } from "@/lib/tz";

// Notion (https://developers.notion.com), a public integration the person signs in to; its token comes from this browser
// for one request and is never stored or logged.

const NOTION = "https://api.notion.com/v1";
// shortcut: the version before data sources (2025-09-03); a database with several data sources can't be read with it,
// so its name is left out. Move to data sources if a person's tasks live in one.
const VERSION = "2022-06-28";
const DAY = 86_400_000;

// shortcut: the access token is kept as if it never expires; if Notion starts expiring tokens, keep the refresh token too.
export const NOTION_OAUTH: OAuthApp = {
  app: "notion",
  authorize: (clientId, redirectUri, state) =>
    `${NOTION}/oauth/authorize?${new URLSearchParams({ client_id: clientId, response_type: "code", owner: "user", redirect_uri: redirectUri, state })}`,
  exchange: async (code, redirectUri, clientId, secret) => {
    const response = await fetch(`${NOTION}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
        "Notion-Version": VERSION,
      },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(8000),
    });
    const body = response.ok ? await response.json() : null;
    return typeof body?.access_token === "string" ? body.access_token : null;
  },
};

type Property = {
  type?: string;
  title?: unknown;
  date?: { start?: unknown; end?: unknown } | null;
  status?: { name?: unknown } | null;
  select?: { name?: unknown } | null;
  checkbox?: unknown;
};
type Page = {
  object?: string;
  id?: unknown;
  url?: unknown;
  last_edited_time?: unknown;
  archived?: boolean;
  in_trash?: boolean;
  parent?: { type?: string; database_id?: unknown };
  properties?: Record<string, Property>;
};

const call = (path: string, token: string, body?: object) =>
  fetch(`${NOTION}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

// Rich text as one plain line of at most max characters.
const plain = (rich: unknown, max: number) =>
  [...(Array.isArray(rich) ? rich.map((part) => (typeof part?.plain_text === "string" ? part.plain_text : "")).join("") : "").replace(/\s+/g, " ").trim()]
    .slice(0, max)
    .join("");

const DONE = /\b(done|complete|completed|finished|closed|shipped|resolved|canceled|cancelled|archived)\b/i;

// A row's due date: its date property named like Due or Deadline, else its first, as YYYY-MM-DD in the person's zone (a
// range is due on its last day); null without one.
function dueOf(props: [string, Property][], timeZone: string): string | null {
  const dates = props.filter(([, prop]) => prop.type === "date" && typeof prop.date?.start === "string");
  const date = (dates.find(([name]) => /due|deadline/i.test(name)) ?? dates[0])?.[1].date;
  const value = typeof date?.end === "string" ? date.end : date?.start;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(Date.parse(value))) return null;
  return value.length > 10 ? localDate(timeZone, new Date(value)) : value;
}

// true or false from a Status (or a select named like Status) or else a checkbox; null when the row has neither.
function doneOf(props: [string, Property][]): boolean | null {
  const status = props.find(([name, prop]) => prop.type === "status" || (prop.type === "select" && /status/i.test(name)))?.[1];
  if (status) return DONE.test(String((status.status ?? status.select)?.name ?? ""));
  const box = props.find(([, prop]) => prop.type === "checkbox")?.[1];
  return box ? box.checkbox === true : null;
}

async function databaseName(id: string, token: string): Promise<string | null> {
  const response = await call(`/databases/${encodeURIComponent(id)}`, token).catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  return plain(body?.title, 80) || null;
}

// The 30 pages edited last: database rows due today or later that aren't done (tasks, soonest first), then up to 8 other
// pages edited in the last 30 days. Done rows never show. 401 is no-access; anything else that fails is error.
export async function notionItems(token: string, timeZone: string, now = new Date()): Promise<AppItemsResponse> {
  try {
    const response = await call("/search", token, {
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: 30,
    });
    if (response.status === 401) return { state: "no-access" };
    if (!response.ok) {
      // The status only: Notion's error body is never logged or passed on.
      console.error("Notion search failed:", response.status);
      return { state: "error" };
    }
    const { results } = (await response.json()) as { results?: Page[] };
    const today = localDate(timeZone, now);
    const tasks: { page: Page; item: AppItem }[] = [];
    const pages: typeof tasks = [];
    for (const page of Array.isArray(results) ? results : []) {
      if (page?.object !== "page" || page.archived || page.in_trash || typeof page.id !== "string") continue;
      if (typeof page.url !== "string" || !page.url.startsWith("https://")) continue;
      const props = Object.entries(page.properties ?? {});
      const title = plain(props.find(([, prop]) => prop.type === "title")?.[1].title, 120);
      const due = dueOf(props, timeZone);
      const done = doneOf(props);
      if (!title || done === true) continue;
      const item: AppItem = { app: "notion", id: page.id, title, url: page.url, kind: "page", due: null, detail: null };
      if (page.parent?.type === "database_id" && due && due >= today && done === false) tasks.push({ page, item: { ...item, kind: "task", due } });
      else if (typeof page.last_edited_time === "string" && Date.parse(page.last_edited_time) >= now.getTime() - 30 * DAY) pages.push({ page, item });
    }
    const kept = [...tasks.sort((a, b) => String(a.item.due).localeCompare(String(b.item.due))), ...pages.slice(0, 8)];
    // The detail line is the row's database name: at most 5 lookups (Notion allows about 3 requests a second), and a
    // database that can't be read leaves it null.
    const ids = [...new Set(kept.map(({ page }) => page.parent?.database_id).filter((id): id is string => typeof id === "string"))].slice(0, 5);
    const names = new Map(await Promise.all(ids.map(async (id) => [id, await databaseName(id, token)] as const)));
    return { state: "ok", items: kept.map(({ page, item }) => ({ ...item, detail: names.get(String(page.parent?.database_id)) ?? null })) };
  } catch (error) {
    console.error("Notion read failed:", error instanceof Error ? error.name : "unknown");
    return { state: "error" };
  }
}
