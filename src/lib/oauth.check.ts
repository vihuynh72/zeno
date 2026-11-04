// Self-check for oauth.ts (Zeno in Claude or ChatGPT): redirect rules, PKCE, the consent check, and with DATABASE_URL
// (node --env-file=.env.local src/lib/oauth.check.ts) single-use one-minute codes, rotating refresh tokens and Turn off,
// for a throwaway @zeno.local person and client, deleted after. Never prints a token.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { registerHooks } from "node:module";

// oauth.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
process.env.AUTH_SECRET ??= "oauth-check-only";

const { askOf, challengeOk, clientFrom, CODE_SECONDS, consentCheck, consentOk, exchangeCode, makeCode, pkceOk, redirectOk, refreshTokens, registerClient, resourceMetadata, serverMetadata } =
  await import("./oauth.ts");
type Ask = import("./oauth.ts").Ask;

// Redirects: https anywhere, http only back to this computer; matched exactly at authorize.
for (const uri of [
  "https://claude.ai/api/mcp/auth_callback",
  "https://chatgpt.com/connector_platform_oauth_redirect",
  "http://localhost:33418/callback",
  "http://127.0.0.1/cb?x=1",
]) {
  assert.ok(redirectOk(uri), uri);
}
for (const uri of [
  "http://claude.ai/cb",
  "http://localhost.evil.com/cb",
  "http://127.0.0.1.nip.io/cb",
  "https://claude.ai/cb#frag",
  "https://user:pw@claude.ai/cb",
  "javascript:alert(1)",
  "cursor://callback",
  "claude.ai/cb",
  "",
]) {
  assert.ok(!redirectOk(uri), uri);
}

// Registration: public clients only. A requested client secret method is replaced by "none" (nothing to return), bad
// redirects and other grants are refused.
const claude = { client_name: " Claude ", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] };
assert.deepEqual(
  clientFrom({ ...claude, token_endpoint_auth_method: "client_secret_post", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
  { client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] },
);
assert.deepEqual(clientFrom({ redirect_uris: ["http://localhost:1234/cb"] }), { client_name: null, redirect_uris: ["http://localhost:1234/cb"] });
assert.equal((clientFrom({ ...claude, client_name: "x".repeat(200) }) as { client_name: string }).client_name.length, 80);
for (const body of [null, "x", {}, { redirect_uris: [] }, { redirect_uris: "https://claude.ai/cb" }, { redirect_uris: ["http://evil.com/cb"] }, { redirect_uris: Array(11).fill("https://a.b/c") }]) {
  assert.equal((clientFrom(body) as { error: string }).error, "invalid_redirect_uri", JSON.stringify(body));
}
assert.equal((clientFrom({ ...claude, grant_types: ["client_credentials"] }) as { error: string }).error, "invalid_client_metadata");
assert.equal((clientFrom({ ...claude, response_types: ["token"] }) as { error: string }).error, "invalid_client_metadata");

// PKCE S256 only, with RFC 7636's own example.
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
assert.ok(challengeOk(challenge, "S256"));
for (const [c, method] of [[challenge, "plain"], [challenge, undefined], [verifier.slice(1), "S256"], [`${challenge}=`, "S256"], [undefined, "S256"]]) {
  assert.ok(!challengeOk(c, method), `${c} ${method}`);
}
assert.ok(pkceOk(verifier, challenge));
assert.ok(!pkceOk(`${verifier}x`, challenge));
assert.ok(!pkceOk(undefined, challenge));
assert.ok(!pkceOk(verifier, challenge.replace("E", "F")));
assert.ok(!pkceOk("short", createHash("sha256").update("short").digest("base64url")), "a verifier under 43 characters");
const long = "a".repeat(129);
assert.ok(!pkceOk(long, createHash("sha256").update(long).digest("base64url")), "a verifier over 128 characters");

// The consent check: this person, exactly this request, for 10 minutes.
const ask: Ask = {
  client: { client_id: "c1", client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] },
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  challenge,
  state: "s1",
};
const at = Date.parse("2026-11-04T17:00:00.000Z");
const check = consentCheck("maya@zeno.local", ask, at);
assert.ok(consentOk(check, "maya@zeno.local", ask, at + 60_000));
assert.ok(!consentOk(check, "other@zeno.local", ask, at + 60_000), "another person");
assert.ok(!consentOk(check, "maya@zeno.local", { ...ask, state: "s2" }, at + 60_000), "another state");
assert.ok(!consentOk(check, "maya@zeno.local", { ...ask, redirectUri: "https://claude.ai/other" }, at + 60_000), "another redirect");
assert.ok(!consentOk(check, "maya@zeno.local", { ...ask, client: { ...ask.client, client_id: "c2" } }, at + 60_000), "another app");
assert.ok(!consentOk(check, "maya@zeno.local", ask, at + 10 * 60_000), "ten minutes old");
assert.ok(!consentOk(check, "maya@zeno.local", ask, at - 1), "from the future");
assert.ok(!consentOk(`${at}.forged`, "maya@zeno.local", ask, at + 1));
assert.ok(!consentOk(undefined, "maya@zeno.local", ask, at + 1));

// Discovery: the resource is the MCP route; the issuer is the origin, the same string everywhere (ChatGPT compares it exactly).
const origin = "https://zeno.example";
assert.deepEqual(resourceMetadata(origin).resource, `${origin}/api/mcp`);
assert.deepEqual(resourceMetadata(origin).authorization_servers, [serverMetadata(origin).issuer]);
assert.deepEqual(serverMetadata(origin).code_challenge_methods_supported, ["S256"]);
assert.deepEqual(serverMetadata(origin).token_endpoint_auth_methods_supported, ["none"]);
assert.equal(CODE_SECONDS, 60);

if (!process.env.DATABASE_URL) {
  console.log("oauth check: pure parts ok; the database parts need DATABASE_URL (node --env-file=.env.local).");
} else {
  const { getSql } = await import("./db.ts");
  const { hashOf, mintToken, revokeToken, tokenOwner } = await import("./app-token.ts");
  const sql = getSql();
  const email = `oauth-check-${randomUUID()}@zeno.local`;
  const clientIds: string[] = [];
  try {
    const client = await registerClient({ client_name: "Check", redirect_uris: ["http://127.0.0.1:9/callback", "https://claude.ai/api/mcp/auth_callback"] });
    assert.ok(!("error" in client));
    clientIds.push(client.client_id);
    const other = await registerClient({ client_name: "Other", redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"] });
    assert.ok(!("error" in other));
    clientIds.push(other.client_id);

    // Authorize: the redirect must be one the client registered, character for character; PKCE S256 is required.
    const params = {
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:9/callback",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
    };
    const asked = await askOf(params);
    assert.ok(typeof asked !== "string");
    assert.deepEqual(asked.client.redirect_uris, ["http://127.0.0.1:9/callback", "https://claude.ai/api/mcp/auth_callback"]);
    assert.equal(asked.state, "xyz");
    for (const redirect_uri of ["http://127.0.0.1:9/callback/", "http://127.0.0.1:9/Callback", "http://localhost:9/callback", "https://chatgpt.com/connector_platform_oauth_redirect", undefined]) {
      assert.equal(await askOf({ ...params, redirect_uri }), "bad-client", String(redirect_uri));
    }
    assert.equal(await askOf({ ...params, client_id: "not-a-client" }), "bad-client");
    assert.equal(await askOf({ ...params, code_challenge_method: "plain" }), "bad-request");
    assert.equal(await askOf({ ...params, code_challenge: undefined }), "bad-request");
    assert.equal(await askOf({ ...params, response_type: "token" }), "bad-request");

    const form = (code: string, extra: Record<string, unknown> = {}) => ({
      grant_type: "authorization_code",
      code,
      client_id: client.client_id,
      redirect_uri: params.redirect_uri,
      code_verifier: verifier,
      ...extra,
    });
    const error = (result: object) => (result as { error?: string }).error;

    // A code is kept hashed, lasts 60 s and works once.
    const code = await makeCode(asked, email, "Asia/Tokyo");
    const [stored] = await sql`SELECT code_hash, extract(epoch FROM expires_at - now()) AS left FROM oauth_codes WHERE user_email = ${email}`;
    assert.equal(stored.code_hash, hashOf(code), "only the SHA-256 is stored");
    assert.ok(Number(stored.left) > 50 && Number(stored.left) <= 60, "one minute");
    const tokens = await exchangeCode(form(code));
    assert.ok(!("error" in tokens));
    assert.equal(tokens.token_type, "Bearer");
    assert.match(tokens.access_token, /^zeno_[A-Za-z0-9_-]{43}$/, "a Zeno app token");
    assert.deepEqual(await tokenOwner(tokens.access_token), { email, timeZone: "Asia/Tokyo" });
    assert.equal(error(await exchangeCode(form(code))), "invalid_grant", "a code works once");
    const [row] = await sql`SELECT access_hash, refresh_hash FROM oauth_tokens WHERE user_email = ${email}`;
    assert.deepEqual([row.access_hash, row.refresh_hash], [hashOf(tokens.access_token), hashOf(tokens.refresh_token)], "tokens kept hashed");

    // An expired code is refused.
    const old = await makeCode(asked, email, "Asia/Tokyo");
    await sql`UPDATE oauth_codes SET expires_at = now() - interval '1 second' WHERE code_hash = ${hashOf(old)}`;
    assert.equal(error(await exchangeCode(form(old))), "invalid_grant", "expired");

    // A wrong verifier, app or redirect is refused, and spends the code.
    const wrong = await makeCode(asked, email, "Asia/Tokyo");
    assert.equal(error(await exchangeCode(form(wrong, { code_verifier: `${verifier.slice(0, -1)}A` }))), "invalid_grant");
    assert.equal(error(await exchangeCode(form(wrong))), "invalid_grant", "spent by the failed try");
    for (const extra of [{ client_id: other.client_id }, { redirect_uri: "https://claude.ai/api/mcp/auth_callback" }, { code_verifier: undefined }]) {
      assert.equal(error(await exchangeCode(form(await makeCode(asked, email, "Asia/Tokyo"), extra))), "invalid_grant", JSON.stringify(extra));
    }
    assert.equal(error(await exchangeCode({ grant_type: "authorization_code", code: "x" })), "invalid_request");
    // Without redirect_uri the code still works: PKCE binds it.
    const plain = await exchangeCode(form(await makeCode(asked, email, "Asia/Tokyo"), { redirect_uri: undefined }));
    assert.ok(!("error" in plain));

    // Refresh: a new pair; the old access and refresh tokens stop at once; only the same app may refresh.
    const next = await refreshTokens({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id });
    assert.ok(!("error" in next));
    assert.notEqual(next.refresh_token, tokens.refresh_token);
    assert.equal(await tokenOwner(tokens.access_token), null, "the old access token");
    assert.deepEqual(await tokenOwner(next.access_token), { email, timeZone: "Asia/Tokyo" });
    assert.equal(error(await refreshTokens({ refresh_token: tokens.refresh_token, client_id: client.client_id })), "invalid_grant", "rotated");
    assert.equal(error(await refreshTokens({ refresh_token: next.refresh_token, client_id: other.client_id })), "invalid_grant", "another app");
    assert.equal(error(await refreshTokens({})), "invalid_request");
    // An expired access token is refused; its refresh token still renews it.
    await sql`UPDATE oauth_tokens SET access_expires_at = now() - interval '1 second' WHERE access_hash = ${hashOf(next.access_token)}`;
    assert.equal(await tokenOwner(next.access_token), null, "expired");
    const third = await refreshTokens({ refresh_token: next.refresh_token });
    assert.ok(!("error" in third));
    assert.ok(await tokenOwner(third.access_token));

    // A made token and the connections work side by side; Turn off ends all of them, refresh tokens and codes included.
    const made = await mintToken(email, "America/Los_Angeles");
    assert.ok((await tokenOwner(made)) && (await tokenOwner(third.access_token)) && (await tokenOwner(plain.access_token)));
    const pending = await makeCode(asked, email, "Asia/Tokyo");
    await revokeToken(email);
    for (const token of [made, third.access_token, plain.access_token]) assert.equal(await tokenOwner(token), null, "turned off");
    assert.equal(error(await refreshTokens({ refresh_token: third.refresh_token })), "invalid_grant", "its refresh token too");
    assert.equal(error(await exchangeCode(form(pending))), "invalid_grant", "and an unused code");
    console.log("oauth check: ok, with the database");
  } finally {
    await sql`DELETE FROM oauth_tokens WHERE user_email = ${email}`;
    await sql`DELETE FROM oauth_codes WHERE user_email = ${email}`;
    await sql`DELETE FROM app_tokens WHERE user_email = ${email}`;
    for (const id of clientIds) await sql`DELETE FROM oauth_clients WHERE client_id = ${id}`;
  }
}
