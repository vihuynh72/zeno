import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readGoals, saveGoals } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { timeZoneFrom } from "@/lib/tz";

// One model call (a second when a goal was refused for a private detail), then the saves.
export const maxDuration = 30;

// Body { text } (src/lib/day.ts AddGoalRequest): the person's own words become up to 3 goals in one Muse call (readGoals in
// agent.ts): specific titles, due dates read in their time zone, a rhythm for a goal that keeps going, and steps that
// finish the job. The first is the current plan, the others wait paused in `others`. bad-request (422) only when the words
// hold no goal; goals that couldn't be worded without a private detail are an error (502), so the page never says there
// was no goal. Their words reach these calls only and are never logged.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies GoalResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  }
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 503 });
  }

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const goals = await readGoals(text, timeZone).catch((error) => {
    // The words before the first colon only: what an API error adds after it can echo the request.
    console.error("Add goal model call failed:", error instanceof Error ? error.message.split(":")[0].slice(0, 80) : "unknown");
    return undefined;
  });
  if (goals === undefined) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 502 });
  }
  if (goals.length === 0) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 422 });
  }
  try {
    const { goal, others } = await saveGoals(session.user.email, goals);
    return NextResponse.json({ state: "ok", goal, others } satisfies GoalResponse);
  } catch (error) {
    console.error("Add goal save failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
