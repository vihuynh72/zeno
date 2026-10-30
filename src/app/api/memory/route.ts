import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { MemoryResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { listMemories } from "@/lib/goals";

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
