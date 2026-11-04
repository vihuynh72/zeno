import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AppItemsResponse } from "@/lib/connect";
import { linearItems } from "@/lib/connect-apps";

export const maxDuration = 15;

// Body { token }: a Linear personal API key from this browser, used for this one request and never stored or logged.
// Answers the issues assigned to the person that are not completed or canceled, soonest due first.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ state: "error" } satisfies AppItemsResponse, { status: 401 });
  const token = ((await request.json().catch(() => null)) as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || !/^[\x21-\x7e]{8,400}$/.test(token)) {
    return NextResponse.json({ state: "no-access" } satisfies AppItemsResponse, { status: 400 });
  }
  const res = await linearItems(token);
  return NextResponse.json(res, { status: res.state === "ok" ? 200 : res.state === "no-access" ? 403 : 502 });
}
