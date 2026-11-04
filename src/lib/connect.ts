// Contract for the Nov 4 connectors round (Vi: "there's no connector for other apps yet").
// Apps bring work into Zeno: tasks, pages, messages that ask you something, and docs. They show in two places:
// "From your apps" when adding a goal (one tap makes an item a goal), and "For this goal" in the goal workspace.
// Like Canvas (src/lib/canvas-store.ts), each app's token stays in this browser, per account. The token leaves the
// browser only in the body of POST /api/connect/<app>, which uses it for that one request and never stores or logs it.
// OAuth apps (Notion, Slack, Google Docs) finish at /api/connect/<app>/callback, which hands the token to the page to keep.
// Tokens are cleared at Disconnect and at sign out (the sign-out regex in guided-day.tsx must match connectKey).
// Jira and Confluence share one Atlassian sign-in she pastes: { site, email, token } as JSON, kept under Jira's key.

export const APPS = ["notion", "gdocs", "slack", "linear", "trello", "jira", "confluence"] as const;
export type App = (typeof APPS)[number];

export const APP_NAMES: Record<App, string> = {
  notion: "Notion",
  gdocs: "Google Docs",
  slack: "Slack",
  linear: "Linear",
  trello: "Trello",
  jira: "Jira",
  confluence: "Confluence",
};

// One thing waiting in an app.
export type AppItem = {
  app: App;
  id: string; // the app's own id
  title: string; // at most 120 characters, as the app names it
  url: string; // opens it in the app
  kind: "task" | "page" | "message" | "doc";
  due: string | null; // YYYY-MM-DD in the person's time zone, or null
  detail: string | null; // at most 280 characters of plain text, cleaned like mail: no links, no long numbers
};

// The answer of POST /api/connect/<app> with { token }: the person's open items, soonest due first.
export type AppItemsResponse = { state: "ok"; items: AppItem[] } | { state: "no-access" | "error" };

// This browser's key for an app's token, per account. Confluence reads Jira's: one Atlassian sign-in serves both.
export const connectKey = (app: App, account: string) => `zeno.connect.${app === "confluence" ? "jira" : app}.${account}`;

// The only host Zeno fetches for Atlassian, "<name>.atlassian.net", from what she pasted ("https://acme.atlassian.net/jira/…"
// or "acme.atlassian.net"); null for anything else, so nothing is fetched.
export function atlassianSite(pasted: string): string | null {
  const host = /^(?:https?:\/\/)?([^/?#\s]+)(?:[/?#]|$)/i.exec(pasted.trim())?.[1]?.toLowerCase() ?? "";
  const name = /^([a-z0-9][a-z0-9-]{0,62})\.atlassian\.net$/.exec(host)?.[1];
  return name ? `${name}.atlassian.net` : null;
}
