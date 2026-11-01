import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { calendarFailure, freeSlots } from "@/lib/calendar";
import type { FreeResponse } from "@/lib/day";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

const whole = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

// POST /api/calendar/free body { minutes, days? }: free gaps that fit, soonest first (days 1 is the rest of today).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies FreeResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { minutes?: unknown; days?: unknown } | null;
  const minutes = body?.minutes;
  const days = body?.days ?? 1;
  if (!whole(minutes, 5, 240) || !whole(days, 1, 14)) {
    return NextResponse.json({ state: "bad-request" } satisfies FreeResponse, { status: 400 });
  }
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ state: "no-access" } satisfies FreeResponse, { status: 403 });
  }

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  try {
    const slots = await freeSlots(accessToken, timeZone, { minutes, days });
    return NextResponse.json({ state: "ok", slots } satisfies FreeResponse);
  } catch (error) {
    if (calendarFailure(error) !== "error") {
      return NextResponse.json({ state: "no-access" } satisfies FreeResponse, { status: 403 });
    }
    console.error("Free time read failed:", error);
    return NextResponse.json({ state: "error" } satisfies FreeResponse, { status: 500 });
  }
}
