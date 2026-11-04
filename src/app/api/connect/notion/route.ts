import { connectItems } from "@/lib/connect-route";
import { notionItems } from "@/lib/notion";

// A search and the database names: up to two Notion requests of 8 s each.
export const maxDuration = 30;

// Body { token } (src/lib/connect.ts): the person's open Notion tasks and recent pages, read with their token for this
// one request.
export const POST = (request: Request) => connectItems(request, notionItems);
