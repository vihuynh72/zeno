import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { CloseGoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { closeGoal, isId } from "@/lib/goals";

// Body { id } (src/lib/day.ts CloseGoalRequest), only from her tap on Mark done: the goal is done, a goal that keeps going
// too, and its open steps close. A goal that is not hers, or not open, is a bad request.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies CloseGoalResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = body?.id;
  if (!isId(id)) {
    return NextResponse.json({ state: "bad-request" } satisfies CloseGoalResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies CloseGoalResponse, { status: 503 });
  }

  try {
    const done = await closeGoal(session.user.email, id, "done");
    return done
      ? NextResponse.json({ state: "ok", ...done } satisfies CloseGoalResponse)
      : NextResponse.json({ state: "bad-request" } satisfies CloseGoalResponse, { status: 400 });
  } catch (error) {
    console.error("Goal finish failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies CloseGoalResponse, { status: 500 });
  }
}
