import { connectStart } from "@/lib/connect-route";
import { NOTION_OAUTH } from "@/lib/notion";

// Sends the signed-in person to Notion to connect it (src/lib/connect-oauth.ts).
export const GET = (request: Request) => connectStart(request, NOTION_OAUTH);
