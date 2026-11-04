import { connectCallback } from "@/lib/connect-route";
import { SLACK_OAUTH } from "@/lib/slack";

// Slack sends the person back here; the token goes on to /connect/slack in the fragment (src/lib/connect-oauth.ts).
export const GET = (request: Request) => connectCallback(request, SLACK_OAUTH);
