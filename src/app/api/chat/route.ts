import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured, askModel, ZENO_SYSTEM_PROMPT, AI_MODEL, type ChatMessage } from "@/lib/ai";
import { contextToText, loadUserContext } from "@/lib/context";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ state: "no-key" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown; history?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) {
    return NextResponse.json({ state: "bad-request" }, { status: 400 });
  }
  // The client sends history, so trust only plain user and assistant turns, never a system role.
  const raw = body?.history;
  const history: ChatMessage[] = (Array.isArray(raw) ? raw.slice(-12) : [])
    .filter(
      (item) =>
        (item?.role === "user" || item?.role === "assistant") && typeof item.content === "string",
    )
    .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) }));

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const context = await loadUserContext(session.user.email, session, timeZone);
  const userPrompt = `Context about the person's day:\n${contextToText(context)}\n\nThe person says:\n${message}`;

  try {
    const reply = await askModel(
      [{ role: "system", content: ZENO_SYSTEM_PROMPT }, ...history, { role: "user", content: userPrompt }],
      { effort: "minimal", maxTokens: 1024 },
    );
    return NextResponse.json({ state: "ok", reply, model: AI_MODEL });
  } catch (error) {
    console.error("Chat model call failed:", error);
    return NextResponse.json({ state: "model-error" }, { status: 502 });
  }
}
