import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { activateGoal, isId } from "@/lib/goals";

// Body { id } (src/lib/day.ts ActivateRequest): that open plan becomes the current one, and the old current plan is
// paused, not lost. A goal that is not this person's, or is done, is a bad request.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies GoalResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = body?.id;
  if (!isId(id)) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 503 });
  }

  try {
    const goal = await activateGoal(session.user.email, id);
    return goal
      ? NextResponse.json({ state: "ok", goal } satisfies GoalResponse)
      : NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  } catch (error) {
    console.error("Goal activate failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
