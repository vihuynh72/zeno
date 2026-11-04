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
        sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS prep jsonb`,
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
        // docs/PLAN-NOV.md: grouped memory, calendar blocks on steps, goal due dates, per-person state.
        sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS memory_group TEXT NOT NULL DEFAULT 'about'`,
        sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'you'`,
        sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS event_id TEXT`,
        sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`,
        sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS due DATE`,
        sql`
          CREATE TABLE IF NOT EXISTS user_state (
            user_email TEXT PRIMARY KEY,
            zeno_calendar_id TEXT,
            profile_scanned_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
        // Memories the person removed, so a later profile scan never learns them again.
        sql`ALTER TABLE user_state ADD COLUMN IF NOT EXISTS forgotten jsonb`,
        // A deadline memory's last day plus one: listMemories hides it from then on, addMemory deletes it.
        sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS expires_on DATE`,
        // Connected apps (src/lib/app-token.ts): one token per person, kept only as its SHA-256 hash.
        sql`
          CREATE TABLE IF NOT EXISTS app_tokens (
            user_email TEXT PRIMARY KEY,
            token_hash TEXT UNIQUE NOT NULL,
            time_zone TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
          )
        `,
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
