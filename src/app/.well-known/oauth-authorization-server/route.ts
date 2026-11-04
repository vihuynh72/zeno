import { getPublicOrigin } from "mcp-handler";
import { OAUTH_HEADERS, serverMetadata } from "@/lib/oauth";

// RFC 8414: Zeno's own sign-in for MCP clients (src/lib/oauth.ts).
export function GET(request: Request) {
  return Response.json(serverMetadata(getPublicOrigin(request)), { headers: OAUTH_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_HEADERS });
}
