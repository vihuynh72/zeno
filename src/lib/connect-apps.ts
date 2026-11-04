// The Nov 4 connectors on the server (src/lib/connect.ts): Linear issues, Trello cards, Google Docs, Jira issues and
// Confluence tasks, read with the person's token or a shared link for one request. Tokens go only in request headers,
// never in a URL, log or error.
import { atlassianSite, type AppItem, type AppItemsResponse } from "@/lib/connect";
import { cleanBody } from "@/lib/gmail";
import { localDate } from "@/lib/tz";

const TIMEOUT = 10_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const httpsUrl = (value: unknown) => (typeof value === "string" && value.startsWith("https://") ? value : null);
const detailOf = (text: unknown) => (typeof text === "string" && text.trim() ? cleanBody(text, false, 280) || null : null);

// Soonest due first, undated last; ties keep the app's order.
export const soonest = (items: AppItem[]) => [...items].sort((a, b) => Number(!a.due) - Number(!b.due) || (a.due ?? "").localeCompare(b.due ?? ""));

// ---------- Linear: a personal API key ----------

const LINEAR_QUERY = `query {
  viewer {
    assignedIssues(first: 50, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
      nodes { id identifier title description url dueDate }
    }
  }
}`;

type LinearIssue = { id?: unknown; identifier?: unknown; title?: unknown; description?: unknown; url?: unknown; dueDate?: unknown };

export function linearItem(issue: LinearIssue): AppItem[] {
  const url = httpsUrl(issue.url);
  if (typeof issue.id !== "string" || typeof issue.title !== "string" || !url) return [];
  const title = [issue.identifier, issue.title].filter((part) => typeof part === "string" && part.trim()).join(" ");
  return [
    {
      app: "linear",
      id: issue.id,
      title: title.slice(0, 120),
      url,
      kind: "task",
      due: typeof issue.dueDate === "string" && DAY.test(issue.dueDate) ? issue.dueDate : null,
      detail: detailOf(issue.description),
    },
  ];
}

// The viewer's issues that are not completed or canceled. A key Linear refuses is no-access.
export async function linearItems(token: string): Promise<AppItemsResponse> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token },
    body: JSON.stringify({ query: LINEAR_QUERY }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!res) return { state: "error" };
  const body = (await res.json().catch(() => null)) as {
    data?: { viewer?: { assignedIssues?: { nodes?: unknown } } };
    errors?: { extensions?: { code?: unknown; type?: unknown } }[];
  } | null;
  // Linear answers a bad key with 400 and an authentication error.
  const refused = body?.errors?.some((error) => /auth/i.test(`${error?.extensions?.code ?? ""} ${error?.extensions?.type ?? ""}`));
  if (res.status === 401 || res.status === 403 || refused) return { state: "no-access" };
  const nodes = body?.data?.viewer?.assignedIssues?.nodes;
  if (!res.ok || !Array.isArray(nodes)) return { state: "error" };
  return { state: "ok", items: soonest(nodes.flatMap((issue: LinearIssue) => linearItem(issue ?? {}))) };
}

// ---------- Trello: a read token from Trello's authorize page ----------

type TrelloCard = { id?: unknown; name?: unknown; desc?: unknown; due?: unknown; dueComplete?: unknown; url?: unknown };

export function trelloItem(card: TrelloCard, timeZone: string): AppItem[] {
  const url = httpsUrl(card.url);
  if (typeof card.id !== "string" || typeof card.name !== "string" || !card.name.trim() || !url || card.dueComplete === true) return [];
  const due = typeof card.due === "string" && !Number.isNaN(Date.parse(card.due)) ? localDate(timeZone, new Date(card.due)) : null;
  return [{ app: "trello", id: card.id, title: card.name.trim().slice(0, 120), url, kind: "task", due, detail: detailOf(card.desc) }];
}

// Open cards the person is a member of, due dates in their zone; a card marked complete is done.
export async function trelloItems(token: string, key: string, timeZone: string): Promise<AppItemsResponse> {
  const res = await fetch("https://api.trello.com/1/members/me/cards?filter=open&fields=name,desc,due,dueComplete,url", {
    headers: { authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${token}"` },
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!res) return { state: "error" };
  if (res.status === 401 || res.status === 403) return { state: "no-access" };
  const cards = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(cards)) return { state: "error" };
  return { state: "ok", items: soonest(cards.flatMap((card: TrelloCard) => trelloItem(card ?? {}, timeZone))) };
}

// ---------- Google Docs: a link shared "Anyone with the link", no Google setup ----------

const DOC_LINK = /https?:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})[^\s]*/;
export const docLink = (text: string) => {
  const found = DOC_LINK.exec(text);
  return found ? { link: found[0], id: found[1] } : null;
};
export const docUrl = (id: string) => `https://docs.google.com/document/d/${id}/edit`;

export type DocRead = { state: "ok"; title: string; text: string; url: string } | { state: "private" | "error" };

// The doc's name from the export's file name: filename*=UTF-8''My%20Plan.txt, else filename="My Plan.txt".
export function docTitle(disposition: string | null): string {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? "")?.[1];
  let name = /filename="([^"]+)"/i.exec(disposition ?? "")?.[1] ?? "";
  try {
    if (encoded) name = decodeURIComponent(encoded);
  } catch {
    // A broken name keeps the plain one.
  }
  return name.replace(/\.txt$/i, "").trim().slice(0, 120) || "Google Doc";
}

// The doc as plain text, its first `max` characters cleaned like mail. A doc not shared by link ends at Google's sign-in
// page (HTML, not text) or a 401/403/404: private.
export async function readDoc(id: string, max = 6000): Promise<DocRead> {
  const res = await fetch(`https://docs.google.com/document/d/${id}/export?format=txt`, { signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null);
  if (!res) return { state: "error" };
  const text = res.headers.get("content-type")?.startsWith("text/plain") ? await res.text().catch(() => null) : null;
  if ([401, 403, 404].includes(res.status) || (res.ok && text === null)) return { state: "private" };
  if (!res.ok || text === null) return { state: "error" };
  return { state: "ok", title: docTitle(res.headers.get("content-disposition")), text: cleanBody(text.replace(/^﻿/, ""), false, max), url: docUrl(id) };
}

// ---------- Jira and Confluence: an Atlassian API token, her email and her own <name>.atlassian.net ----------

export type AtlassianLogin = { site: string; email: string; token: string };

// The pasted sign-in (JSON { site, email, token }) with its site cut down to "<name>.atlassian.net"; null for anything
// else, before any fetch.
export function atlassianLogin(json: unknown): AtlassianLogin | null {
  let raw: { site?: unknown; email?: unknown; token?: unknown } | null = null;
  try {
    raw = typeof json === "string" && json.length <= 2000 ? JSON.parse(json) : null;
  } catch {
    return null;
  }
  const site = typeof raw?.site === "string" ? atlassianSite(raw.site) : null;
  const email = typeof raw?.email === "string" ? raw.email.trim() : "";
  const token = typeof raw?.token === "string" ? raw.token.trim() : "";
  if (!site || !/^[^\s@:]{1,200}@[^\s@:]{1,200}$/.test(email) || !/^[\x21-\x7e]{8,600}$/.test(token)) return null;
  return { site, email, token };
}

// One GET on her site: Basic auth in the header, 8 s at most, and never a redirect (one could lead off her site).
// Refused is 401/403, or Atlassian saying the sign-in failed while it still answers.
async function atlassianGet(login: AtlassianLogin, path: string): Promise<{ refused: boolean; body: unknown } | null> {
  const res = await fetch(`https://${login.site}${path}`, {
    headers: { authorization: `Basic ${Buffer.from(`${login.email}:${login.token}`).toString("base64")}`, accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!res) return null;
  const refused = res.status === 401 || res.status === 403 || /AUTHENTICAT/i.test(res.headers.get("x-seraph-loginreason") ?? "");
  const body = res.ok && !refused ? await res.json().catch(() => null) : null;
  return refused || body ? { refused, body } : null;
}

// Jira's description is a tree (Atlassian Document Format): its text, a line per block.
export function adfText(node: unknown): string {
  if (!node || typeof node !== "object") return typeof node === "string" ? node : "";
  const { type, text, content } = node as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof text === "string") return text;
  if (type === "hardBreak") return "\n";
  return Array.isArray(content) ? content.map(adfText).join(type === "paragraph" || type === "heading" ? "" : "\n") : "";
}

type JiraIssue = { id?: unknown; key?: unknown; fields?: { summary?: unknown; duedate?: unknown; description?: unknown } | null };

export function jiraItem(issue: JiraIssue, site: string): AppItem[] {
  const key = typeof issue.key === "string" && /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(issue.key) ? issue.key : null;
  const summary = typeof issue.fields?.summary === "string" ? issue.fields.summary.trim() : "";
  if (!key || !summary) return [];
  const due = issue.fields?.duedate;
  return [
    {
      app: "jira",
      id: typeof issue.id === "string" ? issue.id : key,
      title: `${key} ${summary}`.slice(0, 120),
      url: `https://${site}/browse/${key}`,
      kind: "task",
      due: typeof due === "string" && DAY.test(due) ? due : null,
      detail: detailOf(adfText(issue.fields?.description)),
    },
  ];
}

const JQL = "assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC";

// Her open Jira issues, soonest due first.
export async function jiraItems(login: AtlassianLogin): Promise<AppItemsResponse> {
  const query = new URLSearchParams({ jql: JQL, fields: "summary,duedate,status,description", maxResults: "30" });
  const res = await atlassianGet(login, `/rest/api/3/search/jql?${query}`);
  if (res?.refused) return { state: "no-access" };
  const issues = (res?.body as { issues?: unknown } | null | undefined)?.issues;
  if (!Array.isArray(issues)) return { state: "error" };
  return { state: "ok", items: soonest(issues.flatMap((issue: JiraIssue) => jiraItem(issue ?? {}, login.site))) };
}

type ConfluenceTask = { globalId?: unknown; id?: unknown; contentId?: unknown; body?: unknown; description?: unknown; title?: unknown; dueDate?: unknown };

export function confluenceItem(task: ConfluenceTask, site: string, timeZone: string): AppItem[] {
  const id = [task.globalId, task.id].find((one) => typeof one === "number" || (typeof one === "string" && one !== ""));
  const page = typeof task.contentId === "number" || (typeof task.contentId === "string" && /^\d+$/.test(task.contentId)) ? task.contentId : null;
  const text = typeof task.body === "string" ? task.body : typeof task.description === "string" ? task.description : "";
  const title = cleanBody(text, true, 400).replace(/\s+/g, " ").trim().slice(0, 120);
  if (id === undefined || page === null || !title) return [];
  const at = typeof task.dueDate === "number" ? task.dueDate : typeof task.dueDate === "string" ? Date.parse(task.dueDate) : NaN;
  // A due day alone comes as midnight UTC: that day, wherever she is.
  const due = Number.isFinite(at) ? (at % 86_400_000 === 0 ? new Date(at).toISOString().slice(0, 10) : localDate(timeZone, new Date(at))) : null;
  return [{ app: "confluence", id: String(id), title, url: `https://${site}/wiki/pages/viewpage.action?pageId=${page}`, kind: "task", due, detail: detailOf(task.title) }];
}

// Her open Confluence tasks, soonest due first: who she is, then the tasks assigned to her.
export async function confluenceItems(login: AtlassianLogin, timeZone: string): Promise<AppItemsResponse> {
  const me = await atlassianGet(login, "/wiki/rest/api/user/current");
  if (me?.refused) return { state: "no-access" };
  const user = me?.body as { accountId?: unknown; type?: unknown } | null | undefined;
  if (!user) return { state: "error" };
  // Confluence answers a sign-in it doesn't know as the anonymous user.
  if (typeof user.accountId !== "string" || !user.accountId || user.type === "anonymous") return { state: "no-access" };
  const query = new URLSearchParams({ assignee: user.accountId, status: "incomplete", limit: "30" });
  const res = await atlassianGet(login, `/wiki/rest/api/inlinetasks/search?${query}`);
  if (res?.refused) return { state: "no-access" };
  const tasks = (res?.body as { results?: unknown } | null | undefined)?.results;
  if (!Array.isArray(tasks)) return { state: "error" };
  return { state: "ok", items: soonest(tasks.flatMap((task: ConfluenceTask) => confluenceItem(task ?? {}, login.site, timeZone))) };
}
