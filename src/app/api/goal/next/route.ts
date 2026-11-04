import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { nextSessions } from "@/lib/agent";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { getGoal, isId } from "@/lib/goals";
import { localDate, timeZoneFrom } from "@/lib/tz";

// One model call, then the save.
export const maxDuration = 30;

// Body { id } (src/lib/day.ts NextStepsRequest): a goal that keeps going (rhythm set) whose steps are all finished gets its
// next 3 to 5 sessions from Muse, planned from its rhythm and the sessions done so far (the last ones again when the model
// fails), and becomes the current plan. One with steps left comes back unchanged. bad-request for a goal that is not
// theirs or has no rhythm.
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
    const email = session.user.email;
    const found = await getGoal(email, id);
    const goal = found && (await nextSessions(email, found, localDate(timeZoneFrom((await cookies()).get("tz")?.value))));
    return goal
      ? NextResponse.json({ state: "ok", goal } satisfies GoalResponse)
      : NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  } catch (error) {
    console.error("Next steps failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
