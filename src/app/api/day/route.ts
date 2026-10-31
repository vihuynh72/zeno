import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { planText, systemPrompt } from "@/lib/agent";
import { aiConfigured, askModel } from "@/lib/ai";
import { ruleOpening } from "@/lib/brief";
import { dayToText, loadUserContext } from "@/lib/context";
import type { DayResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { stepsFinishedBetween } from "@/lib/goals";
import { dayBounds, timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies DayResponse, { status: 401 });
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

  const day = {
    state: "ok",
    firstName,
    opening: ruleOpening(context, firstName),
    openingSource: "rule",
    options: [],
    goal: context.goal,
    sources: { calendar: context.calendarState, email: context.emailState, goals: context.tasksState },
    events: context.events.map(({ title, start, end, allDay }) => ({ title, start, end, allDay })),
    emails: context.emails.map(({ from, subject, snippet, unread }) => ({ from, subject, snippet, unread })),
    unreadEmail: context.emails.filter((item) => item.unread).length,
    isNew: context.tasksState === "ok" && context.memories.length === 0 && !context.goal,
  } satisfies DayResponse;
  if (!aiConfigured()) {
    return NextResponse.json(day);
  }

  const userPrompt = [
    `Write the line Zeno says when ${firstName ?? "the person"} opens the app: one or two short spoken sentences, at most 30 words, then one soft question.`,
    `Greet them${firstName ? " by first name" : ""} with the right part of the day.`,
    "If they finished a step yesterday or have a goal in progress, mention that first.",
    "Otherwise mention at most one useful thing from today's calendar or inbox (the next event's time, or the one email that needs a reply).",
    "End by offering to pick one thing to move forward.",
    "Never list or count items, never invent anything, never plan for hours that already passed.",
    "",
    dayToText(context),
    ...(finished.length > 0 ? [`Steps they finished yesterday: ${finished.join("; ")}.`] : []),
    planText(context, new Map()),
  ].join("\n");

  try {
    const text = await askModel(
      [
        { role: "system", content: systemPrompt(firstName, context.memories, new Map()) },
        { role: "user", content: userPrompt },
      ],
      {
        effort: "low",
        maxTokens: 2048,
        schema: {
          name: "opening",
          schema: {
            type: "object",
            properties: { say: { type: "string" } },
            required: ["say"],
            additionalProperties: false,
          },
        },
      },
    );
    const say = (JSON.parse(text) as { say?: unknown }).say;
    if (typeof say !== "string" || !say.trim()) {
      throw new Error("Opening reply did not match the schema");
    }
    return NextResponse.json({ ...day, opening: say.trim(), openingSource: "ai" } satisfies DayResponse);
  } catch (error) {
    // A JSON.parse error quotes the reply, which holds the person's calendar and email.
    console.error("Opening model call failed:", error instanceof SyntaxError ? "reply was not JSON" : error);
    return NextResponse.json(day);
  }
}
