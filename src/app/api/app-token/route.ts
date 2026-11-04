import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mintToken, revokeToken } from "@/lib/app-token";
import type { AppTokenResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { timeZoneFrom } from "@/lib/tz";

// The token is in the answer once and never cached, stored or logged.
const reply = (body: AppTokenResponse, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Connect an app's Make a token: a new personal token for MCP clients and the Mac clock; the old one stops working.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return reply({ state: "signed-out" }, 401);
  if (!databaseConfigured()) return reply({ state: "error" }, 503);
  try {
    return reply({ state: "ok", token: await mintToken(session.user.email, timeZoneFrom((await cookies()).get("tz")?.value)) });
  } catch (error) {
    console.error("Token mint failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return reply({ state: "error" }, 500);
  }
}

// Turn off: no app reaches Zeno with the token any more.
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) return reply({ state: "signed-out" }, 401);
  if (!databaseConfigured()) return reply({ state: "error" }, 503);
  try {
    await revokeToken(session.user.email);
    return reply({ state: "off" });
  } catch (error) {
    console.error("Token revoke failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return reply({ state: "error" }, 500);
  }
}
