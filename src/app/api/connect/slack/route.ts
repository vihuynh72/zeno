import { connectItems } from "@/lib/connect-route";
import { slackItems } from "@/lib/slack";

// auth.test, then search.messages: up to two Slack requests of 8 s each.
export const maxDuration = 30;

// Body { token } (src/lib/connect.ts): Slack messages that mention the person and ask something, read with their token
// for this one request.
export const POST = (request: Request) => connectItems(request, (token) => slackItems(token));
