import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AppItemsResponse } from "@/lib/connect";
import { docLink, readDoc } from "@/lib/connect-apps";

export const maxDuration = 15;

// Body { url }: a Google Doc's link ("Add a doc" under For this goal). No token: the doc must be shared "Anyone with the
// link". Answers the doc as one item, or no-access when Google won't hand it over.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ state: "error" } satisfies AppItemsResponse, { status: 401 });
  const url = ((await request.json().catch(() => null)) as { url?: unknown } | null)?.url;
  const found = typeof url === "string" && url.length <= 2000 ? docLink(url) : null;
  if (!found) return NextResponse.json({ state: "no-access" } satisfies AppItemsResponse, { status: 400 });
  const doc = await readDoc(found.id, 280);
  if (doc.state !== "ok") return NextResponse.json({ state: doc.state === "private" ? "no-access" : "error" } satisfies AppItemsResponse, { status: 502 });
  return NextResponse.json({
    state: "ok",
    items: [{ app: "gdocs", id: found.id, title: doc.title, url: doc.url, kind: "doc", due: null, detail: doc.text || null }],
  } satisfies AppItemsResponse);
}
