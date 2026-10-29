import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { databaseConfigured, ensureSchema, getSql } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "not-configured" }, { status: 503 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { done?: boolean } | null;
  if (typeof body?.done !== "boolean") {
    return NextResponse.json({ state: "bad-request" }, { status: 400 });
  }
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE tasks SET done = ${body.done}
    WHERE id = ${id} AND user_email = ${session.user.email}
    RETURNING id, title, done
  `;
  if (rows.length === 0) {
    return NextResponse.json({ state: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ state: "ok", task: rows[0] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ state: "signed-out" }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ state: "not-configured" }, { status: 503 });
  }
  const { id } = await params;
  await ensureSchema();
  const sql = getSql();
  await sql`
    DELETE FROM tasks
    WHERE id = ${id} AND user_email = ${session.user.email}
  `;
  return NextResponse.json({ state: "ok" });
}
