import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai";
import type { ProfileResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { scanProfile } from "@/lib/profile";
import { timeZoneFrom } from "@/lib/tz";
import { cleanPrivate } from "@/lib/vault";

// Reading up to 50 emails, then one model call over all of it with a 25-second deadline.
export const maxDuration = 60;

// Body { first?: boolean; private?: string[]; removed?: string[] } (first is true from setup; private holds the
// device's private facts, so they count as known, and removed the ones the person removed there, vaultRemoved, so a
// scan never writes them again): reads calendar and email at most once a local day and returns only what it newly learned.
// Nothing but the facts is stored, and private facts only go back to the device, in `private`.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies ProfileResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { first?: unknown; private?: unknown; removed?: unknown } | null;
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies ProfileResponse, { status: 503 });
  }

  try {
    const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
    const result = await scanProfile(session.user.email, session, timeZone, {
      first: body?.first === true,
      privateFacts: cleanPrivate(body?.private),
      removedFacts: cleanPrivate(body?.removed),
    });
    return NextResponse.json(result, { status: result.state === "error" ? 502 : 200 });
  } catch (error) {
    // Never log the model reply or the mail: both quote the person's email.
    console.error("Profile scan failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies ProfileResponse, { status: 502 });
  }
}
