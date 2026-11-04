import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { getGoal, insertStep, isId } from "@/lib/goals";

// POST /api/goal/step { goalId, title } (src/lib/day.ts AddStepRequest): Mail's "Add as a step" (Vi, Nov 4). One step
// joins one of her goals right before its first step not started, so it comes next without stopping a running one, or at
// the end when none is left. No model call; bad-request also when the goal is not hers.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies GoalResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { goalId?: unknown; title?: unknown } | null;
  const goalId = isId(body?.goalId) ? body.goalId : null;
  const title = typeof body?.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (!goalId || !title) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 503 });
  }
  try {
    const email = session.user.email;
    const goal = await getGoal(email, goalId);
    const before = goal?.steps.find((step) => step.status === "todo")?.id ?? null;
    const saved = goal ? await insertStep(email, goalId, { title, minutes: 10 }, before) : null;
    if (!saved) return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 404 });
    return NextResponse.json({ state: "ok", goal: saved } satisfies GoalResponse);
  } catch (error) {
    console.error("Add step failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
