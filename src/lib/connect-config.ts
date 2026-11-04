import type { App } from "@/lib/connect";

// Which apps this deployment can connect (Nov 4): an OAuth app needs its client's env set, Trello its public key. Only
// whether they exist, never their values. Linear, Jira and Confluence (a pasted key) and Google Docs (a shared link)
// need nothing.
const NEEDS: Record<App, string[]> = {
  notion: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"],
  slack: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
  trello: ["NEXT_PUBLIC_TRELLO_KEY"],
  linear: [],
  gdocs: [],
  jira: [],
  confluence: [],
};

export const configured = (app: App, env: Record<string, string | undefined> = process.env) => NEEDS[app].every((name) => Boolean(env[name]?.trim()));

// GET /api/connect/status: { notion: false, linear: true, … }.
export type ConnectStatus = Record<App, boolean>;
