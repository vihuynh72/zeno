import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ruleOpening, ruleOptions } from "@/lib/brief";
import { loadUserContext } from "@/lib/context";
import type { DayResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { finishedDays, hasAnyGoal, streakFrom } from "@/lib/goals";
import { accountKey } from "@/lib/session-json";
import { localDate, timeZoneFrom } from "@/lib/tz";

export const maxDuration = 30;

// The first screen: data and rule-written words only, never the model (GET /api/day/opening has its line).
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" } satisfies DayResponse, { status: 401 });
  }

  const email = session.user.email;
  const firstName = session.user.name?.trim().split(/\s+/)[0] || null;
  const timeZone = timeZoneFrom((await cookies()).get("tz")?.value);
  const [context, anyGoal, streak] = await Promise.all([
    loadUserContext(email, session, timeZone),
    // A failed read counts as having goals, so an error never restarts the first-time setup.
    databaseConfigured() ? hasAnyGoal(email).catch(() => true) : true,
    // A failed read shows no streak; the day still loads.
    databaseConfigured() ? finishedDays(email, timeZone).then((days) => streakFrom(days, localDate(timeZone))).catch(() => 0) : 0,
  ]);

  return NextResponse.json({
    state: "ok",
    // auth() above only returns a session when AUTH_SECRET is set.
    account: accountKey(email, process.env.AUTH_SECRET ?? ""),
    firstName,
    opening: ruleOpening(context, firstName),
    openingSource: "rule",
    options: ruleOptions(context),
    goal: context.goal,
    sources: { calendar: context.calendarState, email: context.emailState, goals: context.tasksState },
    events: context.events.map(({ title, start, end, allDay }) => ({ title, start, end, allDay })),
    emails: context.emails.map(({ from, subject, snippet, unread }) => ({ from, subject, snippet, unread })),
    unreadEmail: context.emails.filter((item) => item.unread).length,
    isNew: context.tasksState === "ok" && context.memories.length === 0 && !anyGoal,
    streak,
  } satisfies DayResponse);
}
