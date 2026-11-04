import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { CloseGoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { closeGoal, isId, restoreGoal } from "@/lib/goals";

// Body { id, undo? } (src/lib/day.ts CloseGoalRequest), only from her tap on Remove or Undo: the goal leaves every list
// and count, kept so undo: true puts it back. A goal that is not hers, or not open (not removed, for an undo), is a bad
// request.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies CloseGoalResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown; undo?: unknown } | null;
  const id = body?.id;
  if (!isId(id) || (body?.undo !== undefined && typeof body.undo !== "boolean")) {
    return NextResponse.json({ state: "bad-request" } satisfies CloseGoalResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies CloseGoalResponse, { status: 503 });
  }

  try {
    const email = session.user.email;
    const done = body?.undo ? await restoreGoal(email, id) : await closeGoal(email, id, "removed");
    return done
      ? NextResponse.json({ state: "ok", ...done } satisfies CloseGoalResponse)
      : NextResponse.json({ state: "bad-request" } satisfies CloseGoalResponse, { status: 400 });
  } catch (error) {
    console.error("Goal remove failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies CloseGoalResponse, { status: 500 });
  }
}
