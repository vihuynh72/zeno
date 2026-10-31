import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { MemoryResponse, SaveMemoryResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { addMemory, listMemories } from "@/lib/goals";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies MemoryResponse, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies MemoryResponse, { status: 503 });
  }

  try {
    const memories = await listMemories(session.user.email);
    return NextResponse.json({ state: "ok", memories } satisfies MemoryResponse);
  } catch (error) {
    console.error("Memory read failed:", error);
    return NextResponse.json({ state: "error" } satisfies MemoryResponse, { status: 500 });
  }
}

// Body { text }: one thing the person tells Zeno to remember, 1 to 200 characters.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies SaveMemoryResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || [...text].length > 200) {
    return NextResponse.json({ state: "bad-request" } satisfies SaveMemoryResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies SaveMemoryResponse, { status: 503 });
  }

  try {
    await addMemory(session.user.email, text);
    const memories = await listMemories(session.user.email);
    return NextResponse.json({ state: "ok", memories } satisfies SaveMemoryResponse);
  } catch (error) {
    console.error("Memory save failed:", error);
    return NextResponse.json({ state: "error" } satisfies SaveMemoryResponse, { status: 500 });
  }
}
