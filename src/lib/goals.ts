import type { Goal, Memory, StepStatus } from "@/lib/day";
import { ensureSchema, getSql } from "@/lib/db";

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
    steps: rows
      .filter((row) => row.id !== null)
      .map((row) => ({
        id: String(row.id),
        title: String(row.title),
        minutes: row.minutes === null ? null : Number(row.minutes),
        status: row.status as StepStatus,
        startedAt: iso(row.started_at),
        doneAt: iso(row.done_at),
      })),
  };
}

function goalQuery(email: string, goalId: string) {
  return getSql()`
    SELECT g.id AS goal_id, g.title AS goal_title, s.id, s.title, s.minutes, s.status, s.started_at, s.done_at
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

// Any goal at all, paused and done ones included.
export async function hasAnyGoal(email: string): Promise<boolean> {
  await ensureSchema();
  return (await getSql()`SELECT 1 FROM goals WHERE user_email = ${email} LIMIT 1`).length > 0;
}

export async function setGoal(email: string, title: string, steps: NewStep[]): Promise<Goal> {
  await ensureSchema();
  const sql = getSql();
  const goalId = crypto.randomUUID();
  const results = await sql.transaction([
    // One goal at a time: the old one is paused, not lost.
    sql`UPDATE goals SET status = 'paused', updated_at = now() WHERE user_email = ${email} AND status = 'active'`,
    sql`INSERT INTO goals (id, user_email, title) VALUES (${goalId}, ${email}, ${title})`,
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
            UPDATE steps SET title = ${step.title}, minutes = ${step.minutes}, position = ${start + index}
            WHERE id = ${step.id} AND goal_id = ${goalId} AND user_email = ${email} AND status = 'todo'
          `
        : sql`
            INSERT INTO steps (goal_id, user_email, title, minutes, position)
            VALUES (${goalId}, ${email}, ${step.title}, ${step.minutes}, ${start + index})
          `,
    ),
    // New todo steps reopen a finished goal; a paused one stays paused.
    sql`
      UPDATE goals SET updated_at = now(), status = CASE WHEN status = 'done' THEN 'active' ELSE status END
      WHERE id = ${goalId} AND user_email = ${email}
    `,
    goalQuery(email, goalId),
  ]);
  return goalFrom(results[results.length - 1]);
}

export async function setStepStatus(email: string, stepId: string, status: StepStatus): Promise<Goal | null> {
  await ensureSchema();
  const sql = getSql();
  const [step] = await sql`SELECT goal_id FROM steps WHERE id = ${stepId} AND user_email = ${email}`;
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
    sql`
      UPDATE steps SET
        status = ${status},
        started_at = CASE WHEN ${status} = 'doing' THEN now() WHEN ${status} = 'todo' THEN NULL ELSE started_at END,
        done_at = CASE WHEN ${status} IN ('done', 'skipped') THEN now() END
      WHERE id = ${stepId} AND user_email = ${email}
    `,
    // Nothing left to do finishes the goal; reopening a step brings it back.
    sql`
      UPDATE goals SET updated_at = now(), status = CASE WHEN EXISTS (
        SELECT 1 FROM steps WHERE goal_id = ${goalId} AND user_email = ${email} AND status IN ('todo', 'doing')
      ) THEN 'active' ELSE 'done' END
      WHERE id = ${goalId} AND user_email = ${email} AND status <> 'paused'
    `,
    // With no goal left active, the most recently paused one comes back where it was left.
    sql`
      UPDATE goals SET status = 'active', updated_at = now()
      WHERE id = (
        SELECT id FROM goals WHERE user_email = ${email} AND status = 'paused'
        ORDER BY updated_at DESC, created_at DESC LIMIT 1
      ) AND NOT EXISTS (SELECT 1 FROM goals WHERE user_email = ${email} AND status = 'active')
    `,
    goalQuery(email, goalId),
  ]);
  return goalFrom(results[results.length - 1]);
}

export async function listMemories(email: string): Promise<Memory[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, text, created_at FROM memories WHERE user_email = ${email} ORDER BY created_at DESC
  `;
  return rows.map((row) => ({
    id: String(row.id),
    text: String(row.text),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function addMemory(email: string, text: string) {
  await ensureSchema();
  const sql = getSql();
  await sql.transaction([
    // The unique index skips an exact duplicate.
    sql`
      INSERT INTO memories (user_email, text) VALUES (${email}, ${[...text.trim()].slice(0, 200).join("")})
      ON CONFLICT DO NOTHING
    `,
    // Only the 50 newest stay, so the prompt stays small.
    sql`
      DELETE FROM memories WHERE user_email = ${email} AND id NOT IN (
        SELECT id FROM memories WHERE user_email = ${email} ORDER BY created_at DESC LIMIT 50
      )
    `,
  ]);
}

export async function forgetMemory(email: string, id: string): Promise<boolean> {
  await ensureSchema();
  const rows = await getSql()`DELETE FROM memories WHERE id = ${id} AND user_email = ${email} RETURNING id`;
  return rows.length > 0;
}

// Titles of steps marked done in [start, end), oldest first.
export async function stepsFinishedBetween(email: string, start: Date, end: Date): Promise<string[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT title FROM steps
    WHERE user_email = ${email} AND status = 'done'
      AND done_at >= ${start.toISOString()} AND done_at < ${end.toISOString()}
    ORDER BY done_at
  `;
  return rows.map((row) => String(row.title));
}
