import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiConfigured, askModel, ZENO_SYSTEM_PROMPT, AI_MODEL } from "@/lib/ai";
import { buildBrief } from "@/lib/brief";
import { contextToText, loadUserContext } from "@/lib/context";
import { timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const context = await loadUserContext(session.user.email, session, timeZone);
  const fallback = buildBrief(context);
  const sources = {
    calendar: context.calendarState,
    email: context.emailState,
    goals: context.tasksState,
  };

  if (!aiConfigured()) {
    return NextResponse.json({ state: "rule", brief: fallback, sources, events: context.events, tasks: context.tasks });
  }

  const userPrompt = [
    "Write today's brief for this person from the context below. Sound like a sharp chief of staff who knows their day, not a counter.",
    "Cover, in this order: the shape of the day with real event times, anything tight or worth preparing for, the one email that most needs a reply if there is one, and how the open goals fit the free gaps.",
    "Name real events, goals, and email subjects. Give clock times. Never invent anything, and never just count items.",
    "Use the current time and never plan for hours that already passed.",
    "Mention only sources that were read. If a source could not be read, say you could not check it instead of calling it clear.",
    "Put three or four short sentences of brief in body, and the single best first action with a time suggestion in firstAction.",
    "",
    contextToText(context),
  ].join("\n");

  try {
    const text = await askModel(
      [
        { role: "system", content: ZENO_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      {
        effort: "low",
        maxTokens: 2048,
        schema: {
          name: "brief",
          schema: {
            type: "object",
            properties: { body: { type: "string" }, firstAction: { type: "string" } },
            required: ["body", "firstAction"],
            additionalProperties: false,
          },
        },
      },
    );
    const reply = JSON.parse(text) as { body?: unknown; firstAction?: unknown };
    if (typeof reply.body !== "string" || !reply.body.trim() || typeof reply.firstAction !== "string") {
      throw new Error("Brief reply did not match the schema");
    }
    const brief = {
      headline: fallback.headline,
      body: reply.body.trim(),
      firstAction: reply.firstAction.trim() || fallback.firstAction,
    };
    return NextResponse.json({ state: "ai", brief, sources, model: AI_MODEL, events: context.events, tasks: context.tasks });
  } catch (error) {
    // A JSON.parse error quotes the reply, which holds the person's calendar and email.
    console.error("Brief model call failed:", error instanceof SyntaxError ? "reply was not JSON" : error);
    return NextResponse.json({ state: "rule", brief: fallback, sources, events: context.events, tasks: context.tasks });
  }
}
