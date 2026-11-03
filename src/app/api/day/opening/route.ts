import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cleanCanvas, OPENING_SCHEMA, openingPrompt, parseOpening, systemPrompt, type Refs } from "@/lib/agent";
import { aiConfigured, askModel } from "@/lib/ai";
import { ruleOpening, ruleOptions, rulePick } from "@/lib/brief";
import { loadUserContext } from "@/lib/context";
import type { CanvasBrief, OpeningResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { stepsFinishedBetween } from "@/lib/goals";
import { dayBounds, localDate, timeZoneFrom } from "@/lib/tz";
import { cleanPrivate } from "@/lib/vault";

export const maxDuration = 30;

// The model-written opening, options and first-card pick in one call; the screens show the rule line until it
// lands. When the model fails, the rule line and rule pick answer instead, so the first card always has one thing.
// POST sends the device's private facts and Canvas briefs in the body (never the URL; never saved or logged); GET is the
// same without them.
export async function GET() {
  return opening([], []);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { private?: unknown; canvas?: unknown } | null;
  return opening(cleanPrivate(body?.private), cleanCanvas(body?.canvas));
}

async function opening(privateFacts: string[], canvas: CanvasBrief[]) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies OpeningResponse, { status: 401 });
  }

  const email = session.user.email;
  const firstName = session.user.name?.trim().split(/\s+/)[0] || null;
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const today = dayBounds(timeZone);
  // The last instant before today's midnight falls on the person's yesterday, DST included.
  const yesterday = dayBounds(timeZone, new Date(today.start.getTime() - 1));
  const [loaded, finished] = await Promise.all([
    loadUserContext(email, session, timeZone),
    databaseConfigured() ? stepsFinishedBetween(email, yesterday.start, yesterday.end).catch(() => []) : [],
  ]);
  const context = { ...loaded, canvas };
  const rule = () =>
    NextResponse.json({
      state: "ok",
      opening: ruleOpening(context, firstName),
      options: ruleOptions(context),
      pick: rulePick(context),
    } satisfies OpeningResponse);
  if (!aiConfigured()) return rule();

  try {
    const refs: Refs = new Map();
    const text = await askModel(
      [
        { role: "system", content: systemPrompt(firstName, context.memories, refs, privateFacts) },
        { role: "user", content: openingPrompt(context, firstName, finished, refs) },
      ],
      // Measured live on three days: low averaged 3.5 s to minimal's 2.9 s, for no better lines.
      { effort: "minimal", maxTokens: 2048, schema: OPENING_SCHEMA },
    );
    const reply = parseOpening(text, context.goal, refs, localDate(timeZone));
    if (!reply) throw new Error("Opening reply did not match the schema");
    // A pick that fails the checks gets the rule card and the rule line that names it, never words about something else.
    if (!reply.pick && rulePick(context)) return rule();
    // Measured live: the model can ask a question and still offer nothing to tap.
    const options = reply.options.length > 0 ? reply.options : ruleOptions(context);
    return NextResponse.json({ state: "ok", opening: reply.say, options, pick: reply.pick } satisfies OpeningResponse);
  } catch (error) {
    // Never log the reply itself: it quotes the person's calendar and email.
    console.error("Opening model call failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return rule();
  }
}
