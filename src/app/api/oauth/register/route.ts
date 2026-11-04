import { databaseConfigured } from "@/lib/db";
import { OAUTH_HEADERS, registerClient } from "@/lib/oauth";

// RFC 7591 dynamic client registration: Claude and ChatGPT register themselves here, as public clients, before the person
// allows them on /oauth/authorize.
export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: OAUTH_HEADERS });
  try {
    const client = await registerClient(await request.json().catch(() => null));
    if ("error" in client) return Response.json(client, { status: 400, headers: OAUTH_HEADERS });
    return Response.json(
      {
        client_id: client.client_id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        ...(client.client_name && { client_name: client.client_name }),
        redirect_uris: client.redirect_uris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      { status: 201, headers: OAUTH_HEADERS },
    );
  } catch (error) {
    console.error("OAuth register failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return Response.json({ error: "server_error" }, { status: 500, headers: OAUTH_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_HEADERS });
}
