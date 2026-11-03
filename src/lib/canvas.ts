import type { CanvasAssignment } from "@/lib/day";

// Canvas LMS (https://canvas.instructure.com/doc/api/), read with the person's own personal access token for one
// request; the token is never stored or logged. Contract stub (docs/PLAN-NOV2.md); the memory-canvas track builds it.

// "sjsu.instructure.com", "https://sjsu.instructure.com/courses/1" → "https://sjsu.instructure.com"; null for
// anything that is not an https://<school>.instructure.com address (the server fetches it, so nothing else is allowed).
export function canvasBase(raw: unknown): string | null {
  void raw;
  return null;
}

// The next 14 days of the person's work: assignments, quizzes, discussions and exams, submitted or not, soonest first,
// with instructions for the 3 soonest unsubmitted ones.
export async function canvasAssignments(base: string, token: string, now = new Date()): Promise<{ courses: number; assignments: CanvasAssignment[] }> {
  void base;
  void token;
  void now;
  throw new Error("Canvas is not built yet");
}
