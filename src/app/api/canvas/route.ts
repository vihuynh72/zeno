import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CanvasError, canvasAssignments, canvasBase, canvasDeadlines } from "@/lib/canvas";
import type { CanvasResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { replaceCanvasDeadlines } from "@/lib/goals";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

// Body { base, token } (src/lib/day.ts CanvasResponse): reads the next 14 days from the person's Canvas with their
// personal access token, used for this one request and never stored or logged, and replaces the account's Canvas
// deadline memories with what is still to hand in.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies CanvasResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { base?: unknown; token?: unknown } | null;
  const token = body?.token;
  if (typeof token !== "string" || !/^[A-Za-z0-9~]{20,200}$/.test(token)) {
    return NextResponse.json({ state: "bad-request" } satisfies CanvasResponse, { status: 400 });
  }
  const base = canvasBase(body?.base);
  if (!base) {
    return NextResponse.json({ state: "bad-url" } satisfies CanvasResponse, { status: 400 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies CanvasResponse, { status: 503 });
  }

  try {
    const { courses, assignments } = await canvasAssignments(base, token);
    const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
    await replaceCanvasDeadlines(session.user.email, canvasDeadlines(assignments, timeZone));
    return NextResponse.json({ state: "ok", courses, assignments } satisfies CanvasResponse);
  } catch (error) {
    const state = error instanceof CanvasError ? error.state : "error";
    // Neither error carries the token: Canvas errors hold only their state, and the rest are the database's.
    console.error("Canvas sync failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state } satisfies CanvasResponse, { status: state === "bad-token" ? 400 : state === "not-allowed" ? 403 : 502 });
  }
}
