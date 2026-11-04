import { companionNow, companionReply } from "@/lib/app-tools";

// The Mac clock's step (src/lib/day.ts CompanionNow), with "Authorization: Bearer zeno_…" from Connect an app.
export async function GET(request: Request) {
  return companionReply(request, companionNow);
}
