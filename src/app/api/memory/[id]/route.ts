import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { databaseConfigured } from "@/lib/db";
import { forgetMemory, isId } from "@/lib/goals";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ state: "bad-request" }, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" }, { status: 503 });
  }

  try {
    // Deleting twice is still a success: the memory is gone either way.
    await forgetMemory(session.user.email, id);
    return NextResponse.json({ state: "ok" });
  } catch (error) {
    console.error("Memory delete failed:", error);
    return NextResponse.json({ state: "error" }, { status: 500 });
  }
}
