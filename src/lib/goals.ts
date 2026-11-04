import { MEMORY_GROUPS, type DoneStep, type Goal, type Memory, type MemoryGroup, type MemorySource, type PrepSource, type StepStatus } from "@/lib/day";
import { ensureSchema, getSql } from "@/lib/db";
// profile.ts imports this file too; neither uses the other until a call, so the cycle is safe.
import { factVerdict } from "@/lib/profile";
import { dayBounds, formatDate, localDate } from "@/lib/tz";
import { sameFact, within } from "@/lib/vault";

// A step for a new or edited roadmap; `id` keeps an existing todo step.
export type NewStep = { id?: string; title: string; minutes: number | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres throws on a malformed uuid, so routes check the shape before querying.
export function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

// One row per step, or one row with null step columns when the goal has no steps.
function goalFrom(rows: Record<string, unknown>[]): Goal | null {
  if (rows.length === 0) return null;
  return {
    id: String(rows[0].goal_id),
    title: String(rows[0].goal_title),
    due: rows[0].goal_due ? String(rows[0].goal_due) : null,
    rhythm: rows[0].goal_rhythm ? String(rows[0].goal_rhythm) : null,
    steps: rows
      .filter((row) => row.id !== null)
      .map((row) => ({
        id: String(row.id),
        title: String(row.title),
        minutes: row.minutes === null ? null : Number(row.minutes),
        status: row.status as StepStatus,
        startedAt: iso(row.started_at),
        doneAt: iso(row.done_at),
        // Checked by sourcesFrom before it was stored.
        prep: (row.prep as PrepSource[] | null) ?? null,
        scheduledAt: iso(row.scheduled_at),
        eventId: row.event_id ? String(row.event_id) : null,
      })),
  };
}

function goalQuery(email: string, goalId: string) {
  return getSql()`
    SELECT g.id AS goal_id, g.title AS goal_title, to_char(g.due, 'YYYY-MM-DD') AS goal_due, g.rhythm AS goal_rhythm,
      s.id, s.title, s.minutes, s.status, s.started_at, s.done_at, s.prep, s.event_id, s.scheduled_at
    FROM goals g LEFT JOIN steps s ON s.goal_id = g.id AND s.user_email = ${email}
    WHERE g.id = ${goalId} AND g.user_email = ${email}
    ORDER BY s.position
  `;
}

export async function currentGoal(email: string): Promise<Goal | null> {
  await ensureSchema();
  const [goal] = await getSql()`
    SELECT id FROM goals WHERE user_email = ${email} AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `;
  return goal ? goalFrom(await goalQuery(email, String(goal.id))) : null;
}

// An open plan before ordering: current is the plan currentGoal returns, updatedAt its updated_at in epoch ms.
export type OpenGoal = { goal: Goal; current: boolean; updatedAt: number };

// The home's goal options, the Desk and the Week (Vi, Nov 3): the current plan first, then by due date with undated
// ones last, then the most recently updated. Every one of them: the goals panel lists them all, and adding a goal checks
// them for its twin (Nov 4: with a cap of 5, a 6th goal was made twice).
export function orderGoals(open: OpenGoal[]): Goal[] {
  return [...open]
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        Number(!a.goal.due) - Number(!b.goal.due) ||
        (a.goal.due ?? "").localeCompare(b.goal.due ?? "") ||
        b.updatedAt - a.updatedAt,
    )
    .map((item) => item.goal);
}

// A plan title as two screens compare it: lowercase, every run of other characters one space (as day-flow's sameTitle).
export const titleKey = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Plans finished before their due date (today or later, on the person's clock): their deadline is done, so the home, the
// Desk and the Week stop offering it as "not started" (found in review, Nov 3).
export async function doneTitles(email: string, today: string): Promise<string[]> {
  await ensureSchema();
  const rows = await getSql()`SELECT title FROM goals WHERE user_email = ${email} AND status = 'done' AND due >= ${today}`;
  return rows.map((row) => String(row.title));
}

// Every active or paused plan with a todo or doing step, and every one that keeps going (rhythm) even with none left
// (its next few are planned when it opens), with its steps, in orderGoals' order.
export async function openGoals(email: string): Promise<Goal[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT g.id AS goal_id, g.title AS goal_title, to_char(g.due, 'YYYY-MM-DD') AS goal_due, g.rhythm AS goal_rhythm, g.updated_at AS goal_updated,
      g.id = (SELECT id FROM goals WHERE user_email = ${email} AND status = 'active' ORDER BY created_at DESC LIMIT 1) AS goal_current,
      s.id, s.title, s.minutes, s.status, s.started_at, s.done_at, s.prep, s.event_id, s.scheduled_at
    FROM goals g JOIN steps s ON s.goal_id = g.id AND s.user_email = ${email}
    WHERE g.user_email = ${email} AND g.status IN ('active', 'paused')
      AND (g.rhythm IS NOT NULL OR EXISTS (SELECT 1 FROM steps o WHERE o.goal_id = g.id AND o.user_email = ${email} AND o.status IN ('todo', 'doing')))
    ORDER BY g.id, s.position
  `;
  const groups = Map.groupBy(rows, (row) => String(row.goal_id));
  return orderGoals(
    [...groups.values()].map((group) => ({
      goal: goalFrom(group) as Goal,
      current: group[0].goal_current === true,
      updatedAt: new Date(group[0].goal_updated as string).getTime(),
    })),
  );
}

// Opening a plan makes it the current one (Vi, Nov 3). One transaction pauses the current plan, when it is another one,
// and activates this one; a goal that is not this person's, is done or was removed changes nothing and returns null.
export async function activateGoal(email: string, goalId: string): Promise<Goal | null> {
  await ensureSchema();
  const sql = getSql();
  const results = await sql.transaction([
    // One step at a time across plans too: a step left running in another plan goes back in line, as Stop for now leaves it.
    sql`
      UPDATE steps SET status = 'todo', started_at = NULL
      WHERE user_email = ${email} AND status = 'doing' AND goal_id <> ${goalId}
        AND EXISTS (SELECT 1 FROM goals WHERE id = ${goalId} AND user_email = ${email} AND status IN ('active', 'paused'))
    `,
    sql`
      UPDATE goals SET status = 'paused', updated_at = now()
      WHERE user_email = ${email} AND status = 'active' AND id <> ${goalId}
        AND EXISTS (SELECT 1 FROM goals WHERE id = ${goalId} AND user_email = ${email} AND status IN ('active', 'paused'))
    `,
    sql`UPDATE goals SET status = 'active', updated_at = now() WHERE id = ${goalId} AND user_email = ${email} AND status IN ('active', 'paused') RETURNING id`,
    goalQuery(email, goalId),
  ]);
  return results[2].length > 0 ? goalFrom(results[3]) : null;
}

// With no goal left active, the most recently paused one comes back where it was left.
const wakeLatest = (email: string) => getSql()`
  UPDATE goals SET status = 'active', updated_at = now()
  WHERE id = (
    SELECT id FROM goals WHERE user_email = ${email} AND status = 'paused'
    ORDER BY updated_at DESC, created_at DESC LIMIT 1
  ) AND NOT EXISTS (SELECT 1 FROM goals WHERE user_email = ${email} AND status = 'active')
`;

// Remove and Mark done (Nov 4, Vi: "no simple delete goal"), each only on the person's tap. Remove keeps the goal as
// 'removed', out of every list and count, so Undo (restoreGoal) brings it back as it was; a step running in it goes back
// in line. Mark done finishes it, a goal that keeps going too, and closes its open steps as skipped with no done_at, so
// no pattern reads them as skips. Either way, when it was the current goal the most recently paused one becomes current,
// as when a goal's last step finishes it. Returns the current goal after; undefined when the goal is not theirs or open.
export async function closeGoal(email: string, goalId: string, how: "removed" | "done"): Promise<{ current: Goal | null } | undefined> {
  await ensureSchema();
  const sql = getSql();
  const [, closed] = await sql.transaction([
    how === "done"
      ? sql`
          UPDATE steps SET status = 'skipped', done_at = NULL
          WHERE goal_id = ${goalId} AND user_email = ${email} AND status IN ('todo', 'doing')
            AND EXISTS (SELECT 1 FROM goals WHERE id = ${goalId} AND user_email = ${email} AND status IN ('active', 'paused'))
        `
      : sql`UPDATE steps SET status = 'todo', started_at = NULL WHERE goal_id = ${goalId} AND user_email = ${email} AND status = 'doing'`,
    sql`UPDATE goals SET status = ${how}, updated_at = now() WHERE id = ${goalId} AND user_email = ${email} AND status IN ('active', 'paused') RETURNING title`,
    wakeLatest(email),
  ]);
  if (closed.length === 0) return undefined;
  if (how === "done") await dropTodoOf(email, String(closed[0].title));
  return { current: await currentGoal(email) };
}

// Undo for Remove: the goal is back in their lists, paused, with its steps as they were, and current when no goal is.
// null when it is not theirs or was not removed.
export async function restoreGoal(email: string, goalId: string): Promise<{ goal: Goal; current: Goal | null } | null> {
  await ensureSchema();
  const sql = getSql();
  const [restored, , rows] = await sql.transaction([
    sql`UPDATE goals SET status = 'paused', updated_at = now() WHERE id = ${goalId} AND user_email = ${email} AND status = 'removed' RETURNING id`,
    wakeLatest(email),
    goalQuery(email, goalId),
  ]);
  const goal = restored.length > 0 ? goalFrom(rows) : null;
  return goal && { goal, current: await currentGoal(email) };
}

// Any goal at all, paused, done and removed ones included.
export async function hasAnyGoal(email: string): Promise<boolean> {
  await ensureSchema();
  return (await getSql()`SELECT 1 FROM goals WHERE user_email = ${email} LIMIT 1`).length > 0;
}

// due is YYYY-MM-DD, checked by the caller; rhythm marks a goal that keeps going ("3 runs a week"). A paused goal waits
// in their list (the second and third goal of one message, Nov 4) and leaves the current one current.
export async function setGoal(
  email: string,
  title: string,
  steps: NewStep[],
  due: string | null = null,
  { rhythm = null, paused = false }: { rhythm?: string | null; paused?: boolean } = {},
): Promise<Goal> {
  await ensureSchema();
  const sql = getSql();
  const goalId = crypto.randomUUID();
  const results = await sql.transaction([
    // One goal at a time: the old one is paused, not lost, and a step left running there goes back in line, as
    // activateGoal does.
    ...(paused
      ? []
      : [
          sql`UPDATE steps SET status = 'todo', started_at = NULL WHERE user_email = ${email} AND status = 'doing'`,
          sql`UPDATE goals SET status = 'paused', updated_at = now() WHERE user_email = ${email} AND status = 'active'`,
        ]),
    sql`
      INSERT INTO goals (id, user_email, title, due, rhythm, status)
      VALUES (${goalId}, ${email}, ${title}, ${due}, ${rhythm}, ${paused ? "paused" : "active"})
    `,
    ...steps.map(
      (step, index) => sql`
        INSERT INTO steps (goal_id, user_email, title, minutes, position)
        VALUES (${goalId}, ${email}, ${step.title}, ${step.minutes}, ${index})
      `,
    ),
    goalQuery(email, goalId),
  ]);
  return goalFrom(results[results.length - 1]) as Goal;
}

// Started, done and skipped steps stay untouched and first; `steps` becomes the todo list, in order.
export async function replaceRemainingSteps(email: string, goalId: string, steps: NewStep[]): Promise<Goal | null> {
  await ensureSchema();
  const sql = getSql();
  const [goal] = await sql`
    SELECT (SELECT max(position) FROM steps WHERE goal_id = g.id AND user_email = ${email}) AS last
    FROM goals g WHERE g.id = ${goalId} AND g.user_email = ${email}
  `;
  if (!goal) return null;
  // Every new position is past every old one, so the steps that stay keep their place up front.
  const start = goal.last === null ? 0 : Number(goal.last) + 1;
  const keep = steps.flatMap((step) => (step.id ? [step.id] : []));
  const results = await sql.transaction([
    sql`
      DELETE FROM steps
      WHERE goal_id = ${goalId} AND user_email = ${email} AND status = 'todo' AND NOT (id = ANY(${keep}::uuid[]))
    `,
    ...steps.map((step, index) =>
      step.id
        ? sql`
            UPDATE steps SET title = ${step.title}, minutes = ${step.minutes}, position = ${start + index},
              -- Sources found for the old title do not fit a renamed step.
              prep = CASE WHEN title = ${step.title} THEN prep END
            WHERE id = ${step.id} AND goal_id = ${goalId} AND user_email = ${email} AND status = 'todo'
          `
        : sql`
            INSERT INTO steps (goal_id, user_email, title, minutes, position)
            VALUES (${goalId}, ${email}, ${step.title}, ${step.minutes}, ${start + index})
          `,
    ),
    // New todo steps reopen a finished goal; a paused one stays paused. A goal that keeps going and was finished before
    // Nov 4 (changeStepStatus never finishes one now) comes back paused while another goal is current, so planning its
    // next few never changes the current goal.
    sql`
      UPDATE goals SET updated_at = now(), status = CASE
          WHEN status <> 'done' THEN status
          WHEN rhythm IS NOT NULL AND EXISTS (SELECT 1 FROM goals WHERE user_email = ${email} AND status = 'active') THEN 'paused'
          ELSE 'active' END
      WHERE id = ${goalId} AND user_email = ${email}
    `,
    goalQuery(email, goalId),
  ]);
  return goalFrom(results[results.length - 1]);
}

// One of the person's goals, any status; null when it is not theirs.
export async function getGoal(email: string, goalId: string): Promise<Goal | null> {
  await ensureSchema();
  return goalFrom(await goalQuery(email, goalId));
}

// One new todo step right before `beforeId` (a step of this goal), or after the last step when null; every other step
// keeps its title, status and order (Make it smaller, Nov 4: a first piece before the step, never a rewrite). A running
// step hands its clock to the new piece and goes back in line, so the timer keeps running on the piece. null when the
// goal or that step is not theirs.
export async function insertStep(email: string, goalId: string, step: NewStep, beforeId: string | null = null): Promise<Goal | null> {
  await ensureSchema();
  const sql = getSql();
  const [found] = await sql`
    SELECT b.position AS target, (SELECT max(position) FROM steps WHERE goal_id = g.id AND user_email = ${email}) AS last
    FROM goals g LEFT JOIN steps b ON b.id = ${beforeId} AND b.goal_id = g.id AND b.user_email = ${email}
    WHERE g.id = ${goalId} AND g.user_email = ${email}
  `;
  if (!found || (beforeId && found.target === null)) return null;
  const position = beforeId ? Number(found.target) : found.last === null ? 0 : Number(found.last) + 1;
  const results = await sql.transaction([
    sql`UPDATE steps SET position = position + 1 WHERE goal_id = ${goalId} AND user_email = ${email} AND position >= ${position}`,
    sql`
      INSERT INTO steps (goal_id, user_email, title, minutes, position, status, started_at)
      SELECT ${goalId}, ${email}, ${step.title}, ${step.minutes}, ${position},
        CASE WHEN b.status = 'doing' THEN 'doing' ELSE 'todo' END, CASE WHEN b.status = 'doing' THEN b.started_at END
      FROM (SELECT 1) one LEFT JOIN steps b ON b.id = ${beforeId} AND b.user_email = ${email}
    `,
    sql`UPDATE steps SET status = 'todo', started_at = NULL WHERE id = ${beforeId} AND user_email = ${email} AND status = 'doing'`,
    // A new todo step reopens a finished goal, as replaceRemainingSteps does.
    sql`
      UPDATE goals SET updated_at = now(), status = CASE WHEN status = 'done' THEN 'active' ELSE status END
      WHERE id = ${goalId} AND user_email = ${email}
    `,
    goalQuery(email, goalId),
  ]);
  return goalFrom(results[results.length - 1]);
}

// A goal's due date (YYYY-MM-DD, checked by the caller), or none; null when the goal is not theirs.
export async function setGoalDue(email: string, goalId: string, due: string | null): Promise<Goal | null> {
  await ensureSchema();
  const sql = getSql();
  const [updated, rows] = await sql.transaction([
    sql`UPDATE goals SET due = ${due}, updated_at = now() WHERE id = ${goalId} AND user_email = ${email} RETURNING id`,
    goalQuery(email, goalId),
  ]);
  return updated.length > 0 ? goalFrom(rows) : null;
}

// A goal's own title or rhythm (checked by the caller), as setGoalDue sets its due date: one left out (undefined) stays,
// and a null rhythm clears it, so the goal ends once its steps are done. null when the goal is not theirs.
export async function editGoal(email: string, goalId: string, edit: { title?: string; rhythm?: string | null }): Promise<Goal | null> {
  await ensureSchema();
  const sql = getSql();
  const [updated, rows] = await sql.transaction([
    sql`
      UPDATE goals SET title = coalesce(${edit.title ?? null}, title),
        rhythm = CASE WHEN ${edit.rhythm === undefined} THEN rhythm ELSE ${edit.rhythm ?? null} END, updated_at = now()
      WHERE id = ${goalId} AND user_email = ${email} RETURNING id
    `,
    goalQuery(email, goalId),
  ]);
  return updated.length > 0 ? goalFrom(rows) : null;
}

// Monday 00:00 of this week on the person's clock, a day at a time so a DST change is kept.
export function weekStart(timeZone: string, now = new Date()): Date {
  let start = dayBounds(timeZone, now).start;
  while (new Date(`${localDate(timeZone, start)}T00:00:00Z`).getUTCDay() !== 1) start = dayBounds(timeZone, new Date(start.getTime() - 1)).start;
  return start;
}

// The Week's finished steps (Nov 4): done since `since`, newest first, at most 50. minutes is the real time from Start to
// Done when it was timed (1 minute to 6 hours, as paceOf counts it), else null.
export async function stepsDoneSince(email: string, since: Date): Promise<DoneStep[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT s.title, g.title AS goal, s.started_at, s.done_at
    FROM steps s JOIN goals g ON g.id = s.goal_id AND g.user_email = ${email} AND g.status <> 'removed'
    WHERE s.user_email = ${email} AND s.status = 'done' AND s.done_at >= ${since.toISOString()} AND s.done_at <= now()
    ORDER BY s.done_at DESC LIMIT 50
  `;
  return rows.map((row) => {
    const doneAt = iso(row.done_at) as string;
    const real = row.started_at ? (Date.parse(doneAt) - Date.parse(iso(row.started_at) as string)) / 60_000 : NaN;
    return { title: String(row.title), goal: String(row.goal), doneAt, minutes: real > 0 && real <= 360 ? Math.max(1, Math.round(real)) : null };
  });
}

export async function setStepStatus(email: string, stepId: string, status: StepStatus): Promise<Goal | null> {
  return (await changeStepStatus(email, stepId, status))?.goal ?? null;
}

// setStepStatus, plus the status the step had before, so a route can tell a new finish from a repeated tap.
export async function changeStepStatus(
  email: string,
  stepId: string,
  status: StepStatus,
): Promise<{ goal: Goal; before: StepStatus } | null> {
  await ensureSchema();
  const sql = getSql();
  // A removed goal's steps wait as they are for an Undo: a stale page or an app never changes them, or brings it back.
  const [step] = await sql`
    SELECT s.goal_id, s.status FROM steps s JOIN goals g ON g.id = s.goal_id
    WHERE s.id = ${stepId} AND s.user_email = ${email} AND g.status <> 'removed'
  `;
  if (!step) return null;
  const goalId = String(step.goal_id);
  const results = await sql.transaction([
    // One step at a time: starting this one puts any other started step back in line.
    ...(status === "doing"
      ? [
          sql`
            UPDATE steps SET status = 'todo', started_at = NULL
            WHERE goal_id = ${goalId} AND user_email = ${email} AND status = 'doing' AND id <> ${stepId}
          `,
        ]
      : []),
    // Start always restarts the timer (a step left running yesterday opens fresh); a repeated Done or Skip keeps
    // the first finish, so the streak's days stay true.
    sql`
      UPDATE steps SET
        status = ${status},
        started_at = CASE WHEN ${status} = 'doing' THEN now() WHEN ${status} = 'todo' THEN NULL ELSE started_at END,
        done_at = CASE WHEN ${status} IN ('done', 'skipped') THEN
          CASE WHEN status = ${status} THEN coalesce(done_at, now()) ELSE now() END END
      WHERE id = ${stepId} AND user_email = ${email}
        -- Back to todo only from running: a stale page (its step was finished from the Mac clock or an MCP app) never
        -- unfinishes it (found in review, Nov 3).
        AND (${status} <> 'todo' OR status = 'doing')
    `,
    // Nothing left to do finishes the goal, a paused one too (a step finished from an app while another plan was
    // current); reopening a step brings it back. A paused goal with steps left stays paused, untouched. A goal that keeps
    // going (rhythm) never finishes by running out of steps: it keeps its status until its next few are planned, so it
    // never drops out of their lists (Nov 4).
    sql`
      UPDATE goals SET
        status = CASE
          WHEN NOT EXISTS (SELECT 1 FROM steps WHERE goal_id = ${goalId} AND user_email = ${email} AND status IN ('todo', 'doing'))
            THEN CASE WHEN rhythm IS NULL THEN 'done' ELSE status END
          WHEN status = 'paused' THEN 'paused'
          ELSE 'active' END,
        updated_at = CASE
          WHEN status = 'paused' AND EXISTS (SELECT 1 FROM steps WHERE goal_id = ${goalId} AND user_email = ${email} AND status IN ('todo', 'doing'))
            THEN updated_at
          ELSE now() END
      WHERE id = ${goalId} AND user_email = ${email}
    `,
    wakeLatest(email),
    goalQuery(email, goalId),
  ]);
  const goal = goalFrom(results[results.length - 1]);
  // A goal that keeps going never finishes by its steps.
  if (goal && !goal.rhythm && status === "done" && goal.steps.every((one) => one.status === "done" || one.status === "skipped")) {
    await dropTodoOf(email, goal.title);
  }
  return goal && { goal, before: step.status as StepStatus };
}

// A finished plan finishes the pasted to-do it came from: one the plan's title says all of, never a longer one ("Email
// Prof Patel" finishes neither "…about an extension" nor "…my project group").
async function dropTodoOf(email: string, title: string) {
  const todos = await getSql()`SELECT id, text FROM memories WHERE user_email = ${email} AND text LIKE 'To do: %'`;
  await dropMemories(email, todos.filter((row) => within(String(row.text), todoMemory(title))).map((row) => String(row.id)));
}

// Links a step to its block on the Zeno calendar (the event id and the block's start); nulls clear the link.
export async function setStepSchedule(email: string, stepId: string, eventId: string | null, scheduledAt: string | null): Promise<boolean> {
  await ensureSchema();
  const rows = await getSql()`
    UPDATE steps SET event_id = ${eventId}, scheduled_at = ${scheduledAt}
    WHERE id = ${stepId} AND user_email = ${email} RETURNING id
  `;
  return rows.length > 0;
}

// The step's title and its goal's: the only words the prep search ever sees.
export async function stepTitles(email: string, stepId: string): Promise<{ goal: string; step: string } | null> {
  await ensureSchema();
  const [row] = await getSql()`
    SELECT g.title AS goal, s.title AS step
    FROM steps s JOIN goals g ON g.id = s.goal_id AND g.user_email = ${email}
    WHERE s.id = ${stepId} AND s.user_email = ${email}
  `;
  return row ? { goal: String(row.goal), step: String(row.step) } : null;
}

// Only the latest search is kept.
export async function savePrep(email: string, stepId: string, sources: PrepSource[]) {
  await ensureSchema();
  await getSql()`UPDATE steps SET prep = ${JSON.stringify(sources)}::jsonb WHERE id = ${stepId} AND user_email = ${email}`;
}

const SOURCES: readonly MemorySource[] = ["you", "calendar", "email", "pattern", "canvas"];

function memoryFrom(row: Record<string, unknown>): Memory {
  const group = MEMORY_GROUPS.find((known) => known === row.memory_group) ?? "about";
  const source = SOURCES.find((known) => known === row.source) ?? "you";
  return { id: String(row.id), text: String(row.text), createdAt: new Date(row.created_at as string).toISOString(), group, source };
}

// The grouped profile keeps about 120 facts; each group keeps its freshest (docs/PLAN-NOV.md).
export const GROUP_CAPS: Record<MemoryGroup, number> = {
  about: 15,
  routines: 25,
  projects: 25,
  interests: 15,
  people: 15,
  "work-style": 15,
  patterns: 10,
};
const TOTAL_CAP = 120;

// Case, punctuation and spacing never make a new fact: "Bio lab Wednesdays at 2pm." is "bio lab wednesdays at 2 PM".
// One space stays between words and numbers, so "due 11/2" is not "due 1/12".
export function factKey(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Grouped in the order Memory shows them, newest first within a group. A deadline memory is hidden once its
// expires_on (the day after the due date) has begun at UTC-12, the last place a day ends, so it never vanishes on
// its due day in any zone. A row the two lists (src/lib/profile.ts factVerdict) say the server must not hold, saved
// under older rules (health "when it helps planning"), is deleted here, never listed, never sent to a prompt.
// shortcut: deleted, not handed to the device; return them once as `private` if people miss them.
export async function listMemories(email: string): Promise<Memory[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (
    await sql`
      SELECT id, text, created_at, memory_group, source FROM memories
      WHERE user_email = ${email} AND (expires_on IS NULL OR expires_on > (now() AT TIME ZONE 'UTC' - interval '12 hours')::date)
      ORDER BY array_position(${[...MEMORY_GROUPS]}::text[], memory_group), created_at DESC
    `
  ).map(memoryFrom);
  // The person's own words skip the instructions guard, as when they were saved: "To do: Read the lab instructions".
  const banned = rows.filter((memory) => factVerdict(memory.text, { own: memory.source === "you" })).map((memory) => memory.id);
  if (banned.length > 0) await sql`DELETE FROM memories WHERE user_email = ${email} AND id = ANY(${banned}::uuid[])`;
  return rows.filter((memory) => !banned.includes(memory.id));
}

// A to-do, a deadline (deadlineMemory's ", due Friday, November 6." ending) or any other fact.
const kindOf = (text: string) => (text.startsWith(todoMemory("")) ? "todo" : /, due \w+, \w+ \d+\.$/.test(text) ? "deadline" : "fact");

// Returns the saved memory, or null when nothing new was saved (so callers never claim a save): the fact is
// already known word for word in any group, or Zeno found it itself (not "you") and the person once removed it or it
// is known reworded (src/lib/vault.ts sameFact). A longer wording of the same kind in the same group takes that row,
// text and source, except that what Zeno found never overwrites the person's own words. expiresOn (YYYY-MM-DD,
// checked by the caller) hides it from that day on, as listMemories says; an undated "To do:" clears itself 14 days
// after it is saved.
export async function addMemory(
  email: string,
  text: string,
  { group = "about", source = "you", expiresOn = null }: { group?: MemoryGroup; source?: MemorySource; expiresOn?: string | null } = {},
): Promise<Memory | null> {
  await ensureSchema();
  const sql = getSql();
  const clean = [...text.trim()].slice(0, 200).join("");
  const key = factKey(clean);
  if (!key) return null;
  // shortcut: read, then write, so the same fact saved twice in one instant can land twice; add a unique key column if that shows up.
  // Expired rows are deleted here, on the way, so they never count as known or take a cap's slot. A removed sentence
  // has no id.
  const known = await sql`
    WITH expired AS (
      DELETE FROM memories
      WHERE user_email = ${email} AND expires_on <= (now() AT TIME ZONE 'UTC' - interval '12 hours')::date
      RETURNING id
    )
    SELECT id, text, source, memory_group FROM memories WHERE user_email = ${email} AND id NOT IN (SELECT id FROM expired)
    UNION ALL
    SELECT NULL, jsonb_array_elements_text(forgotten), NULL, NULL FROM user_state WHERE user_email = ${email} AND ${source} <> 'you'
  `;
  // A fact is never the same as a to-do or a deadline, whatever words they share.
  const same = known.filter((row) => kindOf(String(row.text)) === kindOf(clean) && sameFact(String(row.text), clean));
  if (same.some((row) => row.id === null || factKey(String(row.text)) === key)) return null;
  const expires = expiresOn ?? (kindOf(clean) === "todo" ? new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10) : null);
  const longer = same.find(
    (row) =>
      row.memory_group === group &&
      factKey(String(row.text)).length < key.length &&
      within(String(row.text), clean) &&
      !(row.source === "you" && source !== "you"),
  );
  if (longer) {
    const [updated] = await sql`
      UPDATE memories SET text = ${clean}, source = ${source}, expires_on = coalesce(${expiresOn}, expires_on, ${expires})
      WHERE id = ${longer.id} AND user_email = ${email}
      RETURNING id, text, created_at, memory_group, source
    `;
    return updated ? memoryFrom(updated) : null;
  }
  // What Zeno finds again in other words adds nothing; what the person says is always kept ("with music" is not
  // "without music").
  if (source !== "you" && same.length > 0) return null;
  const [inserted, groupTrim, totalTrim] = await sql.transaction([
    sql`
      INSERT INTO memories (user_email, text, memory_group, source, expires_on)
      VALUES (${email}, ${clean}, ${group}, ${source}, ${expires})
      ON CONFLICT DO NOTHING
      RETURNING id, text, created_at, memory_group, source
    `,
    // Each group keeps its freshest scanned and noticed facts; what the person said never takes their slots.
    sql`
      DELETE FROM memories WHERE id IN (
        SELECT id FROM memories WHERE user_email = ${email} AND memory_group = ${group} AND source <> 'you'
        ORDER BY created_at DESC OFFSET ${GROUP_CAPS[group]}
      ) RETURNING id
    `,
    // The whole profile stays small enough for every prompt; the person's own words go last.
    sql`
      DELETE FROM memories WHERE id IN (
        SELECT id FROM memories WHERE user_email = ${email}
        ORDER BY source = 'you' DESC, created_at DESC OFFSET ${TOTAL_CAP}
      ) RETURNING id
    `,
  ]);
  const row = inserted[0];
  const trimmed = [...groupTrim, ...totalTrim].some((gone) => row && gone.id === row.id);
  return row && !trimmed ? memoryFrom(row) : null;
}

// The removed sentence is kept out of sight in user_state.forgotten, so a later scan never learns it again.
// shortcut: the list grows by one per removal and is never trimmed; cap it if anyone removes thousands.
export async function forgetMemory(email: string, id: string): Promise<boolean> {
  await ensureSchema();
  const rows = await getSql()`
    WITH gone AS (DELETE FROM memories WHERE id = ${id} AND user_email = ${email} RETURNING text)
    INSERT INTO user_state (user_email, forgotten) SELECT ${email}, jsonb_build_array(gone.text) FROM gone
    ON CONFLICT (user_email) DO UPDATE
      SET forgotten = coalesce(user_state.forgotten, '[]'::jsonb) || EXCLUDED.forgotten, updated_at = now()
    RETURNING user_email
  `;
  return rows.length > 0;
}

// What the person removed, oldest first: the sentences forgetMemory kept in user_state.forgotten.
export async function forgottenMemories(email: string): Promise<string[]> {
  await ensureSchema();
  const [row] = await getSql()`SELECT forgotten FROM user_state WHERE user_email = ${email}`;
  return Array.isArray(row?.forgotten) ? row.forgotten.map(String) : [];
}

// Zeno's own clean-up (a pattern that changed or stopped holding): deleted without joining the forgotten list,
// so Zeno can notice it again later. Only the person's removals go through forgetMemory.
export async function dropMemories(email: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureSchema();
  await getSql()`DELETE FROM memories WHERE user_email = ${email} AND id = ANY(${ids}::uuid[])`;
}

// A pasted to-do, kept as a memory until it is booked (dropTodos), its plan is finished (changeStepStatus), or the
// day after it is due (14 days after it is saved when undated).
export const todoMemory = (title: string) => `To do: ${title}`;

export const dueDay = (date: string) => formatDate(new Date(`${date}T12:00:00Z`), "UTC");

// A deadline kept as a memory, so Zeno knows it even when it is never booked or is past the calendar's 14 days.
export const deadlineMemory = (deadline: { title: string; date: string }) => `${deadline.title}, due ${dueDay(deadline.date)}.`;

// Booked to-dos are on the calendar now, so their "To do:" memories go; dropped, not forgotten, so a later paste
// of the same to-do is kept again.
export async function dropTodos(email: string, titles: string[]): Promise<void> {
  if (titles.length === 0) return;
  await ensureSchema();
  await getSql()`DELETE FROM memories WHERE user_email = ${email} AND source = 'you' AND text = ANY(${titles.map(todoMemory)}::text[])`;
}

// POST /api/canvas: each sync's deadlines replace the last sync's, so a submitted or moved assignment never lingers.
export async function replaceCanvasDeadlines(email: string, deadlines: { text: string; expiresOn: string }[]): Promise<void> {
  await ensureSchema();
  await getSql()`DELETE FROM memories WHERE user_email = ${email} AND source = 'canvas'`;
  // One at a time, so each save's dedupe and caps see the one before it.
  for (const deadline of deadlines) await addMemory(email, deadline.text, { group: "projects", source: "canvas", expiresOn: deadline.expiresOn });
}

// What the profile scan saved since `since`, in the order it saved them, so a repeat call that day sees them too.
export async function scannedSince(email: string, since: Date): Promise<Memory[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, text, created_at, memory_group, source FROM memories
    WHERE user_email = ${email} AND source IN ('calendar', 'email') AND created_at >= ${since.toISOString()}
    ORDER BY created_at
  `;
  return rows.map(memoryFrom);
}

// Titles of steps marked done in [start, end), oldest first. Here and below, a removed goal's steps count nowhere, as if
// it were deleted, until an Undo.
export async function stepsFinishedBetween(email: string, start: Date, end: Date): Promise<string[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT title FROM steps
    WHERE user_email = ${email} AND status = 'done'
      AND done_at >= ${start.toISOString()} AND done_at < ${end.toISOString()}
      AND goal_id NOT IN (SELECT id FROM goals WHERE user_email = ${email} AND status = 'removed')
    ORDER BY done_at
  `;
  return rows.map((row) => String(row.title));
}

// Titles of the steps finished on the person's yesterday, for the line under the home's greeting.
export async function finishedYesterday(email: string, timeZone: string, now = new Date()): Promise<string[]> {
  // The last instant before today's midnight falls on the person's yesterday, DST included.
  const yesterday = dayBounds(timeZone, new Date(dayBounds(timeZone, now).start.getTime() - 1));
  return stepsFinishedBetween(email, yesterday.start, yesterday.end);
}

// Finished steps per local calendar date (YYYY-MM-DD in timeZone), over the whole history so the best streak is true.
// One row per active day, so even years of use stay small.
export async function finishedDays(email: string, timeZone: string): Promise<Record<string, number>> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT to_char(done_at AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day, count(*) AS steps FROM steps
    WHERE user_email = ${email} AND status = 'done' AND done_at <= now()
      AND goal_id NOT IN (SELECT id FROM goals WHERE user_email = ${email} AND status = 'removed')
    GROUP BY 1
  `;
  return Object.fromEntries(rows.map((row) => [String(row.day), Number(row.steps)]));
}

// A finished or skipped step, for the patterns Zeno notices; startedAt is null when it was never started.
export type StepRecord = { status: "done" | "skipped"; minutes: number | null; startedAt: string | null; doneAt: string };

// Steps finished or skipped in the last 30 days, oldest first.
export async function recentSteps(email: string): Promise<StepRecord[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT status, minutes, started_at, done_at FROM steps
    WHERE user_email = ${email} AND status IN ('done', 'skipped') AND done_at > now() - interval '30 days'
      AND goal_id NOT IN (SELECT id FROM goals WHERE user_email = ${email} AND status = 'removed')
    ORDER BY done_at
  `;
  return rows.map((row) => ({
    status: row.status === "done" ? "done" : "skipped",
    minutes: row.minutes === null ? null : Number(row.minutes),
    startedAt: iso(row.started_at),
    doneAt: iso(row.done_at) as string,
  }));
}
