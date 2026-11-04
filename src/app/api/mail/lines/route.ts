import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai";
import type { MailLinesResponse } from "@/lib/day";
import { MAIL_ID, readMessage } from "@/lib/gmail";
import { mailLines } from "@/lib/mail-ai";
import { timeZoneFrom } from "@/lib/tz";

// Up to 6 Gmail reads at once, then one Muse call.
export const maxDuration = 30;

// POST /api/mail/lines { ids }: one line for each of up to 6 important emails, what it asks and by when (Vi, Nov 4), in
// one Muse call at minimal effort. The page asks once per email per day and keeps the lines on the device, so GET
// /api/day stays instant with no model call. Code, bank and private mail is never sent and gets no line. Nothing here is
// stored or logged.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies MailLinesResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((id): id is string => typeof id === "string" && MAIL_ID.test(id)))].slice(0, 6) : [];
  if (ids.length === 0) {
    return NextResponse.json({ state: "bad-request" } satisfies MailLinesResponse, { status: 400 });
  }
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies MailLinesResponse, { status: 503 });
  }

  const read = await Promise.all(ids.map((id) => readMessage(accessToken, id).catch(() => null)));
  const found = read.flatMap((mail, i) => (mail ? [{ id: ids[i], mail }] : []));
  try {
    if (found.length === 0) throw new Error("Every mail read failed");
    const lines = await mailLines(found.map(({ mail }) => mail), timeZoneFrom((await cookies()).get("tz")?.value));
    return NextResponse.json(
      { state: "ok", lines: Object.fromEntries(found.flatMap(({ id }, i) => (lines[i] ? [[id, lines[i]]] : []))) } satisfies MailLinesResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // The words before the first colon only: what an API error adds after it can echo the request.
    console.error("Mail lines failed:", error instanceof Error ? error.message.split(":")[0].slice(0, 80) : "unknown");
    return NextResponse.json({ state: "error" } satisfies MailLinesResponse, { status: 502 });
  }
}
