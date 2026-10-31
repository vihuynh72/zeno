import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { openingPrompt, parseReply, REPLY_SCHEMA, systemPrompt } from "@/lib/agent";
import { aiConfigured, askModel } from "@/lib/ai";
import { ruleOptions } from "@/lib/brief";
import { loadUserContext } from "@/lib/context";
import type { OpeningResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { stepsFinishedBetween } from "@/lib/goals";
import { dayBounds, timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

// The model-written opening and options in one call; the screens show the rule line until it lands.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies OpeningResponse, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies OpeningResponse, { status: 503 });
  }

  const email = session.user.email;
  const firstName = session.user.name?.trim().split(/\s+/)[0] || null;
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const today = dayBounds(timeZone);
  // The last instant before today's midnight falls on the person's yesterday, DST included.
  const yesterday = dayBounds(timeZone, new Date(today.start.getTime() - 1));
  const [context, finished] = await Promise.all([
    loadUserContext(email, session, timeZone),
    databaseConfigured() ? stepsFinishedBetween(email, yesterday.start, yesterday.end).catch(() => []) : [],
  ]);

  try {
    const text = await askModel(
      [
        { role: "system", content: systemPrompt(firstName, context.memories, new Map()) },
        { role: "user", content: openingPrompt(context, firstName, finished) },
      ],
      // Measured live on three days: low averaged 3.5 s to minimal's 2.9 s, for no better lines.
      { effort: "minimal", maxTokens: 2048, schema: REPLY_SCHEMA },
    );
    const reply = parseReply(text);
    if (!reply) throw new Error("Opening reply did not match the schema");
    // Measured live: the model can ask a question and still offer nothing to tap.
    const options = reply.options.length > 0 ? reply.options : ruleOptions(context);
    return NextResponse.json({ state: "ok", opening: reply.say, options } satisfies OpeningResponse);
  } catch (error) {
    // Never log the reply itself: it quotes the person's calendar and email.
    console.error("Opening model call failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies OpeningResponse, { status: 502 });
  }
}
