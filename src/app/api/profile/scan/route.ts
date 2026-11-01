import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai";
import type { ProfileResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { scanProfile } from "@/lib/profile";
import { timeZoneFrom } from "@/lib/tz";

// Two model calls in parallel after reading up to 50 emails.
export const maxDuration = 60;

// Body { first?: boolean } (true from setup): reads calendar and email at most once a local day and returns only
// what it newly learned. Nothing but the facts is stored.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies ProfileResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { first?: unknown } | null;
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies ProfileResponse, { status: 503 });
  }

  try {
    const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
    const result = await scanProfile(session.user.email, session, timeZone, { first: body?.first === true });
    return NextResponse.json(result, { status: result.state === "error" ? 502 : 200 });
  } catch (error) {
    // Never log the model reply or the mail: both quote the person's email.
    console.error("Profile scan failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies ProfileResponse, { status: 502 });
  }
}
