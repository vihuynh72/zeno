import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { bookBlocks, calendarFailure, calendarWriteFor, validBlocks } from "@/lib/calendar";
import { forgetCalendar } from "@/lib/context";
import type { BookResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

// POST /api/calendar/book body { blocks: CalendarBlock[] } (1 to 12), sent only after the person's tap.
// `booked` holds only the blocks Google confirmed, each with its eventId.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies BookResponse, { status: 401 });
  }
  const email = session.user.email;
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const body = (await request.json().catch(() => null)) as { blocks?: unknown } | null;
  const blocks = validBlocks(body?.blocks, timeZone);
  if (!blocks) {
    return NextResponse.json({ state: "bad-request" } satisfies BookResponse, { status: 400 });
  }
  const accessToken = session.error ? undefined : session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ state: "no-access" } satisfies BookResponse, { status: 403 });
  }
  if (calendarWriteFor(session) !== "ok") {
    return NextResponse.json({ state: "needs-permission" } satisfies BookResponse, { status: 403 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "error" } satisfies BookResponse, { status: 503 });
  }

  try {
    const booked = await bookBlocks(accessToken, email, timeZone, blocks);
    forgetCalendar(email);
    return NextResponse.json({ state: "ok", booked } satisfies BookResponse);
  } catch (error) {
    const state = calendarFailure(error);
    if (state === "error") console.error("Booking failed:", error);
    return NextResponse.json({ state } satisfies BookResponse, { status: state === "error" ? 500 : 403 });
  }
}
