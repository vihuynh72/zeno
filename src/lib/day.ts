// Contract between the Guided day screens and their routes:
// GET /api/day, POST /api/talk, PATCH /api/steps/[id], GET /api/memory, DELETE /api/memory/[id].

export type StepStatus = "todo" | "doing" | "done" | "skipped";

export type Step = {
  id: string;
  title: string;
  minutes: number | null;
  status: StepStatus;
  startedAt: string | null;
  doneAt: string | null;
};

// The one goal Zeno is helping with now; steps are in roadmap order.
export type Goal = { id: string; title: string; steps: Step[] };

export type Memory = { id: string; text: string; createdAt: string };

export type Turn = { role: "user" | "assistant"; content: string };

export type SourceState = "ok" | "no-access" | "error" | "not-configured";

export type DayEvent = { title: string; start: string; end: string; allDay: boolean };

export type DayResponse =
  | {
      state: "ok";
      firstName: string | null;
      opening: string;
      openingSource: "ai" | "rule";
      goal: Goal | null;
      sources: { calendar: SourceState; email: SourceState; goals: SourceState };
      events: DayEvent[];
      unreadEmail: number;
    }
  | { state: "signed-out" | "error" };

// POST /api/talk body: { message: string; history: Turn[] }
export type TalkAction = {
  type: "goal-set" | "roadmap-changed" | "step-started" | "step-finished" | "remembered" | "forgot";
  label: string;
};

export type TalkResponse =
  | { state: "ok"; reply: string; goal: Goal | null; actions: TalkAction[] }
  | { state: "signed-out" | "no-key" | "bad-request" | "model-error" };

// PATCH /api/steps/[id] body: { status: StepStatus }
export type StepResponse =
  | { state: "ok"; goal: Goal }
  | { state: "signed-out" | "not-found" | "bad-request" | "error" };

export type MemoryResponse =
  | { state: "ok"; memories: Memory[] }
  | { state: "signed-out" | "error" };
