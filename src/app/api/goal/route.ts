import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPlan, privateTitle } from "@/lib/agent";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { setGoal, setStepStatus } from "@/lib/goals";
import { localDate, timeZoneFrom } from "@/lib/tz";

// Body { title, due?, steps: { title, minutes }[], start? }: saves a plan without the model, so a tap on the
// first card's plan is instant; start: true also starts step 1. A due date before the person's today is refused, and
// so is a title with a private or never-list detail: titles are stored on Zeno's servers and can go on the calendar.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies GoalResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { start?: unknown } | null;
  const plan = checkPlan(body);
  const today = localDate(timeZoneFrom((await cookies()).get("tz")?.value));
  if (
    !plan ||
    privateTitle([plan.title, ...plan.steps.map((step) => step.title)]) ||
    (plan.due !== null && plan.due < today) ||
    (body?.start !== undefined && typeof body.start !== "boolean")
  ) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 503 });
  }

  const email = session.user.email;
  try {
    const goal = await setGoal(email, plan.title, plan.steps, plan.due);
    // The plan is saved by now, so a failed start returns it with step 1 still todo: a retry would save it twice.
    const started = body?.start
      ? await setStepStatus(email, goal.steps[0].id, "doing").catch((error) => {
          console.error("Goal start failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
          return null;
        })
      : null;
    return NextResponse.json({ state: "ok", goal: started ?? goal } satisfies GoalResponse);
  } catch (error) {
    console.error("Goal save failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
