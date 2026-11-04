import { databaseConfigured } from "@/lib/db";
import { exchangeCode, OAUTH_HEADERS, refreshTokens } from "@/lib/oauth";

// The token endpoint: the authorization_code grant (with PKCE) and the refresh_token grant. Tokens are in the answer once
// and are never cached, stored in the clear or logged.
export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: OAUTH_HEADERS });
  let form: Record<string, unknown>;
  try {
    // OAuth sends a form; a few clients send JSON.
    form = (request.headers.get("content-type") ?? "").includes("json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return Response.json({ error: "invalid_request", error_description: "Send a form body" }, { status: 400, headers: OAUTH_HEADERS });
  }
  try {
    const result =
      form?.grant_type === "authorization_code"
        ? await exchangeCode(form)
        : form?.grant_type === "refresh_token"
          ? await refreshTokens(form)
          : { error: "unsupported_grant_type", error_description: "authorization_code or refresh_token" };
    return Response.json(result, { status: "error" in result ? 400 : 200, headers: OAUTH_HEADERS });
  } catch (error) {
    console.error("OAuth token failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return Response.json({ error: "server_error" }, { status: 500, headers: OAUTH_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_HEADERS });
}
