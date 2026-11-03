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
// Where a memory came from: what the person said, a calendar or email scan, a pattern in what they did, or their
// Canvas assignments (POST /api/canvas replaces all of an account's "canvas" memories on each sync).
export type MemorySource = "you" | "calendar" | "email" | "pattern" | "canvas";

export type Memory = { id: string; text: string; createdAt: string; group: MemoryGroup; source: MemorySource };

// A private fact: overall health, sexual orientation, religion, politics, immigration status, balances or debts
// (Vi, Nov 1). Zeno's servers never save these. Routes return them in `private`; the browser keeps them
// (src/lib/vault.ts) and sends their texts back as `private: string[]` with talk, the opening and the scan.
export type PrivateFact = { text: string; group: MemoryGroup };

export type Turn = { role: "user" | "assistant"; content: string };

export type SourceState = "ok" | "no-access" | "error" | "not-configured";

// zeno marks a block on the person's Zeno calendar.
export type DayEvent = { title: string; start: string; end: string; allDay: boolean; zeno?: boolean };

export type DayEmail = { from: string; subject: string; snippet: string; unread: boolean };

// A free gap in the person's calendars, ISO start and end.
export type FreeSlot = { start: string; end: string };

// A due date Zeno knows about (the Zeno calendar's all-day "Due:" events and the deadlines kept as memories), date is
// YYYY-MM-DD.
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
  // Monday to Sunday of this week; "none" is a day before the person's first finished step.
  week: ("done" | "rest" | "missed" | "none" | "today" | "future")[];
  stepsThisWeek: number;
  restDaysLeft: number;
  // Evening, a live streak and nothing finished today: the first card offers a 5-minute save.
  atRisk: boolean;
  // A milestone (3, 7, 14, 30, 50, 100) for the bigger stamp, set only on the PATCH /api/steps or POST /api/talk
  // response whose Done finished the day's first step; null otherwise (GET /api/day, skips, repeated or later Dones).
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
      // Only important mail (Vi, Nov 2): people and school, never promotions, social, updates, forums or no-reply
      // senders. unreadEmail counts the unread ones among them.
      emails: DayEmail[];
      unreadEmail: number;
      // Gmail for this account (https://mail.google.com/mail/?authuser=<email>), for the subtle "Open Gmail" link.
      // Optional: days saved in the browser before Nov 2 lack it.
      mailUrl?: string;
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
// POST /api/day/opening body { private?: string[]; canvas?: CanvasBrief[] } uses the device's private facts and Canvas
// briefs; GET is the same without them.
export type OpeningResponse =
  | { state: "ok"; opening: string; options: string[]; pick: FirstPick | null }
  | { state: "signed-out" | "error" };

// POST /api/talk body: { message: string; history: Turn[]; proposals?: boolean; private?: string[]; canvas?: CanvasBrief[] }
export type TalkAction = {
  // "kept-private": a private fact went to the device (it is in the response's `private`), never to Zeno's servers.
  type: "goal-set" | "roadmap-changed" | "step-started" | "step-finished" | "remembered" | "kept-private" | "forgot";
  label: string;
  // For "remembered": the saved memory's id.
  memoryId?: string;
};

export type TalkResponse =
  | {
      state: "ok";
      reply: string;
      goal: Goal | null;
      actions: TalkAction[];
      options: string[];
      // Blocks Zeno suggests booking; nothing is written until the person taps. Always empty unless the request
      // body has proposals: true (a client that shows and books them) and calendarWrite is "ok".
      proposal: CalendarBlock[];
      // Set when the turn finished or skipped a step, as PATCH /api/steps/[id] returns it, milestone included.
      progress?: Progress;
      // Private facts from this turn, for the device only (see PrivateFact).
      private?: PrivateFact[];
      // An email Zeno drafted when asked ("draft the email to Prof Patel"); the page shows "Open in Gmail".
      draft?: EmailDraft | null;
    }
  | { state: "signed-out" | "no-key" | "bad-request" | "model-error" };

// An email Zeno wrote for the person to send themselves (Vi, Nov 2: no sending service). `to` is empty or an address
// from their own recent mail, never one the model made up. `url` opens it in Gmail's compose window for this account,
// where they press Send.
export type EmailDraft = { to: string; subject: string; body: string; url: string };

// POST /api/goal body: { title, due?, steps: { title, minutes }[], start?: boolean }. Saves the plan without
// the model; start: true also starts step 1, so a tap starts the timer at once.
export type GoalResponse =
  | { state: "ok"; goal: Goal }
  | { state: "signed-out" | "bad-request" | "error" };

// POST /api/prep body: { stepId; canvas?: CanvasBrief }; up to 3 sources, found from the goal and step titles, and the
// assignment's instructions when the step is for a Canvas assignment.
export type PrepResponse =
  | { state: "ok"; sources: PrepSource[] }
  | { state: "signed-out" | "not-found" | "bad-request" | "error" };

// PATCH /api/steps/[id] body: { status: StepStatus }. Finishing a step also returns the new progress and any
// pattern Zeno just noticed (already saved; Memory shows it).
export type StepResponse =
  | { state: "ok"; goal: Goal; progress?: Progress; learned?: Memory | null }
  | { state: "signed-out" | "not-found" | "bad-request" | "error" };

export type MemoryResponse =
  | { state: "ok"; memories: Memory[] }
  | { state: "signed-out" | "error" };

// POST /api/memory body { text, group? } saves one memory. A private fact is not saved: it comes back in `private`
// for the device; a never-list one is "not-kept".
export type SaveMemoryResponse =
  | { state: "ok"; memories: Memory[]; private?: PrivateFact[] }
  | { state: "signed-out" | "bad-request" | "not-kept" | "error" };

// POST /api/import body { text }: pasted notes become grouped memories (every to-do as a "To do: …" memory).
// proposal is always empty since Nov 2: Vi does not want small to-dos or Due: days written to the calendar.
export type ImportResponse =
  | { state: "ok"; memories: Memory[]; proposal: CalendarBlock[]; private?: PrivateFact[] }
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
  // The event in Google Calendar (its htmlLink): the Week view is read-only and a tap opens this.
  link?: string | null;
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

// POST /api/profile/scan body: { first?: boolean; private?: string[]; removed?: string[] } (the device's facts, so they
// are known, and the ones removed there, so a scan never finds them again). Reads calendar and email at most once a
// day and returns only what it newly learned.
export type ProfileResponse =
  | { state: "ok"; learned: Memory[]; scannedAt: string; private?: PrivateFact[] }
  | { state: "signed-out" | "no-access" | "error" };

// ---------- Canvas (Vi, Nov 2) ----------
// The person's Canvas link (school address and personal access token) stays only in their browser
// (src/lib/canvas-store.ts). POST /api/canvas body { base, token }: the server uses the token for that one request and
// never stores or logs it. It reads the next 14 days of unsubmitted work, replaces the account's "canvas" deadline
// memories with it (so Today, the first card and the opening see them), and returns the list. DELETE /api/canvas
// (Disconnect) deletes those memories: { state: "ok" | "signed-out" | "error" }. Zeno never submits, writes answers or
// changes anything in Canvas.
export type CanvasAssignment = {
  id: string;
  course: string;
  title: string;
  // ISO due time, null when the work has no due date.
  due: string | null;
  kind: "assignment" | "quiz" | "discussion" | "exam";
  submitted: boolean;
  // The assignment's page in Canvas.
  url: string;
  // Its instructions as plain text (at most 800 characters), filled for the 3 soonest unsubmitted ones; null otherwise.
  instructions: string | null;
};

export type CanvasResponse =
  | { state: "ok"; courses: number; assignments: CanvasAssignment[] }
  // bad-url: not an https://<school>.instructure.com address. bad-token: Canvas refused the token.
  // not-allowed: the school turned off personal access tokens or this API.
  | { state: "signed-out" | "bad-request" | "bad-url" | "bad-token" | "not-allowed" | "error" };

// What the browser sends back with the opening, talk and prep (like `private`): the soonest assignments' instructions,
// so Zeno can find the first step without the server keeping them.
export type CanvasBrief = { title: string; course: string; due: string | null; instructions: string };
