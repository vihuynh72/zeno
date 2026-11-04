// Contract between the Guided day screens and their routes:
// GET /api/day, GET /api/day/opening, POST /api/talk, POST /api/goal, PATCH /api/steps/[id],
// GET and POST /api/memory, DELETE /api/memory/[id], POST /api/import, POST /api/prep,
// GET /api/calendar/week, POST /api/calendar/free, POST and DELETE /api/calendar/book, POST /api/profile/scan.
// docs/PLAN-NOV.md says what each one is for.
import type { App } from "@/lib/connect";

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
// rhythm marks a goal that keeps going (Vi, Nov 3: a rolling plan): a short line such as "3 runs a week". Its steps are
// the next few only; when they are done, POST /api/goal/next plans the next few. It never finishes by running out of
// steps: with none left it keeps its place in the goals lists until then. Null or missing: a project that ends.
// source: the app item it was made from (Nov 4: "Make it a goal" in From your apps, or a Google Doc's link), so the item
// leaves that list and shows under For this goal; null or missing for a goal made from her own words.
export type Goal = { id: string; title: string; steps: Step[]; due?: string | null; rhythm?: string | null; source?: GoalSource | null };
export type GoalSource = { app: App | "canvas"; id: string; url: string; title: string };

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

// id opens the email in full (GET /api/mail/[id]), address is the sender's, for a reply draft's To, and asks marks mail
// that asks the person something (a question or a request, by rule). All three are missing from days saved before Nov 3.
// sensitive marks code or bank mail: its row opens it in Gmail, never in Zeno (Nov 4: those rows couldn't be clicked).
// at: when it came (ISO), missing from days saved before Nov 4.
export type DayEmail = { from: string; subject: string; snippet: string; unread: boolean; id?: string; address?: string; asks?: boolean; sensitive?: boolean; at?: string };

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
      // Every open plan, the current one first, then by due date, and every goal that keeps going even with no step
      // left: the home's goal options, the Desk's Goals card and the Week (Vi, Nov 3). Missing from days saved before Nov 3.
      goals?: Goal[];
      // Steps finished this week (Monday to now, the person's time zone), newest first, for the Week (Nov 4).
      doneThisWeek?: DoneStep[];
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
      // How long this person's steps really take against Muse's planned minutes (src/lib/patterns.ts paceOf), which
      // times Focus's one check-in. Missing until Zeno has seen 3 timed steps, and in days saved before Nov 3: then 1.
      pace?: number;
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
// POST /api/day/opening body { private?: string[]; heard?: string[] } uses the device's private facts and the pattern
// memory ids its openings already named (a canvas list is still accepted and ignored since Nov 3: the line plans nothing);
// GET is the same without them. pick is always null since Nov 3 (she picks the goal). noticed: the pattern memory this
// opening names (learned on an earlier day, not in heard), for the browser to add to heard. With nothing real to say
// (Nov 4), opening is GET /api/day's rule line, often "", and no model is asked.
export type OpeningResponse =
  | { state: "ok"; opening: string; options: string[]; pick: FirstPick | null; noticed?: string[] }
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
      // A goal to remove or mark done, only once she taps to confirm (see GoalConfirm).
      confirm?: GoalConfirm | null;
    }
  | { state: "signed-out" | "no-key" | "bad-request" | "model-error" };

// An email Zeno wrote for the person to send themselves (Vi, Nov 2: no sending service). `to` is empty or an address
// from their own recent mail, never one the model made up. `url` opens it in Gmail's compose window for this account,
// where they press Send.
export type EmailDraft = { to: string; subject: string; body: string; url: string };

// POST /api/goal body: { title, due?, steps: { title, minutes }[], start?: boolean }. Saves the plan without
// the model; start: true also starts step 1, so a tap starts the timer at once.
export type GoalResponse =
  // others: more goals made from the same words (POST /api/goal/add, when one message named several goals); thinking:
  // what that plan rests on, up to 5 lines of at most 60 characters, shown as it opens (POST /api/goal/add only).
  | { state: "ok"; goal: Goal; others?: Goal[]; thinking?: string[] }
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

// One of the home's goal options (Vi, Nov 3: she picks the goal, Zeno picks the step): an open plan, a deadline with no
// plan yet, or an email that asks her something.
export type Choice =
  | { kind: "plan"; goal: Goal }
  | { kind: "deadline"; deadline: Deadline }
  | { kind: "mail"; email: DayEmail };

// POST /api/goal/activate body: { id }: that open plan becomes the current one; the old current plan is paused, not lost.
// Answers with GoalResponse.
export type ActivateRequest = { id: string };

// POST /api/goal/plan body: Muse breaks a deadline into small steps (the first about 5 minutes) and saves them as the
// current plan. canvas is the matching assignment from this device's Canvas list, when there is one. Answers with
// GoalResponse.
export type PlanRequest = { title: string; due: string | null; canvas?: CanvasBrief };

// GET /api/mail/[id]: one email from the person's own inbox, read in full for the Desk and an email's goal desk. The
// text is cleaned and capped in memory; Zeno never stores, logs or sends it to the model.
export type MailResponse =
  | { state: "ok"; from: string; address: string; subject: string; date: string; text: string }
  | { state: "signed-out" | "bad-request" | "not-found" | "error" };

// Mail that helps (Vi, Nov 4). POST /api/mail/lines body { ids }: up to 6 important emails. lines: one each by id, what
// it asks and by when, from one Muse call; code, bank and private mail never reaches it and gets none. The page keeps
// them on the device for the day, so GET /api/day stays instant.
export type MailLinesResponse = { state: "ok"; lines: Record<string, string> } | { state: "signed-out" | "bad-request" | "error" };

// POST /api/mail/[id]/draft: Muse's short reply in her voice, which she edits and sends herself from Gmail's compose
// window; Zeno never sends mail. private: code, bank or private mail, which never reaches the model.
export type DraftResponse =
  | { state: "ok"; draft: string; to: string; subject: string }
  | { state: "signed-out" | "bad-request" | "not-found" | "private" | "error" };

// GET /api/mail ("Show all mail"): the newest 20 emails from every inbox tab, as the day's rows.
export type MailListResponse = { state: "ok"; emails: DayEmail[] } | { state: "signed-out" | "error" };

// GET /api/mail/waiting ("Waiting on"): up to 3 emails she sent 3+ days ago with no reply; to is the To header. Code and
// bank mail is left out.
export type WaitingResponse = { state: "ok"; waiting: { id: string; to: string; subject: string; sentAt: string }[] } | { state: "signed-out" | "error" };

// POST /api/goal/step body ("Add as a step"): one step from an email for one of her goals. Answers with GoalResponse.
export type AddStepRequest = { goalId: string; title: string };

// ---------- The Nov 3 night round (docs/PLAN-NOV3-APPS.md) ----------

// POST /api/goal/snap body: a photo or screenshot of an assignment, shrunk in the browser to a JPEG, PNG or WebP data
// URL under 3.5 MB. Muse Spark reads it once (never stored) and saves its steps as the current plan. Answers with
// GoalResponse; bad-request when the photo holds no assignment, error when what it found could not be worded without a
// private detail (Nov 4).
export type SnapRequest = { image: string };

// POST /api/app-token mints a personal token for connected apps (MCP clients such as Muse Code or Claude Code, and the
// Mac menu-bar clock), shown once; a new token turns the old one off. DELETE turns it off. Apps send it as
// "Authorization: Bearer zeno_…". It reaches goals and steps only, never mail, calendar or memories.
export type AppTokenResponse = { state: "ok"; token: string } | { state: "off" } | { state: "signed-out" | "error" };

// GET /api/companion/now (token auth): the step to show in the Mac menu bar. step is the running step, else the
// current plan's next todo step, else null; goal is the current plan's summary.
export type CompanionNow =
  | {
      state: "ok";
      step: { id: string; title: string; minutes: number | null; startedAt: string | null; status: "doing" | "todo" } | null;
      goal: { title: string; done: number; total: number; due: string | null } | null;
    }
  | { state: "unauthorized" | "error" };
// POST /api/companion/done (token auth) finishes the running step and answers with CompanionNow for what comes next.

// ---------- The Nov 4 overnight round: goals for anyone (docs/PLAN-NOV4-GOALS.md) ----------

// POST /api/goal/add body: the person's own words for a goal ("Run a 5K by January 10, I've never run"). Muse turns
// them into a short title, a due date when one is said, a rhythm when the goal keeps going, and the first steps, and
// saves it as the current plan. Answers with GoalResponse; bad-request when the words hold no goal, error when they held
// goals that could not be worded without a private detail (Nov 4: titles are stored, so the detail stays out).
// A goal too vague to plan well (one goal, no answers yet) answers "ask" with up to 2 questions of 2-3 tap answers each;
// the page asks them one at a time and posts the same text again with `answers`, and that call never asks (Vi, Nov 4).
// source: the app item the words come from, saved on the goal. A Google Doc's link in the words is read by the server
// (shared "Anyone with the link"); one it can't open answers "doc-private".
export type AddGoalRequest = { text: string; answers?: PlanAnswer[]; source?: GoalSource };
export type PlanQuestion = { question: string; options: string[] };
export type PlanAnswer = { question: string; answer: string };
export type AddGoalResponse = GoalResponse | { state: "ask"; questions: PlanQuestion[] } | { state: "doc-private" };

// POST /api/goal/next body: a goal that keeps going (rhythm set) gets its next few steps from what is done so far.
// Answers with GoalResponse. It never changes which goal is current: the goal comes back with its status as it was.
export type NextStepsRequest = { id: string };

// A finished step for the Week: its title, its goal's title, when it was done (ISO) and its real minutes when known.
export type DoneStep = { title: string; goal: string; doneAt: string; minutes: number | null };

// POST /api/goal/remove body { id, undo? } and POST /api/goal/finish body { id } (Nov 4, Vi: "no simple delete goal"),
// called only from a tap. Remove takes the goal out of every list and count, kept so undo: true brings it back (paused,
// or current when no goal is); Finish marks it done, a goal that keeps going too, and closes its open steps. current is
// the current goal after (when the goal was current, the most recently paused one); goal is the one an undo restored.
// bad-request for a goal that is not theirs or not open (not removed, for an undo).
export type CloseGoalRequest = { id: string; undo?: boolean };
export type CloseGoalResponse = { state: "ok"; current: Goal | null; goal?: Goal } | { state: "signed-out" | "bad-request" | "error" };

// A goal change talk only proposes (Nov 4: "drop the 5K goal", "I finished the paper"): the page shows Remove or Mark
// done for that goal, and only the tap calls the route above.
export type GoalConfirm = { id: string; title: string; how: "remove" | "finish" };
