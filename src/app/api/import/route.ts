import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractMemories } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import type { SaveMemoryResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { addMemory, listMemories } from "@/lib/goals";

export const maxDuration = 30;

// Body { text }: pasted notes, 1 to 8000 characters, that become a few short memories.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies SaveMemoryResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 8000) {
    return NextResponse.json({ state: "bad-request" } satisfies SaveMemoryResponse, { status: 400 });
  }
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies SaveMemoryResponse, { status: 503 });
  }

  const email = session.user.email;
  try {
    // One at a time, so each save's 50-memory trim sees the one before it.
    for (const memory of await extractMemories(text)) await addMemory(email, memory);
    return NextResponse.json({ state: "ok", memories: await listMemories(email) } satisfies SaveMemoryResponse);
  } catch (error) {
    // Never log the model reply: it quotes the person's notes.
    console.error("Import failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies SaveMemoryResponse, { status: 502 });
  }
}
