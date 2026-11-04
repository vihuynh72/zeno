// This browser's side of the connectors (src/lib/connect.ts): each app's token under connectKey(app, account), the docs
// added to a goal under For this goal, and what the connected apps have waiting. Storage can be missing or throw
// (private windows, blocked site data): reads fall back to nothing, writes are skipped. Sign out clears zeno.connect.*.
import { APPS, connectKey, type App, type AppItem, type AppItemsResponse } from "@/lib/connect";

export const readToken = (app: App, account: string) => {
  try {
    return localStorage.getItem(connectKey(app, account));
  } catch {
    return null;
  }
};

export const saveToken = (app: App, account: string, token: string) => {
  try {
    localStorage.setItem(connectKey(app, account), token);
  } catch {
    // Nothing kept: Your apps offers Connect again.
  }
};

export const clearToken = (app: App, account: string) => {
  try {
    localStorage.removeItem(connectKey(app, account));
  } catch {
    // Unreadable storage holds nothing to clear.
  }
};

// One app read through POST /api/connect/<app>, the token in the body only.
export const readApp = (app: App, token: string): Promise<AppItemsResponse> =>
  fetch(`/api/connect/${app}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
    .then((response) => response.json() as Promise<AppItemsResponse>)
    .catch((): AppItemsResponse => ({ state: "error" }));

// Every connected app's items, read side by side. A token the app refuses now (Trello's ends after 30 days) is forgotten,
// so Your apps offers Connect again; one that failed for a moment stays. Jira decides for the Atlassian sign-in it shares
// with Confluence, so a site without Confluence keeps Jira.
export async function loadItems(account: string): Promise<AppItem[]> {
  const lists = await Promise.all(
    APPS.map(async (app) => {
      const token = readToken(app, account);
      if (!token) return [];
      const res = await readApp(app, token);
      if (res.state === "no-access" && app !== "confluence" && readToken(app, account) === token) clearToken(app, account);
      return res.state === "ok" && Array.isArray(res.items) ? res.items.filter((item) => item?.app === app && typeof item.title === "string") : [];
    }),
  );
  return lists.flat();
}

// ---------- Docs added under For this goal, per goal ----------

const docsKey = (account: string) => `zeno.connect.docs.${account}`;

function readDocs(account: string): Record<string, AppItem[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(docsKey(account)) ?? "{}") as Record<string, AppItem[]> | null;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export const goalDocs = (account: string, goalId: string): AppItem[] => {
  const docs = readDocs(account)[goalId];
  return Array.isArray(docs) ? docs : [];
};

// A doc once per goal; the newest first.
export function addGoalDoc(account: string, goalId: string, doc: AppItem) {
  const all = readDocs(account);
  all[goalId] = [doc, ...goalDocs(account, goalId).filter((one) => one.id !== doc.id)];
  try {
    localStorage.setItem(docsKey(account), JSON.stringify(all));
  } catch {
    // Not kept: it shows until the page reloads.
  }
}

// POST /api/connect/gdocs: a doc's link becomes its item, or a line saying why not.
export async function readDocLink(url: string): Promise<AppItem | string> {
  if (!/docs\.google\.com\/document\/(u\/\d+\/)?d\//.test(url)) return "Paste a Google Doc's link, like docs.google.com/document/d/…";
  const res = await fetch("/api/connect/gdocs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) })
    .then((response) => response.json() as Promise<AppItemsResponse>)
    .catch((): AppItemsResponse => ({ state: "error" }));
  if (res.state === "ok" && res.items[0]) return res.items[0];
  return res.state === "no-access" ? DOC_PRIVATE : "Couldn't open the doc. Try again.";
}

export const DOC_PRIVATE = "Zeno can't open it. Share it as 'Anyone with the link', then try again.";
