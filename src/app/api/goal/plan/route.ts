import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPlanRequest, savePlan } from "@/lib/agent";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { localDate, timeZoneFrom } from "@/lib/tz";

// One model call, then the save.
export const maxDuration = 30;

// Body { title, due, canvas? } (src/lib/day.ts PlanRequest): a deadline with no plan yet becomes the current plan, in 3
// to 12 small steps from Muse, or the three-step rule plan when the model fails or refuses (savePlan in agent.ts, shared
// with the MCP tool plan_goal). The Canvas instructions reach the model only here and in /api/prep, and are never saved.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies GoalResponse, { status: 401 });
  }
  const today = localDate(timeZoneFrom((await cookies()).get("tz")?.value));
  const plan = checkPlanRequest(await request.json().catch(() => null), today);
  if (!plan) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 503 });
  }

  try {
    const goal = await savePlan(session.user.email, plan, today);
    return NextResponse.json({ state: "ok", goal } satisfies GoalResponse);
  } catch (error) {
    console.error("Plan save failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
