import { createHmac, timingSafeEqual } from "node:crypto";
import { APP_NAMES, type App } from "@/lib/connect";

// Sign-in for the OAuth apps (src/lib/connect.ts). GET /api/connect/<app>/start sends the person to the app with a state
// bound to them; GET /api/connect/<app>/callback checks it, trades the code for a token here on the server and hands the
// token to /connect/<app> in the fragment, which never reaches a server. Nothing here keeps or logs a token.

export type OAuthApp = {
  app: App;
  // The app's consent page for this client, callback and state.
  authorize: (clientId: string, redirectUri: string, state: string) => string;
  // The token for a code, or null when the app refused the code; may throw on network trouble.
  exchange: (code: string, redirectUri: string, clientId: string, secret: string) => Promise<string | null>;
};

const STATE_MS = 10 * 60_000;

// An HMAC of the app, the signed-in person and the time, good for 10 minutes, so a callback another site starts never
// connects someone else's account. The email itself never leaves the server.
export function connectState(app: App, email: string, at = Date.now()): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return `${at}.${createHmac("sha256", secret).update(JSON.stringify(["zeno-connect", app, email, at])).digest("base64url")}`;
}

export function stateOk(state: unknown, app: App, email: string, now = Date.now()): boolean {
  if (typeof state !== "string") return false;
  const at = Number(state.split(".")[0]);
  if (!Number.isSafeInteger(at) || at > now || now - at >= STATE_MS) return false;
  const want = Buffer.from(connectState(app, email, at));
  const got = Buffer.from(state);
  return want.length === got.length && timingSafeEqual(want, got);
}

// NOTION_CLIENT_ID and NOTION_CLIENT_SECRET, SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.
function keysOf(app: App) {
  const id = process.env[`${app.toUpperCase()}_CLIENT_ID`];
  const secret = process.env[`${app.toUpperCase()}_CLIENT_SECRET`];
  return id && secret ? { id, secret } : null;
}

// The request's own origin, so production and a local server each get their own callback.
const callbackOf = (origin: string, app: App) => `${origin}/api/connect/${app}/callback`;

export function startConnect(provider: OAuthApp, origin: string, email: string | null | undefined): Response {
  const keys = keysOf(provider.app);
  if (!keys) return new Response(`${APP_NAMES[provider.app]} isn't set up on this server yet.`, { status: 503 });
  if (!email) return new Response(`Sign in to Zeno first, then connect ${APP_NAMES[provider.app]}.`, { status: 401 });
  const state = connectState(provider.app, email);
  return new Response(null, { status: 302, headers: { Location: provider.authorize(keys.id, callbackOf(origin, provider.app), state), "Cache-Control": "no-store" } });
}

// Always a 303 to /connect/<app>: #token=<encoded token>, or #error=denied (the person said no in the app) or
// #error=failed (signed out, a bad or old state, a refused code, or the app out of reach).
export async function finishConnect(provider: OAuthApp, url: URL, origin: string, email: string | null | undefined): Promise<Response> {
  const { app } = provider;
  const to = (fragment: string) => new Response(null, { status: 303, headers: { Location: `/connect/${app}#${fragment}`, "Cache-Control": "no-store" } });
  if (url.searchParams.has("error")) return to("error=denied");
  const keys = keysOf(app);
  const code = url.searchParams.get("code");
  if (!keys || !email || !code || !stateOk(url.searchParams.get("state"), app, email)) return to("error=failed");
  try {
    const token = await provider.exchange(code, callbackOf(origin, app), keys.id, keys.secret);
    return to(token ? `token=${encodeURIComponent(token)}` : "error=failed");
  } catch {
    // Only that it failed: the app's answer can hold the token.
    console.error(`${APP_NAMES[app]} connect failed`);
    return to("error=failed");
  }
}
