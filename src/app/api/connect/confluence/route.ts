import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AppItemsResponse } from "@/lib/connect";
import { atlassianLogin, confluenceItems } from "@/lib/connect-apps";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 20; // two reads of 8 s at most

// Body { token }: the same Atlassian sign-in as Jira (JSON { site, email, token }), used for this one request and never
// stored or logged. Only "<name>.atlassian.net" is ever fetched. Answers the open Confluence tasks assigned to her, due
// dates in her time zone, soonest first.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ state: "error" } satisfies AppItemsResponse, { status: 401 });
  const login = atlassianLogin(((await request.json().catch(() => null)) as { token?: unknown } | null)?.token);
  if (!login) return NextResponse.json({ state: "no-access" } satisfies AppItemsResponse, { status: 400 });
  const res = await confluenceItems(login, timeZoneFrom((await cookies()).get("tz")?.value));
  return NextResponse.json(res, { status: res.state === "ok" ? 200 : res.state === "no-access" ? 403 : 502 });
}
