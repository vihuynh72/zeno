import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractNotes, keepNotes } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import { calendarWriteFor, freeSlots } from "@/lib/calendar";
import type { ImportResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { listMemories } from "@/lib/goals";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

// Body { text }: pasted notes, 1 to 8000 characters. Facts, deadlines and to-dos become grouped memories (keepNotes
// saves them one at a time, so addMemory's dedupe and group caps see each save); when Zeno may write to its calendar,
// deadlines and the to-dos that fit free time in the next 3 days also come back as a proposal to book (nothing is
// written to the calendar here). Without write access (no access, or a sign-in from before it) the proposal is empty.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies ImportResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 8000) {
    return NextResponse.json({ state: "bad-request" } satisfies ImportResponse, { status: 400 });
  }
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies ImportResponse, { status: 503 });
  }

  const email = session.user.email;
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  // A proposal booking would refuse (needs-permission) is no proposal.
  const accessToken = calendarWriteFor(session) === "ok" ? session.accessToken : undefined;
  try {
    // Free time loads while the model reads; a failed read still proposes the deadlines.
    const [notes, slots] = await Promise.all([
      extractNotes(text, timeZone),
      accessToken ? freeSlots(accessToken, timeZone, { minutes: 5, days: 3 }).catch(() => []) : null,
    ]);
    const proposal = await keepNotes(email, notes, slots, timeZone);
    return NextResponse.json({ state: "ok", memories: await listMemories(email), proposal } satisfies ImportResponse);
  } catch (error) {
    // Never log the model reply: it quotes the person's notes.
    console.error("Import failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies ImportResponse, { status: 502 });
  }
}
