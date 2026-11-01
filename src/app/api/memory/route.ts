import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MEMORY_GROUPS, type MemoryResponse, type SaveMemoryResponse } from "@/lib/day";
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

// Body { text, group? }: one thing the person tells Zeno to remember, 1 to 200 characters, in one of MEMORY_GROUPS
// ("about" when left out).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies SaveMemoryResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown; group?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const group = MEMORY_GROUPS.find((known) => known === body?.group);
  if (!text || [...text].length > 200 || (body?.group != null && !group)) {
    return NextResponse.json({ state: "bad-request" } satisfies SaveMemoryResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies SaveMemoryResponse, { status: 503 });
  }

  try {
    await addMemory(session.user.email, text, { group });
    const memories = await listMemories(session.user.email);
    return NextResponse.json({ state: "ok", memories } satisfies SaveMemoryResponse);
  } catch (error) {
    console.error("Memory save failed:", error);
    return NextResponse.json({ state: "error" } satisfies SaveMemoryResponse, { status: 500 });
  }
}
