import { connection, NextResponse } from "next/server";
import { upgradeWebSocket } from "@vercel/functions";
import { auth } from "@/auth";
import { cleanKeywords, relayToMeta } from "@/lib/listen-relay";

// A socket closes when its function hits maxDuration; pin it so a lower project default cannot cut sessions short.
export const maxDuration = 300;

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  if (!session) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  const apiKey = process.env.META_MODEL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ state: "no-key" }, { status: 503 });
  }
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return NextResponse.json({ state: "bad-request" }, { status: 426 });
  }

  const keywords = cleanKeywords(new URL(request.url).searchParams.getAll("k"));
  return upgradeWebSocket((ws) => relayToMeta(ws, apiKey, keywords));
}
