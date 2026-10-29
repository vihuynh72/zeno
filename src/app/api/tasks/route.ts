import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { databaseConfigured, ensureSchema, getSql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out", tasks: [] }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "not-configured", tasks: [] });
  }
  await ensureSchema();
  const sql = getSql();
  const tasks = await sql`
    SELECT id, title, done FROM tasks
    WHERE user_email = ${session.user.email}
    ORDER BY created_at ASC
  `;
  return NextResponse.json({ state: "ok", tasks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "not-configured" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { title?: string } | null;
  const title = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ state: "bad-request" }, { status: 400 });
  }
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO tasks (user_email, title)
    VALUES (${session.user.email}, ${title})
    RETURNING id, title, done
  `;
  return NextResponse.json({ state: "ok", task: rows[0] }, { status: 201 });
}
