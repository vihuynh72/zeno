import { getPublicOrigin } from "mcp-handler";
import { OAUTH_HEADERS, resourceMetadata } from "@/lib/oauth";

// RFC 9728: where Claude and ChatGPT learn, from the MCP route's 401, which server signs people in to Zeno.
export function GET(request: Request) {
  return Response.json(resourceMetadata(getPublicOrigin(request)), { headers: OAUTH_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_HEADERS });
}
