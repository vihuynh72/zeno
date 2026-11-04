// What the pop-out focus window (focus-pop.tsx) shows, read from the page. `node src/components/pop-card.check.ts` runs it.
import { openSteps, type Screen } from "@/components/day-flow";
import type { Goal, Step } from "@/lib/day";

// step: in Focus, the running step with the page's Done. next: after a Done, Zeno's line with the page's Keep going.
// last: after the plan's last step, the line alone, until the window closes by itself. null: the step ended (Stop for
// now, Switch goal, another desk, signed out), so the window closes. `answer` is the index of the page's own answer
// (-1 when the page offers none, as while a draft waits), so a tap in the window runs what the page's button runs.
export type PopCard = { kind: "step"; step: Step; answer: number } | { kind: "next"; answer: number } | { kind: "last" } | null;

export function popCard(screen: Screen | null, goal: Goal | null, chips: string[]): PopCard {
  const step = openSteps(goal)[0];
  // The page's Done comes after the quick replies to a question Zeno asked, so the last "Done" is the page's own.
  if (screen === "focus" && step) return { kind: "step", step, answer: chips.lastIndexOf("Done") };
  if (screen !== "checkin") return null;
  return step ? { kind: "next", answer: chips.indexOf("Keep going") } : { kind: "last" };
}
