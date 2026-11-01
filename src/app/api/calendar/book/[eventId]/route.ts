import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { calendarFailure, calendarWriteFor, unbookBlock } from "@/lib/calendar";
import { forgetCalendar } from "@/lib/context";
import type { BookResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";

export const maxDuration = 30;

// Google event ids are base32hex; this also keeps the id safe inside the API path.
const EVENT_ID = /^[A-Za-z0-9_-]{1,1024}$/;

// DELETE /api/calendar/book/[eventId]: undoes one booking, only ever on the Zeno calendar. Undoing twice is still ok.
export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies BookResponse, { status: 401 });
  }
  const email = session.user.email;
  const { eventId } = await params;
  if (!EVENT_ID.test(eventId)) {
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
    await unbookBlock(accessToken, email, eventId);
    forgetCalendar(email);
    return NextResponse.json({ state: "ok", booked: [] } satisfies BookResponse);
  } catch (error) {
    const state = calendarFailure(error);
    if (state === "error") console.error("Undo booking failed:", error);
    return NextResponse.json({ state } satisfies BookResponse, { status: state === "error" ? 500 : 403 });
  }
}
