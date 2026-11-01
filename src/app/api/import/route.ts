import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deadlineMemory, extractNotes, placeTodos } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import { calendarWriteFor, freeSlots } from "@/lib/calendar";
import type { CalendarBlock, ImportResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { addMemory, listMemories } from "@/lib/goals";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

// Body { text }: pasted notes, 1 to 8000 characters. Facts become grouped memories; deadlines and to-dos come
// back as a proposal to book (nothing is written to the calendar here). Without calendar access the proposal is
// empty and deadlines are kept as projects memories instead.
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
  const accessToken = calendarWriteFor(session) === "no-access" ? undefined : session.accessToken;
  try {
    const notes = await extractNotes(text, timeZone);
    // One at a time, so each save's trim sees the one before it.
    for (const fact of notes.facts) await addMemory(email, fact.text, { group: fact.group, source: "you" });
    let proposal: CalendarBlock[] = [];
    if (accessToken) {
      const slots = await freeSlots(accessToken, timeZone, { minutes: 5, days: 3 }).catch(() => []);
      proposal = [
        ...notes.deadlines.map((deadline) => ({ title: deadline.title, kind: "deadline" as const, date: deadline.date, stepId: null })),
        ...placeTodos(notes.todos, slots, timeZone),
      ];
    } else {
      for (const deadline of notes.deadlines) await addMemory(email, deadlineMemory(deadline), { group: "projects", source: "you" });
    }
    return NextResponse.json({ state: "ok", memories: await listMemories(email), proposal } satisfies ImportResponse);
  } catch (error) {
    // Never log the model reply: it quotes the person's notes.
    console.error("Import failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies ImportResponse, { status: 502 });
  }
}
