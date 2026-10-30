import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { synthesizeSpeech, ttsConfigured } from "@/lib/tts";

export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  if (!ttsConfigured()) {
    return NextResponse.json({ state: "no-key" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  // shortcut: one sentence per request, so only a run-on sentence over 600 characters loses its tail; wrap long sentences in splitSentences if replies get that long
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 600) : "";
  if (!text) {
    return NextResponse.json({ state: "bad-request" }, { status: 400 });
  }

  try {
    const audio = Buffer.from(await synthesizeSpeech(text), "base64");
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (error) {
    console.error("Speech synthesis failed:", error);
    return NextResponse.json({ state: "error" }, { status: 502 });
  }
}
