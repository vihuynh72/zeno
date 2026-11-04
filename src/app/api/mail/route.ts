import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dayEmails } from "@/lib/context";
import type { MailListResponse } from "@/lib/day";
import { GmailError, getRecentEmail } from "@/lib/gmail";

// GET /api/mail ("Show all mail", Vi, Nov 4): the newest 20 emails from every inbox tab, under the important ones, as
// the day's rows (code and bank mail opens in Gmail). Read with her own token; never stored, logged or sent to the model.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies MailListResponse, { status: 401 });
  }
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ state: "error" } satisfies MailListResponse, { status: 403 });
  }
  try {
    const emails = dayEmails(await getRecentEmail(accessToken, true), session.user.email);
    return NextResponse.json({ state: "ok", emails } satisfies MailListResponse, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // The status only: an error's text could carry what was read.
    console.error("Mail list failed:", error instanceof GmailError ? error.status : error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ state: "error" } satisfies MailListResponse, { status: 502 });
  }
}
