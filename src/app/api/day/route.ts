import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ruleOpening, ruleOptions } from "@/lib/brief";
import { dayEmails, loadUserContext } from "@/lib/context";
import type { DayResponse } from "@/lib/day";
import { databaseConfigured } from "@/lib/db";
import { doneTitles, finishedYesterday, hasAnyGoal, openGoals, recentSteps, stepsDoneSince, titleKey, weekStart } from "@/lib/goals";
import { paceOf } from "@/lib/patterns";
import { accountKey } from "@/lib/session-json";
import { timeZoneFrom, localDate } from "@/lib/tz";

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
  const [context, anyGoal, steps, goals, finished, done, doneThisWeek] = await Promise.all([
    loadUserContext(email, session, timeZone),
    // A failed read counts as having goals, so an error never restarts the first-time setup.
    databaseConfigured() ? hasAnyGoal(email).catch(() => true) : true,
    // shortcut: the pace reads the last 30 days of steps (recentSteps), not the last 20 ever; add a query if month-old steps should count.
    databaseConfigured() ? recentSteps(email).catch(() => []) : [],
    // A failed read leaves goals out, so the screens fall back to the current goal, as for a day saved before Nov 3.
    databaseConfigured() ? openGoals(email).catch(() => undefined) : [],
    databaseConfigured() ? finishedYesterday(email, timeZone).catch(() => []) : [],
    databaseConfigured() ? doneTitles(email, localDate(timeZone)).catch(() => []) : [],
    // The Week's finished steps (Nov 4); a failed read leaves them out, so the Week never says nothing was done.
    databaseConfigured() ? stepsDoneSince(email, weekStart(timeZone)).catch(() => undefined) : [],
  ]);
  const finishedKeys = new Set(done.map(titleKey));

  return NextResponse.json({
    state: "ok",
    // auth() above only returns a session when AUTH_SECRET is set.
    account: accountKey(email, process.env.AUTH_SECRET ?? ""),
    firstName,
    opening: ruleOpening(context, finished),
    openingSource: "rule",
    options: ruleOptions(context),
    goal: context.goal,
    goals,
    doneThisWeek,
    sources: { calendar: context.calendarState, email: context.emailState, goals: context.tasksState },
    events: context.events.map(({ title, start, end, allDay, zeno }) => ({ title, start, end, allDay, zeno })),
    free: context.free,
    deadlines: context.deadlines.filter((deadline) => !finishedKeys.has(titleKey(deadline.title))),
    calendarWrite: context.calendarWrite,
    emails: dayEmails(context.emails, email),
    unreadEmail: context.emails.filter((item) => item.unread).length,
    mailUrl: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`,
    isNew: context.tasksState === "ok" && context.memories.length === 0 && !anyGoal,
    streak: context.progress.streak,
    progress: context.progress,
    pace: paceOf(steps),
  } satisfies DayResponse);
}
