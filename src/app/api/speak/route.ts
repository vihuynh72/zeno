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

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ state: "bad-request" }, { status: 400 });
  }

  try {
    const audioContent = await synthesizeSpeech(text);
    return NextResponse.json({ state: "ok", audioContent, voice: "Google Chirp HD" });
  } catch (error) {
    console.error("Speech synthesis failed:", error);
    return NextResponse.json({ state: "error" }, { status: 502 });
  }
}
