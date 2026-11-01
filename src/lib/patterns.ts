import type { Memory } from "@/lib/day";

// After a step is finished or skipped: a new pattern in what the person actually does (time of day, real
// length versus the estimate, what they skip), saved as a "patterns" memory and returned, or null.
// Contract stub (docs/PLAN-NOV.md); the streak track fills it in.
export async function learnFromSteps(email: string, timeZone: string): Promise<Memory | null> {
  void [email, timeZone];
  return null;
}
