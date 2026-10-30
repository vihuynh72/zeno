import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cleanHistory, talk } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import { loadUserContext } from "@/lib/context";
import type { TalkResponse } from "@/lib/day";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies TalkResponse, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ state: "no-key" } satisfies TalkResponse, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown; history?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) {
    return NextResponse.json({ state: "bad-request" } satisfies TalkResponse, { status: 400 });
  }

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const context = await loadUserContext(session.user.email, session, timeZone);
  const firstName = session.user.name?.trim().split(/\s+/)[0] || null;

  try {
    const result = await talk(context, firstName, cleanHistory(body?.history), message);
    return NextResponse.json({ state: "ok", ...result } satisfies TalkResponse);
  } catch (error) {
    console.error("Talk model call failed:", error);
    return NextResponse.json({ state: "model-error" } satisfies TalkResponse, { status: 502 });
  }
}
