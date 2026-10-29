import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured, askModel, ZENO_SYSTEM_PROMPT, AI_MODEL } from "@/lib/ai";
import { contextToText, loadUserContext } from "@/lib/context";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ state: "no-key" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ state: "bad-request" }, { status: 400 });
  }

  const context = await loadUserContext(session.user.email, session.accessToken);
  const userPrompt = `Context about the person's day:\n${contextToText(context)}\n\nThe person says:\n${message}`;

  try {
    const reply = await askModel(ZENO_SYSTEM_PROMPT, userPrompt);
    return NextResponse.json({ state: "ok", reply, model: AI_MODEL });
  } catch (error) {
    console.error("Chat model call failed:", error);
    return NextResponse.json({ state: "model-error" }, { status: 502 });
  }
}
