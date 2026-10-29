import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTodayEvents } from "@/lib/calendar";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ state: "signed-out", events: [] }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ state: "no-calendar-access", events: [] }, { status: 403 });
  }

  try {
    const events = await getTodayEvents(session.accessToken);
    return NextResponse.json({ state: "ok", events });
  } catch (error) {
    const body = (error as { body?: string })?.body ?? "";
    console.error("Calendar read failed:", error);
    if (body.includes("accessNotConfigured") || body.includes("has not been used")) {
      return NextResponse.json({ state: "not-enabled", events: [] });
    }
    return NextResponse.json({ state: "error", events: [] }, { status: 502 });
  }
}
