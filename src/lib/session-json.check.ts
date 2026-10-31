// Self-check for session-json.ts: node src/lib/session-json.check.ts
import assert from "node:assert/strict";
import { accountKey, withoutAccessToken } from "./session-json.ts";

const headers = new Headers({ "content-type": "application/json" });
headers.append("set-cookie", "authjs.session-token=refreshed");
headers.append("set-cookie", "authjs.callback-url=x");
const session = { user: { name: "Vi" }, expires: "2026-11-28T00:00:00.000Z", accessToken: "ya29.secret" };
const stripped = await withoutAccessToken(new Response(JSON.stringify(session), { status: 200, headers }));
assert.deepEqual(await stripped.json(), { user: { name: "Vi" }, expires: "2026-11-28T00:00:00.000Z" });
// The refreshed session cookie must still reach the browser.
assert.deepEqual(stripped.headers.getSetCookie(), ["authjs.session-token=refreshed", "authjs.callback-url=x"]);
assert.equal(stripped.headers.get("content-type"), "application/json");

// Signed out, redirects and HTML pages pass through untouched, body still readable.
const signedOut = Response.json(null);
assert.equal(await withoutAccessToken(signedOut), signedOut);
assert.equal(await signedOut.json(), null);
for (const response of [Response.redirect("http://localhost/?error=Configuration"), new Response("<html></html>")]) {
  assert.equal(await withoutAccessToken(response), response);
}

const key = accountKey("vi@example.com", "secret-1");
assert.match(key, /^[0-9a-f]{16}$/);
assert.equal(accountKey("vi@example.com", "secret-1"), key); // a returning visit finds its saved day
assert.notEqual(accountKey("vi2@example.com", "secret-1"), key); // another account never does
assert.notEqual(accountKey("vi@example.com", "secret-2"), key); // keyed by the secret, not a plain hash of the email

console.log("session-json self-check passed");
