import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { WaitingResponse } from "@/lib/day";
import { GmailError, getWaiting } from "@/lib/gmail";
import { sensitiveEmail } from "@/lib/profile";

// GET /api/mail/waiting ("Waiting on", Nov 4): mail she sent 3+ days ago that nobody answered, each a one-tap follow-up.
// Headers only, read with her own token; never stored, logged or sent to the model. Code and bank mail is left out.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies WaitingResponse, { status: 401 });
  }
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ state: "error" } satisfies WaitingResponse, { status: 403 });
  }
  try {
    const waiting = (await getWaiting(accessToken, session.user.email)).filter((item) => !sensitiveEmail({ from: item.to, subject: item.subject }));
    return NextResponse.json({ state: "ok", waiting } satisfies WaitingResponse, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // The status only: an error's text could carry what was read.
    console.error("Waiting mail failed:", error instanceof GmailError ? error.status : error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ state: "error" } satisfies WaitingResponse, { status: 502 });
  }
}
