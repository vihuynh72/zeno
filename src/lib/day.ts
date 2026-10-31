// Contract between the Guided day screens and their routes:
// GET /api/day, GET /api/day/opening, POST /api/talk, PATCH /api/steps/[id],
// GET and POST /api/memory, DELETE /api/memory/[id], POST /api/import, POST /api/prep.

export type StepStatus = "todo" | "doing" | "done" | "skipped";

// A web page found for a step; url is always https.
export type PrepSource = { title: string; url: string; why: string };

export type Step = {
  id: string;
  title: string;
  minutes: number | null;
  status: StepStatus;
  startedAt: string | null;
  doneAt: string | null;
  // The latest sources found for this step, or null before anyone asked.
  prep?: PrepSource[] | null;
};

// The one goal Zeno is helping with now; steps are in roadmap order.
export type Goal = { id: string; title: string; steps: Step[] };

export type Memory = { id: string; text: string; createdAt: string };

export type Turn = { role: "user" | "assistant"; content: string };

export type SourceState = "ok" | "no-access" | "error" | "not-configured";

export type DayEvent = { title: string; start: string; end: string; allDay: boolean };

export type DayEmail = { from: string; subject: string; snippet: string; unread: boolean };

export type DayResponse =
  | {
      state: "ok";
      firstName: string | null;
      opening: string;
      openingSource: "ai" | "rule";
      // Up to 3 things the person can tap instead of typing, worded as they would say them.
      options: string[];
      goal: Goal | null;
      sources: { calendar: SourceState; email: SourceState; goals: SourceState };
      events: DayEvent[];
      emails: DayEmail[];
      unreadEmail: number;
      // Nothing remembered and no goal yet: the screens run the first-time setup.
      isNew: boolean;
      // Days in a row, in the person's time zone, with a finished step; the run may end yesterday until
      // a step is done today. 0 when there is none or it couldn't be read.
      streak: number;
    }
  | { state: "signed-out" | "error" };

// The model-written opening, fetched after /api/day so the first screen never waits on the model.
export type OpeningResponse =
  | { state: "ok"; opening: string; options: string[] }
  | { state: "signed-out" | "error" };

// POST /api/talk body: { message: string; history: Turn[] }
export type TalkAction = {
  type: "goal-set" | "roadmap-changed" | "step-started" | "step-finished" | "remembered" | "forgot";
  label: string;
};

export type TalkResponse =
  | { state: "ok"; reply: string; goal: Goal | null; actions: TalkAction[]; options: string[] }
  | { state: "signed-out" | "no-key" | "bad-request" | "model-error" };

// POST /api/prep body: { stepId }; up to 3 sources, found from the goal and step titles alone.
export type PrepResponse =
  | { state: "ok"; sources: PrepSource[] }
  | { state: "signed-out" | "not-found" | "bad-request" | "error" };

// PATCH /api/steps/[id] body: { status: StepStatus }
export type StepResponse =
  | { state: "ok"; goal: Goal }
  | { state: "signed-out" | "not-found" | "bad-request" | "error" };

export type MemoryResponse =
  | { state: "ok"; memories: Memory[] }
  | { state: "signed-out" | "error" };

// POST /api/memory body { text } saves one memory; POST /api/import body { text } turns pasted notes into memories.
export type SaveMemoryResponse =
  | { state: "ok"; memories: Memory[] }
  | { state: "signed-out" | "bad-request" | "error" };
