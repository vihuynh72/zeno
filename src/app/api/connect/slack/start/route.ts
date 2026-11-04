import { connectStart } from "@/lib/connect-route";
import { SLACK_OAUTH } from "@/lib/slack";

// Sends the signed-in person to Slack to connect it (src/lib/connect-oauth.ts).
export const GET = (request: Request) => connectStart(request, SLACK_OAUTH);
