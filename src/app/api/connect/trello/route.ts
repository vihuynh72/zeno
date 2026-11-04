import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AppItemsResponse } from "@/lib/connect";
import { trelloItems } from "@/lib/connect-apps";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 15;

// Body { token }: a read-only Trello token from this browser, used for this one request and never stored or logged.
// Answers the open cards the person is a member of, due dates in their time zone, soonest first.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ state: "error" } satisfies AppItemsResponse, { status: 401 });
  const key = process.env.NEXT_PUBLIC_TRELLO_KEY?.trim();
  if (!key) return NextResponse.json({ state: "error" } satisfies AppItemsResponse, { status: 503 });
  const token = ((await request.json().catch(() => null)) as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || !/^[A-Za-z0-9]{32,200}$/.test(token)) {
    return NextResponse.json({ state: "no-access" } satisfies AppItemsResponse, { status: 400 });
  }
  const res = await trelloItems(token, key, timeZoneFrom((await cookies()).get("tz")?.value));
  return NextResponse.json(res, { status: res.state === "ok" ? 200 : res.state === "no-access" ? 403 : 502 });
}
