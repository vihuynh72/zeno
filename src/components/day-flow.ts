// Pure rules behind the Guided day screens. Type-only imports, so `node src/components/day-flow.check.ts` runs it.
import type { Goal, Step, TalkAction } from "@/lib/day";

export type Screen = "signed-out" | "ready" | "brief" | "talk" | "plan" | "focus" | "checkin";

export const STAGES = ["Brief", "Pick one thing", "First step", "Focus"];

// Which STAGES entry each screen lights up; signed-out lights none.
export const STAGE_OF: Record<Screen, number> = {
  "signed-out": -1,
  ready: 0,
  brief: 0,
  talk: 1,
  plan: 2,
  focus: 3,
  checkin: 3,
};

// Before 5 AM it is still the night before for most people, not morning.
export function greeting(hour: number, firstName: string | null) {
  const who = firstName ? `, ${firstName}` : "";
  if (hour < 5) return `Still up${who}?`;
  return `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${who}.`;
}

// The step being done comes first, then the rest still to do, in roadmap order.
export function openSteps(goal: Goal | null): Step[] {
  const steps = goal?.steps ?? [];
  return [...steps.filter((s) => s.status === "doing"), ...steps.filter((s) => s.status === "todo")];
}

// Where a reply from /api/talk leaves the person.
export function nextScreen(screen: Screen, actions: TalkAction[], goal: Goal | null): Screen {
  const did = (type: TalkAction["type"]) => actions.some((a) => a.type === type);
  if (did("step-started") && goal?.steps.some((s) => s.status === "doing")) return "focus";
  if ((did("goal-set") || did("roadmap-changed")) && openSteps(goal).length > 0) return "plan";
  if (did("step-finished")) return "checkin";
  // No step left to show (the goal was cleared or emptied): back to talking it through.
  if ((screen === "plan" || screen === "focus") && openSteps(goal).length === 0) return "talk";
  return screen === "ready" || screen === "brief" ? "talk" : screen;
}

// Longer lines get a smaller hand so a reply still fits the card.
export function cardSize(text: string): "l" | "m" | "s" {
  return text.length <= 90 ? "l" : text.length <= 160 ? "m" : "s";
}

// 9:05 style countdown, never below 0:00.
export function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
