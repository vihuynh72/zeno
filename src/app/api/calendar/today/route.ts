import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTodayEvents } from "@/lib/calendar";
import { timeZoneFrom } from "@/lib/tz";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ state: "signed-out", events: [] }, { status: 401 });
  }

  if (session.error === "RefreshTokenError") {
    return NextResponse.json({ state: "reauth", events: [] }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ state: "no-calendar-access", events: [] }, { status: 403 });
  }

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  try {
    const events = await getTodayEvents(session.accessToken, timeZone);
    return NextResponse.json({ state: "ok", events });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const body = (error as { body?: string })?.body ?? "";
    console.error("Calendar read failed:", error);
    if (status === 401) {
      return NextResponse.json({ state: "reauth", events: [] }, { status: 401 });
    }
    if (body.includes("accessNotConfigured") || body.includes("has not been used")) {
      return NextResponse.json({ state: "not-enabled", events: [] });
    }
    if (
      status === 403 &&
      (body.includes("insufficientPermissions") || body.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"))
    ) {
      return NextResponse.json({ state: "no-calendar-access", events: [] });
    }
    return NextResponse.json({ state: "error", events: [] }, { status: 502 });
  }
}
