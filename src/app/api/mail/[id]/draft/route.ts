import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai";
import type { DraftResponse } from "@/lib/day";
import { GmailError, MAIL_ID, readMessage } from "@/lib/gmail";
import { draftReply, modelMay } from "@/lib/mail-ai";
import { timeZoneFrom } from "@/lib/tz";

// One Gmail read and one Muse call.
export const maxDuration = 30;

// POST /api/mail/[id]/draft: Muse writes a short reply to one of her emails in her voice, which she edits and sends
// herself from Gmail (Vi, Nov 4); Zeno never sends mail. Code, bank and private mail never reaches the model. The email
// and the draft are never stored or logged.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies DraftResponse, { status: 401 });
  }
  const { id } = await params;
  if (!MAIL_ID.test(id)) {
    return NextResponse.json({ state: "bad-request" } satisfies DraftResponse, { status: 400 });
  }
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies DraftResponse, { status: 503 });
  }

  try {
    const mail = await readMessage(accessToken, id);
    if (!modelMay(mail)) return NextResponse.json({ state: "private" } satisfies DraftResponse, { status: 422 });
    const firstName = session.user.name?.trim().split(/\s+/)[0] || null;
    const draft = await draftReply(mail, firstName, timeZoneFrom((await cookies()).get("tz")?.value));
    if (!draft) throw new Error("Draft reply was empty or not usable");
    return NextResponse.json({ state: "ok", draft, to: mail.address, subject: mail.subject } satisfies DraftResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof GmailError && error.status === 404) {
      return NextResponse.json({ state: "not-found" } satisfies DraftResponse, { status: 404 });
    }
    // The status or the words before the first colon only: the rest could carry what was read.
    console.error("Draft reply failed:", error instanceof GmailError ? error.status : error instanceof Error ? error.message.split(":")[0].slice(0, 80) : "unknown");
    return NextResponse.json({ state: "error" } satisfies DraftResponse, { status: 502 });
  }
}
