import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cleanCanvas, cleanHistory, talk } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import { freeSlots } from "@/lib/calendar";
import { loadUserContext } from "@/lib/context";
import type { TalkResponse } from "@/lib/day";
import { timeZoneFrom } from "@/lib/tz";
import { cleanPrivate } from "@/lib/vault";

export const maxDuration = 30;

// Body { message, history, proposals?, private?, canvas? }: private holds the device's private facts (src/lib/vault.ts)
// and canvas its Canvas briefs (src/lib/canvas-store.ts), used for this reply only, never saved or logged. A private
// fact the turn learns comes back in `private` with a "kept-private" action, never saved; an email it drafts comes
// back in `draft`, never sent.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies TalkResponse, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ state: "no-key" } satisfies TalkResponse, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { message?: unknown; history?: unknown; proposals?: unknown; private?: unknown; canvas?: unknown }
    | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) {
    return NextResponse.json({ state: "bad-request" } satisfies TalkResponse, { status: 400 });
  }

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const accessToken = session.error ? undefined : session.accessToken;
  const [context, free] = await Promise.all([
    loadUserContext(session.user.email, session, timeZone),
    // Today and tomorrow, so a block can be offered for tomorrow morning; on failure the day's own free time stands.
    accessToken ? freeSlots(accessToken, timeZone, { minutes: 5, days: 2 }).catch(() => null) : null,
  ]);
  const firstName = session.user.name?.trim().split(/\s+/)[0] || null;

  try {
    // proposals: true comes only from a client that shows and books `proposal`.
    const result = await talk(
      { ...context, free: free ?? context.free, canvas: cleanCanvas(body?.canvas) },
      firstName,
      cleanHistory(body?.history),
      message,
      body?.proposals === true,
      cleanPrivate(body?.private),
    );
    return NextResponse.json({ state: "ok", ...result } satisfies TalkResponse);
  } catch (error) {
    // Never the whole error: it can quote the conversation.
    console.error("Talk model call failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "model-error" } satisfies TalkResponse, { status: 502 });
  }
}
