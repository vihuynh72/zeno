import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cleanHeard, newPattern, OPENING_SCHEMA, openingPrompt, parseOpening, systemPrompt, type Refs, withoutRefs } from "@/lib/agent";
import { aiConfigured, askModel } from "@/lib/ai";
import { ruleOpening, ruleOptions } from "@/lib/brief";
import { loadUserContext } from "@/lib/context";
import type { OpeningResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { finishedYesterday } from "@/lib/goals";
import { timeZoneFrom } from "@/lib/tz";
import { cleanPrivate } from "@/lib/vault";

export const maxDuration = 30;

// The model-written line under the home's greeting, and its options, in one call; the home shows the rule line until it
// lands, and the rule line answers when the model fails. The home lists the goals to pick (Vi, Nov 3), so pick is always
// null. POST sends the device's private facts in the body (never the URL; never saved or logged) and the pattern ids its
// openings already named; GET is the same without them. A Canvas list in the body is ignored: the line plans nothing.
export async function GET() {
  return opening([]);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { private?: unknown; heard?: unknown } | null;
  return opening(cleanPrivate(body?.private), cleanHeard(body?.heard));
}

async function opening(privateFacts: string[], heard: string[] = []) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies OpeningResponse, { status: 401 });
  }

  const email = session.user.email;
  const firstName = session.user.name?.trim().split(/\s+/)[0] || null;
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const [context, finished] = await Promise.all([
    loadUserContext(email, session, timeZone),
    databaseConfigured() ? finishedYesterday(email, timeZone).catch(() => []) : [],
  ]);
  // Only the model's opening names it, so only that answer says it was noticed.
  const pattern = newPattern(context.memories, heard, timeZone);
  const rule = () =>
    NextResponse.json({ state: "ok", opening: ruleOpening(context, finished), options: ruleOptions(context), pick: null } satisfies OpeningResponse);
  if (!aiConfigured()) return rule();

  try {
    const refs: Refs = new Map();
    const text = await askModel(
      [
        { role: "system", content: systemPrompt(firstName, context.memories, refs, privateFacts) },
        { role: "user", content: openingPrompt(context, finished, refs, new Date(), pattern?.text) },
      ],
      // Measured live on three days: low averaged 3.5 s to minimal's 2.9 s, for no better lines.
      { effort: "minimal", maxTokens: 2048, schema: OPENING_SCHEMA },
    );
    const reply = parseOpening(text, firstName);
    if (!reply) throw new Error("Opening reply was not JSON, was only a question, or greeted them");
    const options = reply.options.length > 0 ? reply.options : ruleOptions(context);
    return NextResponse.json({ state: "ok", opening: withoutRefs(reply.say, context.goal, refs), options, pick: null, ...(pattern && { noticed: [pattern.id] }) } satisfies OpeningResponse);
  } catch (error) {
    // Never log the reply itself: it quotes the person's calendar and email.
    console.error("Opening model call failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return rule();
  }
}
