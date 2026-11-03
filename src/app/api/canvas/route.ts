import { NextResponse } from "next/server";
import type { CanvasResponse } from "@/lib/day";

export const maxDuration = 30;

// POST /api/canvas body { base, token } (src/lib/day.ts CanvasResponse). Contract stub; the memory-canvas track builds it.
export async function POST() {
  return NextResponse.json({ state: "error" } satisfies CanvasResponse, { status: 501 });
}
