import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkSnapRequest, snapPlan } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import type { GoalResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { activateGoal, openGoals, setGoal, titleKey } from "@/lib/goals";
import { localDate, timeZoneFrom } from "@/lib/tz";

// One model call with the photo, then the save.
export const maxDuration = 30;

// Body { image } (src/lib/day.ts SnapRequest): a photo or screenshot of an assignment becomes the current plan, as a
// deadline does in /api/goal/plan. Muse Spark reads it once; the image is never stored or logged. bad-request (422) when
// it holds no assignment.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies GoalResponse, { status: 401 });
  }
  const today = localDate(timeZoneFrom((await cookies()).get("tz")?.value));
  const image = checkSnapRequest(await request.json().catch(() => null));
  if (!image) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 400 });
  }
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 503 });
  }

  const snap = await snapPlan(image, today).catch((error) => {
    // The words before the first colon only: what an API error adds after it can echo the request.
    console.error("Snap model call failed:", error instanceof Error ? error.message.split(":")[0].slice(0, 80) : "unknown");
    return undefined;
  });
  if (snap === undefined) {
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 502 });
  }
  if (!snap) {
    return NextResponse.json({ state: "bad-request" } satisfies GoalResponse, { status: 422 });
  }
  try {
    const email = session.user.email;
    // The same assignment again (a second photo, or its deadline already planned): that plan opens, never a copy.
    const twin = (await openGoals(email)).find((goal) => titleKey(goal.title) === titleKey(snap.title));
    const goal = twin
      ? ((await activateGoal(email, twin.id)) ?? twin)
      : await setGoal(email, snap.title, snap.steps, snap.due);
    return NextResponse.json({ state: "ok", goal } satisfies GoalResponse);
  } catch (error) {
    console.error("Snap save failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies GoalResponse, { status: 500 });
  }
}
