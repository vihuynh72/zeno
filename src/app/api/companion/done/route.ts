import { companionDone, companionReply } from "@/lib/app-tools";

// The Mac clock's Done: finishes the running step and answers with what comes next (src/lib/day.ts CompanionNow).
export async function POST(request: Request) {
  return companionReply(request, companionDone);
}
