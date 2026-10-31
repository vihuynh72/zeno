import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai";
import type { PrepResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { isId, savePrep, stepTitles } from "@/lib/goals";
import { findSources } from "@/lib/prep";

export const maxDuration = 30;

// Body { stepId }: one of the person's steps; Muse searches the web for it and the result is kept on the step.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies PrepResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { stepId?: unknown } | null;
  const stepId = body?.stepId;
  if (!isId(stepId)) {
    return NextResponse.json({ state: "bad-request" } satisfies PrepResponse, { status: 400 });
  }
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies PrepResponse, { status: 503 });
  }

  const email = session.user.email;
  try {
    const titles = await stepTitles(email, stepId);
    if (!titles) {
      return NextResponse.json({ state: "not-found" } satisfies PrepResponse, { status: 404 });
    }
    const sources = await findSources(titles.goal, titles.step);
    await savePrep(email, stepId, sources);
    return NextResponse.json({ state: "ok", sources } satisfies PrepResponse);
  } catch (error) {
    console.error("Prep failed:", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    return NextResponse.json({ state: "error" } satisfies PrepResponse, { status: 502 });
  }
}
