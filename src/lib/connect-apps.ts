// The Nov 4 connectors on the server (src/lib/connect.ts): Linear issues, Trello cards and Google Docs, read with the
// person's token or a shared link for one request. Tokens go only in request headers, never in a URL, log or error.
import type { AppItem, AppItemsResponse } from "@/lib/connect";
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
