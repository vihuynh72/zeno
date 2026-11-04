import { getPublicOrigin } from "mcp-handler";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import type { AppItemsResponse } from "@/lib/connect";
import { finishConnect, startConnect, type OAuthApp } from "@/lib/connect-oauth";
import { timeZoneFrom } from "@/lib/tz";

// The handlers behind /api/connect/<app> for an OAuth app (src/lib/connect-oauth.ts holds the logic its check covers).

// POST { token }: the app's open items, read with the token for this one request. The state in the body says how it
// went, so every answer from the app is a 200.
export async function connectItems(request: Request, read: (token: string, timeZone: string) => Promise<AppItemsResponse>) {
  if (!(await auth())?.user?.email) return Response.json({ state: "error" } satisfies AppItemsResponse, { status: 401 });
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = body?.token;
  // Printable characters only, since it goes in a header.
  if (typeof token !== "string" || !/^[\x21-\x7e]{8,1000}$/.test(token)) {
    return Response.json({ state: "no-access" } satisfies AppItemsResponse, { status: 400 });
  }
  return Response.json(await read(token, timeZoneFrom((await cookies()).get("tz")?.value)));
}

export const connectStart = async (request: Request, app: OAuthApp) =>
  startConnect(app, getPublicOrigin(request), (await auth())?.user?.email);

export const connectCallback = async (request: Request, app: OAuthApp) =>
  finishConnect(app, new URL(request.url), getPublicOrigin(request), (await auth())?.user?.email);
