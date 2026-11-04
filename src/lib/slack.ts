import type { AppItem, AppItemsResponse } from "@/lib/connect";
import type { OAuthApp } from "@/lib/connect-oauth";
import { cleanBody } from "@/lib/gmail";

// Slack (https://api.slack.com/methods), read with the person's own user token (search:read) for one request; the token
// comes from this browser and is never stored or logged. No model reads these messages here.

const SLACK = "https://slack.com";
const DAY = 86_400_000;

export const SLACK_OAUTH: OAuthApp = {
  app: "slack",
  authorize: (clientId, redirectUri, state) =>
    `${SLACK}/oauth/v2/authorize?${new URLSearchParams({ client_id: clientId, user_scope: "search:read", redirect_uri: redirectUri, state })}`,
  exchange: async (code, redirectUri, clientId, secret) => {
    const response = await fetch(`${SLACK}/api/oauth.v2.access`, {
      method: "POST",
      body: new URLSearchParams({ code, redirect_uri: redirectUri, client_id: clientId, client_secret: secret }),
      signal: AbortSignal.timeout(8000),
    });
    const body = response.ok ? await response.json() : null;
    return body?.ok === true && typeof body.authed_user?.access_token === "string" ? body.authed_user.access_token : null;
  },
};

type Answer = { ok?: boolean; error?: string; user_id?: unknown; messages?: { matches?: Match[] } };
type Match = {
  ts?: unknown;
  text?: unknown;
  user?: unknown;
  username?: unknown;
  permalink?: unknown;
  channel?: { id?: unknown; name?: unknown; is_im?: boolean; is_mpim?: boolean };
};

// A token Slack no longer takes, or one without search:read: connecting again fixes it.
const NO_ACCESS = /^(invalid_auth|not_authed|token_revoked|token_expired|account_inactive|missing_scope)$/;
function failed(answer: Answer): AppItemsResponse {
  if (NO_ACCESS.test(answer.error ?? "")) return { state: "no-access" };
  // Slack's error code only ("ratelimited"), never the token or a message.
  console.error("Slack read failed:", String(answer.error).slice(0, 40));
  return { state: "error" };
}

async function api(method: string, token: string, params: Record<string, string> = {}): Promise<Answer> {
  const response = await fetch(`${SLACK}/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401) return { ok: false, error: "invalid_auth" };
  return response.ok ? response.json() : { ok: false, error: `http_${response.status}` };
}

// Slack's markup as words: the person's own mention goes ("<@U1> can you…" → "can you…"), others read "@name" or
// "@someone", channels "#name", links their label unless it looks like an address (then cleanBody makes it [link]).
export function slackText(text: string, me: string): string {
  return text
    .replace(/<@([A-Z0-9]+)(?:\|([^>]*))?>/g, (_, id: string, label?: string) => (label ? `@${label}` : id === me ? "" : "@someone"))
    .replace(/<#[A-Z0-9]+(?:\|([^>]*))?>/g, (_, name?: string) => `#${name || "channel"}`)
    .replace(/<!([^>|]+)(?:\|([^>]*))?>/g, (_, name: string, label?: string) => label || `@${name.split("^")[0]}`)
    .replace(/<((?:https?|mailto):[^>|]+)(?:\|([^>]*))?>/g, (_, url: string, label?: string) =>
      label && !/\w\.[a-z]{2,}/i.test(label) ? label : url.startsWith("mailto:") ? "[link]" : url,
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Words that ask the person to do or answer something, after links are gone (a link's "?" asks nothing).
const ASKS = /\?|\b(can you|could you|please|need you|when can)\b/i;

// Messages from the last 14 days that mention the person and ask something, newest first.
export async function slackItems(token: string, now = Date.now()): Promise<AppItemsResponse> {
  try {
    const me = await api("auth.test", token);
    if (!me.ok || typeof me.user_id !== "string") return failed(me);
    const after = new Date(now - 15 * DAY).toISOString().slice(0, 10);
    const found = await api("search.messages", token, { query: `<@${me.user_id}> after:${after}`, sort: "timestamp", sort_dir: "desc", count: "30" });
    if (!found.ok) return failed(found);
    const items: AppItem[] = [];
    for (const match of found.messages?.matches ?? []) {
      const { channel } = match;
      if (match.user === me.user_id || typeof match.text !== "string" || typeof match.ts !== "string" || typeof channel?.id !== "string") continue;
      if (typeof match.permalink !== "string" || !match.permalink.startsWith("https://")) continue;
      const text = cleanBody(slackText(match.text, me.user_id)).replace(/\s+/g, " ").trim();
      if (!text || !ASKS.test(text)) continue;
      const where = channel.is_im || channel.is_mpim ? "DM" : `#${typeof channel.name === "string" ? channel.name : "channel"}`;
      const sender = typeof match.username === "string" && match.username ? match.username : "someone";
      items.push({
        app: "slack",
        id: `${channel.id}-${match.ts}`,
        title: [...text].slice(0, 100).join(""),
        url: match.permalink,
        kind: "message",
        due: null,
        detail: [...`${where} · ${sender}`].slice(0, 280).join(""),
      });
    }
    return { state: "ok", items };
  } catch (error) {
    console.error("Slack read failed:", error instanceof Error ? error.name : "unknown");
    return { state: "error" };
  }
}
