// Contract between the Guided day screens and their routes:
// GET /api/day, GET /api/day/opening, POST /api/talk, POST /api/goal, PATCH /api/steps/[id],
// GET and POST /api/memory, DELETE /api/memory/[id], POST /api/import, POST /api/prep,
// GET /api/calendar/week, POST /api/calendar/free, POST and DELETE /api/calendar/book, POST /api/profile/scan.
// docs/PLAN-NOV.md says what each one is for.

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
  // When the step is booked on the Zeno calendar: the block's start (ISO) and the Google event id.
  scheduledAt?: string | null;
  eventId?: string | null;
};

// The one goal Zeno is helping with now; steps are in roadmap order. due is YYYY-MM-DD when known.
export type Goal = { id: string; title: string; steps: Step[]; due?: string | null };

// The grouped profile, in the order Memory shows it.
export const MEMORY_GROUPS = ["about", "routines", "projects", "interests", "people", "work-style", "patterns"] as const;
export type MemoryGroup = (typeof MEMORY_GROUPS)[number];
// Where a memory came from: what the person said, a calendar or email scan, or a pattern in what they did.
export type MemorySource = "you" | "calendar" | "email" | "pattern";

export type Memory = { id: string; text: string; createdAt: string; group: MemoryGroup; source: MemorySource };

export type Turn = { role: "user" | "assistant"; content: string };

export type SourceState = "ok" | "no-access" | "error" | "not-configured";

// zeno marks a block on the person's Zeno calendar.
export type DayEvent = { title: string; start: string; end: string; allDay: boolean; zeno?: boolean };

export type DayEmail = { from: string; subject: string; snippet: string; unread: boolean };

// A free gap in the person's calendars, ISO start and end.
export type FreeSlot = { start: string; end: string };

// A due date Zeno knows about (from the Zeno calendar's all-day "Due:" events), date is YYYY-MM-DD.
export type Deadline = { title: string; date: string; daysLeft: number };

// Whether Zeno may write to its own calendar: "needs-permission" until the person grants the calendar scope.
export type CalendarWrite = "ok" | "needs-permission" | "no-access";

// A block on the person's separate "Zeno" Google calendar, proposed by Zeno or already booked.
// Timed blocks use start and end (ISO); an all-day block (a deadline) uses date (YYYY-MM-DD).
export type CalendarBlock = {
  title: string;
  kind: "step" | "todo" | "deadline";
  start?: string;
  end?: string;
  date?: string;
  // The step this block is for, so booking links them.
  stepId?: string | null;
  // Set once booked.
  eventId?: string;
};

// Streak and this week, in the person's time zone. One finished step counts for a day; one missed day per
// Mon–Sun week is covered by a rest day automatically.
export type Progress = {
  streak: number;
  best: number;
  // Monday to Sunday of this week.
  week: ("done" | "rest" | "missed" | "today" | "future")[];
  stepsThisWeek: number;
  restDaysLeft: number;
  // Evening, a live streak and nothing finished today: the first card offers a 5-minute save.
  atRisk: boolean;
  // A milestone (3, 7, 14, 30, 50, 100) reached today, for the bigger stamp; null otherwise.
  milestone: number | null;
};

export type DayResponse =
  | {
      state: "ok";
      // Opaque and stable per account (never the email), so the page can tell whether this browser's saved day is the owner's.
      account: string;
      firstName: string | null;
      opening: string;
      openingSource: "ai" | "rule";
      // Up to 3 things the person can tap instead of typing, worded as they would say them.
      options: string[];
      goal: Goal | null;
      sources: { calendar: SourceState; email: SourceState; goals: SourceState };
      // Today's events from all of the person's calendars, Zeno blocks marked.
      events: DayEvent[];
      // The rest of today's free time, and deadlines in the next 14 days.
      free: FreeSlot[];
      deadlines: Deadline[];
      calendarWrite: CalendarWrite;
      emails: DayEmail[];
      unreadEmail: number;
      // Nothing remembered and no goal yet: the screens run the first-time setup.
      isNew: boolean;
      // Same as progress.streak, kept for older saved days.
      streak: number;
      progress: Progress;
    }
  | { state: "signed-out" | "error" };

// The one thing the first card offers, ready to start with one tap: an existing step (stepId), or a new plan
// that POST /api/goal saves and starts (steps in order, the first about 5 minutes).
export type FirstPick = {
  goal: string;
  due: string | null;
  stepId: string | null;
  steps: { title: string; minutes: number }[];
  // One short line: why this one first.
  why: string;
};

// The model-written opening, fetched after /api/day so the first screen never waits on the model.
export type OpeningResponse =
  | { state: "ok"; opening: string; options: string[]; pick: FirstPick | null }
  | { state: "signed-out" | "error" };

// POST /api/talk body: { message: string; history: Turn[] }
export type TalkAction = {
  type: "goal-set" | "roadmap-changed" | "step-started" | "step-finished" | "remembered" | "forgot";
  label: string;
  // For "remembered": the saved memory, so the Noted line can undo it.
  memoryId?: string;
};

export type TalkResponse =
  | {
      state: "ok";
      reply: string;
      goal: Goal | null;
      actions: TalkAction[];
      options: string[];
      // Blocks Zeno suggests booking; nothing is written until the person taps.
      proposal: CalendarBlock[];
    }
  | { state: "signed-out" | "no-key" | "bad-request" | "model-error" };

// POST /api/goal body: { title, due?, steps: { title, minutes }[], start?: boolean }. Saves the plan without
// the model; start: true also starts step 1, so a tap starts the timer at once.
export type GoalResponse =
  | { state: "ok"; goal: Goal }
  | { state: "signed-out" | "bad-request" | "error" };

// POST /api/prep body: { stepId }; up to 3 sources, found from the goal and step titles alone.
export type PrepResponse =
  | { state: "ok"; sources: PrepSource[] }
  | { state: "signed-out" | "not-found" | "bad-request" | "error" };

// PATCH /api/steps/[id] body: { status: StepStatus }. Finishing a step also returns the new progress and any
// pattern Zeno just noticed (shown as a Noted line).
export type StepResponse =
  | { state: "ok"; goal: Goal; progress?: Progress; learned?: Memory | null }
  | { state: "signed-out" | "not-found" | "bad-request" | "error" };

export type MemoryResponse =
  | { state: "ok"; memories: Memory[] }
  | { state: "signed-out" | "error" };

// POST /api/memory body { text, group? } saves one memory.
export type SaveMemoryResponse =
  | { state: "ok"; memories: Memory[] }
  | { state: "signed-out" | "bad-request" | "error" };

// POST /api/import body { text }: pasted notes become grouped memories plus a proposal to book their
// deadlines (all-day) and to-dos (timed, at free times). Nothing is booked until the person taps.
export type ImportResponse =
  | { state: "ok"; memories: Memory[]; proposal: CalendarBlock[] }
  | { state: "signed-out" | "bad-request" | "error" };

// GET /api/calendar/week?start=YYYY-MM-DD (a Monday; defaults to this week).
export type WeekEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  zeno: boolean;
  // The calendar's color from Google, when it has one.
  color: string | null;
};

export type WeekResponse =
  | { state: "ok"; timeZone: string; days: { date: string; events: WeekEvent[] }[]; write: CalendarWrite }
  | { state: "signed-out" | "no-access" | "bad-request" | "error" };

// POST /api/calendar/free body: { minutes, days? } → free slots that fit, soonest first.
export type FreeResponse =
  | { state: "ok"; slots: FreeSlot[] }
  | { state: "signed-out" | "no-access" | "bad-request" | "error" };

// POST /api/calendar/book body: { blocks: CalendarBlock[] } (1 to 12). DELETE /api/calendar/book/[eventId] undoes one.
export type BookResponse =
  | { state: "ok"; booked: CalendarBlock[] }
  | { state: "needs-permission" | "signed-out" | "no-access" | "bad-request" | "error" };

// POST /api/profile/scan body: { first?: boolean }. Reads calendar and email at most once a day and returns
// only what it newly learned.
export type ProfileResponse =
  | { state: "ok"; learned: Memory[]; scannedAt: string }
  | { state: "signed-out" | "no-access" | "error" };
