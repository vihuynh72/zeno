import { createHash, randomBytes } from "node:crypto";
import { ensureSchema, getSql } from "@/lib/db";

// A connected app's token (docs/PLAN-NOV3-APPS.md): "zeno_" and 32 random bytes in base64url. The database keeps only its
// SHA-256, so a copy of the table opens nothing. Never log a token.
const SHAPE = /^zeno_[A-Za-z0-9_-]{43}$/;
const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

// Who a token belongs to: the only way a connected app names a person. timeZone is theirs when they made it.
export type TokenOwner = { email: string; timeZone: string };

// A new token replaces the old one, which stops working at once.
export async function mintToken(email: string, timeZone: string): Promise<string> {
  await ensureSchema();
  const token = `zeno_${randomBytes(32).toString("base64url")}`;
  await getSql()`
    INSERT INTO app_tokens (user_email, token_hash, time_zone) VALUES (${email}, ${hashOf(token)}, ${timeZone})
    ON CONFLICT (user_email) DO UPDATE SET token_hash = EXCLUDED.token_hash, time_zone = EXCLUDED.time_zone, created_at = now()
  `;
  return token;
}

// The person a token belongs to, or null for a token that is malformed, replaced or turned off.
export async function tokenOwner(token: string): Promise<TokenOwner | null> {
  if (!SHAPE.test(token)) return null;
  await ensureSchema();
  const [row] = await getSql()`SELECT user_email, time_zone FROM app_tokens WHERE token_hash = ${hashOf(token)}`;
  return row ? { email: String(row.user_email), timeZone: String(row.time_zone) } : null;
}

export async function revokeToken(email: string): Promise<void> {
  await ensureSchema();
  await getSql()`DELETE FROM app_tokens WHERE user_email = ${email}`;
}

// The token in "Authorization: Bearer zeno_…", or null.
export function bearerOf(request: Request): string | null {
  const [type, token] = (request.headers.get("authorization") ?? "").trim().split(/\s+/);
  return type?.toLowerCase() === "bearer" && token ? token : null;
}
