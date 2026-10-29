import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured, askModel, ZENO_SYSTEM_PROMPT, AI_MODEL } from "@/lib/ai";
import { buildBrief } from "@/lib/brief";
import { contextToText, loadUserContext } from "@/lib/context";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }

  const context = await loadUserContext(session.user.email, session.accessToken);
  const fallback = buildBrief(context.events, context.tasks);

  if (!aiConfigured()) {
    return NextResponse.json({ state: "rule", brief: fallback, events: context.events, tasks: context.tasks });
  }

  const userPrompt = [
    "Write today's brief for this person from the context below. Sound like a sharp chief of staff who knows their day, not a counter.",
    "Cover, in this order: the shape of the day with real event times, anything tight or worth preparing for, the one email that most needs a reply if there is one, and how the open goals fit the free gaps.",
    "Name real events, goals, and email subjects. Give clock times. Never invent anything, and never just count items.",
    "Format: three or four short sentences of brief, then a final line that starts with NEXT: followed by the single best first action with a time suggestion.",
    "",
    contextToText(context),
  ].join("\n");

  try {
    const text = await askModel(ZENO_SYSTEM_PROMPT, userPrompt);
    const match = text.match(/([\s\S]*?)(?:\n|^)NEXT:\s*(.+)$/i);
    const brief = match
      ? { headline: fallback.headline, body: match[1].trim(), firstAction: match[2].trim() }
      : { headline: fallback.headline, body: text, firstAction: fallback.firstAction };
    return NextResponse.json({ state: "ai", brief, model: AI_MODEL, events: context.events, tasks: context.tasks });
  } catch (error) {
    console.error("Brief model call failed:", error);
    return NextResponse.json({ state: "rule", brief: fallback, events: context.events, tasks: context.tasks });
  }
}
