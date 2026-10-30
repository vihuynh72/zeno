import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { StepResponse, StepStatus } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { isId, setStepStatus } from "@/lib/goals";

const STATUSES: string[] = ["todo", "doing", "done", "skipped"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies StepResponse, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status;
  if (!isId(id) || typeof status !== "string" || !STATUSES.includes(status)) {
    return NextResponse.json({ state: "bad-request" } satisfies StepResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies StepResponse, { status: 503 });
  }

  try {
    const goal = await setStepStatus(session.user.email, id, status as StepStatus);
    if (!goal) {
      return NextResponse.json({ state: "not-found" } satisfies StepResponse, { status: 404 });
    }
    return NextResponse.json({ state: "ok", goal } satisfies StepResponse);
  } catch (error) {
    console.error("Step update failed:", error);
    return NextResponse.json({ state: "error" } satisfies StepResponse, { status: 500 });
  }
}
