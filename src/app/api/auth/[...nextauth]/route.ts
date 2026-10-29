import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { withoutAccessToken } from "@/lib/session-json";

export async function GET(request: NextRequest) {
  return withoutAccessToken(await handlers.GET(request));
}

export async function POST(request: NextRequest) {
  return withoutAccessToken(await handlers.POST(request));
}
