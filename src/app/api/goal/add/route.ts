import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryOf, readGoals, saveGoals } from "@/lib/agent";
import { aiConfigured } from "@/lib/ai";
import { freeSlots } from "@/lib/calendar";
import { APPS } from "@/lib/connect";
import { docLink, readDoc } from "@/lib/connect-apps";
import type { AddGoalResponse, FreeSlot, GoalSource, PlanAnswer } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { cleanMatch, findMatch } from "@/lib/prep";
import { localDate, timeZoneFrom } from "@/lib/tz";

// One model call (a second when a goal was refused for a private detail), then the saves; a lookup's web search (up to
// 10 s) comes first when it finds nothing.
export const maxDuration = 40;

// The calendar gets this long before the plan is made without it.
const CALENDAR_MS = 1000;

// Their answers to Zeno's questions, untrusted: up to 2 pairs of 1 to 120 characters each; anything else is no answer.
// undefined when none were sent (Muse may ask), [] or more when they were (it never asks again).
function cleanAnswers(raw: unknown): PlanAnswer[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const fits = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 120;
  return raw
    .flatMap((item) => (fits(item?.question) && fits(item?.answer) ? [{ question: item.question.trim(), answer: item.answer.trim() }] : []))
    .slice(0, 2);
}

// The app item a goal is made from, untrusted: a known app, an id, an https link and a title, or nothing.
function cleanSource(raw: unknown): GoalSource | null {
  const one = raw as Partial<Record<keyof GoalSource, unknown>> | null;
  const fits = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (!one || !fits(one.app, 20) || ![...APPS, "canvas"].includes(one.app) || !fits(one.id, 200) || !fits(one.url, 1000) || !fits(one.title, 300)) return null;
  if (!one.url.startsWith("https://")) return null;
  return { app: one.app as GoalSource["app"], id: one.id, url: one.url, title: one.title.trim().slice(0, 120) };
}

// Body { text, answers?, source? } (src/lib/day.ts AddGoalRequest): the person's own words become up to 5 goals in one Muse call
// (readGoals in agent.ts): specific titles, due dates read in their time zone, a rhythm for a goal that keeps going, and
// steps that finish the job, paced to this week's free time when their calendar gives it within a second. The first is
// the current plan, the others wait paused in `others`, and `thinking` says what the plan rests on. One goal too vague to
// plan well answers "ask" with Zeno's questions instead (only before `answers`); words naming one real public thing, like
// a hackathon, answer "lookup", then "confirm" with what the web has (day.ts AddGoalRequest). bad-request (422) only when
// the words hold no goal; goals that couldn't be worded without a private detail are an error (502), so the page never
// says there was no goal. Their words reach these calls only and are never logged.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies AddGoalResponse, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown; answers?: unknown; source?: unknown; lookup?: unknown; match?: unknown } | null;
  let text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) {
    return NextResponse.json({ state: "bad-request" } satisfies AddGoalResponse, { status: 400 });
  }
  if (!databaseConfigured() || !aiConfigured()) {
    return NextResponse.json({ state: "error" } satisfies AddGoalResponse, { status: 503 });
  }
  let source = cleanSource(body?.source);
  // A Google Doc's link (Nov 4): its title and first 6000 characters are what the goal is planned from.
  const link = docLink(text);
  if (link) {
    const doc = await readDoc(link.id);
    if (doc.state === "private") return NextResponse.json({ state: "doc-private" } satisfies AddGoalResponse, { status: 422 });
    if (doc.state !== "ok") return NextResponse.json({ state: "error" } satisfies AddGoalResponse, { status: 502 });
    text = `${text.replace(link.link, `the doc "${doc.title}"`)}\n\nThe doc "${doc.title}":\n${doc.text}`;
    source ??= { app: "gdocs", id: link.id, url: doc.url, title: doc.title };
  }

  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const answers = cleanAnswers(body?.answers);
  // "Is this the one?" (Vi, Nov 4): the web query the first call gave, or it with her detail, is searched once; a failed,
  // slow or empty search plans as before, and she never hears about it.
  const lookup = answers === undefined && !source ? queryOf(body?.lookup) : null;
  if (lookup) {
    const found = await findMatch(lookup, localDate(timeZone, new Date())).catch((error) => {
      console.error("Lookup failed:", error instanceof Error ? error.message.split(":")[0].slice(0, 80) : "unknown");
      return null;
    });
    if (found) return NextResponse.json({ state: "confirm", query: lookup, match: found } satisfies AddGoalResponse);
  }
  const match = cleanMatch(body?.match) ?? undefined;
  // Only her first words may look up: not after her answers, an app's item, a search or her reply to one.
  const looks = answers === undefined && !source && body?.lookup === undefined && body?.match === undefined;
  const accessToken = session.error ? undefined : session.accessToken;
  // This week's free time, so the plan can name a real time; a slow or failed read plans without it.
  const free: FreeSlot[] = accessToken
    ? await Promise.race([
        freeSlots(accessToken, timeZone, { minutes: 20, days: 7 }).catch(() => []),
        new Promise<FreeSlot[]>((resolve) => setTimeout(() => resolve([]), CALENDAR_MS)),
      ])
    : [];
  const read = await readGoals(text, timeZone, new Date(), { answers, free, looks, match }).catch((error) => {
    // The words before the first colon only: what an API error adds after it can echo the request.
    console.error("Add goal model call failed:", error instanceof Error ? error.message.split(":")[0].slice(0, 80) : "unknown");
    return undefined;
  });
  if (read === undefined) {
    return NextResponse.json({ state: "error" } satisfies AddGoalResponse, { status: 502 });
  }
  if (read.lookup) {
    return NextResponse.json({ state: "lookup", query: read.lookup } satisfies AddGoalResponse);
  }
  if (read.ask.length > 0) {
    return NextResponse.json({ state: "ask", questions: read.ask } satisfies AddGoalResponse);
  }
  if (read.goals.length === 0) {
    return NextResponse.json({ state: "bad-request" } satisfies AddGoalResponse, { status: 422 });
  }
  try {
    const web: GoalSource | null = match ? { app: "web", id: match.url, url: match.url, title: match.title } : null;
    const { goal, others } = await saveGoals(session.user.email, read.goals, source ?? web);
    return NextResponse.json({ state: "ok", goal, others, thinking: read.thinking } satisfies AddGoalResponse);
  } catch (error) {
    console.error("Add goal save failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return NextResponse.json({ state: "error" } satisfies AddGoalResponse, { status: 500 });
  }
}
