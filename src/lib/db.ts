import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

export async function ensureSchema() {
  const sql = getSql();
  if (!schemaReady) {
    // One transaction, so a cold start pays one round trip for the whole schema.
    schemaReady = sql
      .transaction([
        sql`
          CREATE TABLE IF NOT EXISTS tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_email TEXT NOT NULL,
            title TEXT NOT NULL,
            done BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
        sql`
          CREATE INDEX IF NOT EXISTS tasks_user_created_idx
          ON tasks (user_email, created_at)
        `,
        sql`
          CREATE TABLE IF NOT EXISTS goals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_email TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
        sql`CREATE INDEX IF NOT EXISTS goals_user_status_idx ON goals (user_email, status, created_at)`,
        sql`
          CREATE TABLE IF NOT EXISTS steps (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
            user_email TEXT NOT NULL,
            title TEXT NOT NULL,
            minutes INT,
            position INT NOT NULL,
            status TEXT NOT NULL DEFAULT 'todo',
            started_at TIMESTAMPTZ,
            done_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
        sql`CREATE INDEX IF NOT EXISTS steps_goal_position_idx ON steps (goal_id, position)`,
        sql`CREATE INDEX IF NOT EXISTS steps_user_done_idx ON steps (user_email, done_at)`,
        sql`
          CREATE TABLE IF NOT EXISTS memories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_email TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
        // Unique, so saving the same sentence twice keeps one copy.
        sql`CREATE UNIQUE INDEX IF NOT EXISTS memories_user_text_idx ON memories (user_email, text)`,
      ])
      .then(() => undefined)
      .catch((error) => {
        // Forget the failure so the next call retries instead of failing forever.
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}
