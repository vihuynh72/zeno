import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { StepResponse, StepStatus } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { changeStepStatus, isId } from "@/lib/goals";
import { learnFromSteps } from "@/lib/patterns";
import { progressFor } from "@/lib/progress";
import { timeZoneFrom } from "@/lib/tz";

const STATUSES: string[] = ["todo", "doing", "done", "skipped"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies StepResponse, { status: 401 });
  }
  const email = session.user.email;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status;
  if (!isId(id) || typeof status !== "string" || !STATUSES.includes(status)) {
    return NextResponse.json({ state: "bad-request" } satisfies StepResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies StepResponse, { status: 503 });
  }
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);

  try {
    const changed = await changeStepStatus(email, id, status as StepStatus);
    if (!changed) {
      return NextResponse.json({ state: "not-found" } satisfies StepResponse, { status: 404 });
    }
    const goal = changed.goal;
    if (status !== "done" && status !== "skipped") {
      return NextResponse.json({ state: "ok", goal } satisfies StepResponse);
    }
    // Extras: the status change is already saved, so a failure here only leaves them out.
    const [progress, learned] = await Promise.all([
      progressFor(email, timeZone, status === "done" && changed.before !== "done").catch((error) => {
        console.error("Progress failed:", error);
        return undefined;
      }),
      learnFromSteps(email, timeZone).catch((error) => {
        console.error("Learning from steps failed:", error);
        return null;
      }),
    ]);
    return NextResponse.json({ state: "ok", goal, progress, learned } satisfies StepResponse);
  } catch (error) {
    console.error("Step update failed:", error);
    return NextResponse.json({ state: "error" } satisfies StepResponse, { status: 500 });
  }
}
