import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { MailResponse } from "@/lib/day";
import { GmailError, MAIL_ID, readMessage } from "@/lib/gmail";

// GET /api/mail/[id]: one email from the person's own inbox, read in full with their own token for the Desk and an
// email's goal desk. The text is cleaned and capped in memory and goes only to their browser: never stored, logged,
// cached or sent to the model.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies MailResponse, { status: 401 });
  }
  const { id } = await params;
  if (!MAIL_ID.test(id)) {
    return NextResponse.json({ state: "bad-request" } satisfies MailResponse, { status: 400 });
  }
  // After a failed refresh the token is dead, so the mail can't be read until they sign in again.
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ state: "error" } satisfies MailResponse, { status: 403 });
  }

  try {
    const mail = await readMessage(accessToken, id);
    return NextResponse.json({ state: "ok", ...mail } satisfies MailResponse, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GmailError && error.status === 404) {
      return NextResponse.json({ state: "not-found" } satisfies MailResponse, { status: 404 });
    }
    // The status only: an error's text could carry what was read.
    console.error("Mail read failed:", error instanceof GmailError ? error.status : error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ state: "error" } satisfies MailResponse, { status: 502 });
  }
}
