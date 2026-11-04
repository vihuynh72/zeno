import { connection, NextResponse } from "next/server";
import { APPS } from "@/lib/connect";
import { configured, type ConnectStatus } from "@/lib/connect-config";

// Which apps can be connected here (src/lib/connect-config.ts): true or false per app, never an env value.
export async function GET() {
  await connection(); // read at request time, so an env added later counts without a rebuild of this answer
  return NextResponse.json(Object.fromEntries(APPS.map((app) => [app, configured(app)])) as ConnectStatus);
}
