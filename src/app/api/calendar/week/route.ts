import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { calendarFailure, calendarWriteFor, isMonday, thisMonday, weekEvents } from "@/lib/calendar";
import type { WeekResponse } from "@/lib/day";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

// GET /api/calendar/week?start=YYYY-MM-DD (a Monday; defaults to this week): the grid's seven days.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies WeekResponse, { status: 401 });
  }
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const start = request.nextUrl.searchParams.get("start") ?? thisMonday(timeZone);
  if (!isMonday(start)) {
    return NextResponse.json({ state: "bad-request" } satisfies WeekResponse, { status: 400 });
  }
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ state: "no-access" } satisfies WeekResponse, { status: 403 });
  }

  try {
    const days = await weekEvents(accessToken, timeZone, start);
    return NextResponse.json({ state: "ok", timeZone, days, write: calendarWriteFor(session) } satisfies WeekResponse);
  } catch (error) {
    if (calendarFailure(error) !== "error") {
      return NextResponse.json({ state: "no-access" } satisfies WeekResponse, { status: 403 });
    }
    console.error("Week read failed:", error);
    return NextResponse.json({ state: "error" } satisfies WeekResponse, { status: 500 });
  }
}
