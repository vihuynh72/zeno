import { connectCallback } from "@/lib/connect-route";
import { NOTION_OAUTH } from "@/lib/notion";

// Notion sends the person back here; the token goes on to /connect/notion in the fragment (src/lib/connect-oauth.ts).
export const GET = (request: Request) => connectCallback(request, NOTION_OAUTH);
