import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { hashOf, newToken } from "@/lib/app-token";
import { ensureSchema, getSql } from "@/lib/db";

// Zeno in Claude or ChatGPT: OAuth 2.1 as the MCP authorization spec (2025-06-18) asks. The app registers itself (RFC 7591),
// the person allows it on /oauth/authorize, and the app trades the one-minute code (PKCE S256) for an access token, which
// is a Zeno app token (src/lib/app-token.ts), and a refresh token that changes at every use. Turn off in Connect an app
// ends every connection. Codes and tokens are kept only as SHA-256 hashes: never log one.

export const CODE_SECONDS = 60;
export const ACCESS_SECONDS = 3600;
const REFRESH_SECONDS = 30 * 86_400;
const CONSENT_MS = 10 * 60_000;

export type OAuthError = { error: string; error_description: string };
const fail = (error: string, error_description: string): OAuthError => ({ error, error_description });

// Every answer of the OAuth endpoints; browser-based MCP clients (MCP Inspector) call them from another origin.
export const OAUTH_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store",
};

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// RFC 9728, named in the MCP route's 401. issuer is this origin, exactly as ChatGPT compares it.
export const resourceMetadata = (origin: string) => ({
  resource: `${origin}/api/mcp`,
  authorization_servers: [origin],
  bearer_methods_supported: ["header"],
  resource_name: "Zeno",
});

// RFC 8414. iss comes back on every redirect from /oauth/authorize (RFC 9207), which ChatGPT checks when this says so.
export const serverMetadata = (issuer: string) => ({
  issuer,
  authorization_endpoint: `${issuer}/oauth/authorize`,
  token_endpoint: `${issuer}/api/oauth/token`,
  registration_endpoint: `${issuer}/api/oauth/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  authorization_response_iss_parameter_supported: true,
});

// https anywhere; http only back to this computer, for a local client; no fragment and no user info. Matched exactly later.
export function redirectOk(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (uri.includes("#") || url.username || url.password) return false;
  return url.protocol === "https:" || (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
}

// PKCE S256 only (RFC 7636): the challenge is the base64url SHA-256 of a 43-128 character verifier.
export const challengeOk = (challenge: unknown, method: unknown): challenge is string =>
  method === "S256" && typeof challenge === "string" && /^[A-Za-z0-9_-]{43}$/.test(challenge);

export const pkceOk = (verifier: unknown, challenge: string) =>
  typeof verifier === "string" &&
  /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) &&
  safeEqual(createHash("sha256").update(verifier).digest("base64url"), challenge);

export type Client = { client_id: string; client_name: string | null; redirect_uris: string[] };

// RFC 7591 metadata to a public client. Zeno issues no client secrets: an app asking for another token_endpoint_auth_method
// is registered with "none" (RFC 7591 lets the server replace a requested value), so the answer always says "none".
export function clientFrom(body: unknown): Omit<Client, "client_id"> | OAuthError {
  const meta = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const uris = meta.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every((uri) => typeof uri === "string" && uri.length <= 2000 && redirectOk(uri))) {
    return fail("invalid_redirect_uri", "redirect_uris: 1 to 10 https URLs, or http on localhost or 127.0.0.1");
  }
  const grants = meta.grant_types ?? [];
  if (!Array.isArray(grants) || !grants.every((grant) => grant === "authorization_code" || grant === "refresh_token")) {
    return fail("invalid_client_metadata", "grant_types: authorization_code and refresh_token only");
  }
  const responses = meta.response_types ?? [];
  if (!Array.isArray(responses) || !responses.every((type) => type === "code")) {
    return fail("invalid_client_metadata", "response_types: code only");
  }
  const name = typeof meta.client_name === "string" ? meta.client_name.trim().slice(0, 80) : "";
  return { client_name: name || null, redirect_uris: uris };
}

// shortcut: registration is open and unthrottled (a row is small); add a per-address limit if the table ever grows fast.
export async function registerClient(body: unknown): Promise<Client | OAuthError> {
  const meta = clientFrom(body);
  if ("error" in meta) return meta;
  await ensureSchema();
  const client = { client_id: randomUUID(), ...meta };
  await getSql()`
    INSERT INTO oauth_clients (client_id, client_name, redirect_uris) VALUES (${client.client_id}, ${client.client_name}, ${client.redirect_uris})
  `;
  return client;
}

async function findClient(clientId: string | undefined): Promise<Client | null> {
  if (!clientId || clientId.length > 100) return null;
  await ensureSchema();
  const [row] = await getSql()`SELECT client_id, client_name, redirect_uris FROM oauth_clients WHERE client_id = ${clientId}`;
  return row ? { client_id: String(row.client_id), client_name: row.client_name as string | null, redirect_uris: row.redirect_uris as string[] } : null;
}

// What /oauth/authorize was asked for, checked for the page and again for its Allow. A bad client or redirect is only ever
// shown, never redirected to.
export type Ask = { client: Client; redirectUri: string; challenge: string; state: string | null };
export async function askOf(params: Record<string, unknown>): Promise<Ask | "bad-client" | "bad-request"> {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };
  const client = await findClient(one("client_id"));
  const redirectUri = one("redirect_uri");
  if (!client || !redirectUri || !client.redirect_uris.includes(redirectUri)) return "bad-client";
  const challenge = one("code_challenge");
  if (one("response_type") !== "code" || !challengeOk(challenge, one("code_challenge_method"))) return "bad-request";
  return { client, redirectUri, challenge, state: one("state") ?? null };
}

// The consent form's CSRF check: an HMAC of the signed-in person and exactly this request, good for 10 minutes, so another
// site can't post Allow for someone signed in to Zeno.
export function consentCheck(email: string, ask: Ask, at = Date.now()): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const fields = ["zeno-oauth-consent", email, at, ask.client.client_id, ask.redirectUri, ask.challenge, ask.state];
  return `${at}.${createHmac("sha256", secret).update(JSON.stringify(fields)).digest("base64url")}`;
}

export function consentOk(check: unknown, email: string, ask: Ask, now = Date.now()): boolean {
  if (typeof check !== "string") return false;
  const at = Number(check.split(".")[0]);
  return Number.isSafeInteger(at) && at <= now && now - at < CONSENT_MS && safeEqual(consentCheck(email, ask, at), check);
}

// After Allow: a one-minute, single-use code bound to the client, its redirect and the PKCE challenge.
export async function makeCode(ask: Ask, email: string, timeZone: string): Promise<string> {
  await ensureSchema();
  const sql = getSql();
  const code = randomBytes(32).toString("base64url");
  await sql.transaction([
    sql`DELETE FROM oauth_codes WHERE expires_at < now()`,
    sql`
      INSERT INTO oauth_codes (code_hash, client_id, user_email, time_zone, redirect_uri, code_challenge, expires_at)
      VALUES (${hashOf(code)}, ${ask.client.client_id}, ${email}, ${timeZone}, ${ask.redirectUri}, ${ask.challenge},
        now() + make_interval(secs => ${CODE_SECONDS}))
    `,
  ]);
  return code;
}

export type Tokens = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string };
const pair = () => ({ access: newToken(), refresh: `zenor_${randomBytes(32).toString("base64url")}` });
const tokensOf = ({ access, refresh }: ReturnType<typeof pair>): Tokens => ({
  access_token: access,
  token_type: "Bearer",
  expires_in: ACCESS_SECONDS,
  refresh_token: refresh,
});

// grant_type=authorization_code. The code is deleted as it is read, so it works once, even when the rest is wrong.
export async function exchangeCode(form: Record<string, unknown>): Promise<Tokens | OAuthError> {
  if (typeof form.code !== "string" || typeof form.client_id !== "string") return fail("invalid_request", "code and client_id are required");
  await ensureSchema();
  const sql = getSql();
  const [row] = await sql`
    DELETE FROM oauth_codes WHERE code_hash = ${hashOf(form.code)}
    RETURNING client_id, user_email, time_zone, redirect_uri, code_challenge, expires_at > now() AS live
  `;
  if (
    !row?.live ||
    row.client_id !== form.client_id ||
    (form.redirect_uri !== undefined && form.redirect_uri !== row.redirect_uri) ||
    !pkceOk(form.code_verifier, String(row.code_challenge))
  ) {
    return fail("invalid_grant", "The code is wrong, used or expired, or code_verifier doesn't match it");
  }
  const tokens = pair();
  await sql`
    INSERT INTO oauth_tokens (client_id, user_email, time_zone, access_hash, access_expires_at, refresh_hash, refresh_expires_at)
    VALUES (${row.client_id}, ${row.user_email}, ${row.time_zone}, ${hashOf(tokens.access)}, now() + make_interval(secs => ${ACCESS_SECONDS}),
      ${hashOf(tokens.refresh)}, now() + make_interval(secs => ${REFRESH_SECONDS}))
  `;
  return tokensOf(tokens);
}

// grant_type=refresh_token: a new access and refresh token replace the old pair, which stops working at once.
// shortcut: a replayed old refresh token is only refused; revoke the whole connection on replay if tokens ever leak.
export async function refreshTokens(form: Record<string, unknown>): Promise<Tokens | OAuthError> {
  if (typeof form.refresh_token !== "string") return fail("invalid_request", "refresh_token is required");
  const clientId = typeof form.client_id === "string" ? form.client_id : null;
  await ensureSchema();
  const tokens = pair();
  const [row] = await getSql()`
    UPDATE oauth_tokens SET
      access_hash = ${hashOf(tokens.access)}, access_expires_at = now() + make_interval(secs => ${ACCESS_SECONDS}),
      refresh_hash = ${hashOf(tokens.refresh)}, refresh_expires_at = now() + make_interval(secs => ${REFRESH_SECONDS})
    WHERE refresh_hash = ${hashOf(form.refresh_token)} AND refresh_expires_at > now() AND (${clientId}::text IS NULL OR client_id = ${clientId})
    RETURNING id
  `;
  return row ? tokensOf(tokens) : fail("invalid_grant", "The refresh token is wrong, used, expired or turned off");
}
