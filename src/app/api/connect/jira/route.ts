import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AppItemsResponse } from "@/lib/connect";
import { atlassianLogin, jiraItems } from "@/lib/connect-apps";

export const maxDuration = 15;

// Body { token }: her Atlassian sign-in from this browser (JSON { site, email, token }), used for this one request and
// never stored or logged. Only "<name>.atlassian.net" is ever fetched. Answers her open Jira issues, soonest due first.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ state: "error" } satisfies AppItemsResponse, { status: 401 });
  const login = atlassianLogin(((await request.json().catch(() => null)) as { token?: unknown } | null)?.token);
  if (!login) return NextResponse.json({ state: "no-access" } satisfies AppItemsResponse, { status: 400 });
  const res = await jiraItems(login);
  return NextResponse.json(res, { status: res.state === "ok" ? 200 : res.state === "no-access" ? 403 : 502 });
}
