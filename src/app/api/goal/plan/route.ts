import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPlanRequest, planDeadline, rulePlan } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { activateGoal, openGoals, setGoal, titleKey } from "@/lib/goals";
import { localDate, timeZoneFrom } from "@/lib/tz";

// One model call, then the save.
export const maxDuration = 30;

// Body { title, due, canvas? } (src/lib/day.ts PlanRequest): a deadline with no plan yet becomes the current plan, in 3
// to 7 small steps from Muse, or the three-step rule plan when the model fails or refuses. Saving pauses the old current
// plan, as POST /api/goal does. The Canvas instructions reach the model only here and in /api/prep, and are never saved.
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

  const steps = aiConfigured()
    ? await planDeadline(plan, today).catch((error) => {
        // The message only: a reply can quote the instructions, and the error never carries one.
        console.error("Plan model call failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
        return null;
      })
    : null;
  try {
    const email = session.user.email;
    // A second tap, or two at once, while this plan was being made: the plan already saved opens, never a copy.
    const twin = (await openGoals(email)).find((goal) => titleKey(goal.title) === titleKey(plan.title));
    const goal = twin
      ? ((await activateGoal(email, twin.id)) ?? twin)
      : await setGoal(email, plan.title, steps ?? rulePlan(plan.title), plan.due);
    return NextResponse.json({ state: "ok", goal } satisfies GoalResponse);
  } catch (error) {
    console.error("Plan save failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
