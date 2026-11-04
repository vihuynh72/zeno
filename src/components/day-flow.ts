// Pure rules behind the Guided day screens. `node src/components/day-flow.check.ts` runs them (it maps "@/").
import {
  MEMORY_GROUPS,
  type CalendarBlock,
  type CanvasAssignment,
  type Choice,
  type DayEmail,
  type DayEvent,
  type Deadline,
  type FreeSlot,
  type Goal,
  type MemoryGroup,
  type Progress,
  type Step,
  type StepStatus,
  type TalkAction,
} from "@/lib/day";
import { senderName } from "@/components/desk-rows";
import { dayBounds, formatTime, localDate } from "@/lib/tz";

// setup is first sign-in (the scan, then what it found), ready the card, checkin the screen after Done, wrap the one
// after Stop for now or That's enough today.
export type Screen = "signed-out" | "setup" | "ready" | "talk" | "focus" | "checkin" | "wrap";

// The plain names the Memory sheet shows, in MEMORY_GROUPS order (docs/PLAN-NOV.md).
export const GROUP_NAMES: Record<MemoryGroup, string> = {
  about: "About you",
  routines: "Routines",
  projects: "Projects & deadlines",
  interests: "Interests & goals",
  people: "People",
  "work-style": "How you work best",
  patterns: "Patterns Zeno noticed",
};

// The home's hello (Vi, Nov 3): "Morning, Maya." to noon, "Hey Maya." to 5 PM, then "Evening, Maya."; before 5 AM it
// is still the night before for most people, not morning.
export function greeting(hour: number, firstName: string | null) {
  const who = firstName ? `, ${firstName}` : "";
  if (hour < 5) return `Still up${who}?`;
  if (hour < 12) return `Morning${who}.`;
  return hour < 17 ? `Hey${firstName ? ` ${firstName}` : ""}.` : `Evening${who}.`;
}

// The step being done comes first, then the rest still to do, in roadmap order.
export function openSteps(goal: Goal | null): Step[] {
  const steps = goal?.steps ?? [];
  return [...steps.filter((s) => s.status === "doing"), ...steps.filter((s) => s.status === "todo")];
}

// Where a reply from /api/talk leaves the person: a plan made or changed shows as the card (its first step, ready to
// start); talking during focus keeps the timer's card while a step is open, even through a change to the steps after it
// (Nov 4: nothing stops a running clock), and talking on a goal's desk (`desk`) keeps its card, with Zeno's line under
// it; anything else is talk.
export function nextScreen(screen: Screen, actions: TalkAction[], goal: Goal | null, desk = false): Screen {
  const did = (type: TalkAction["type"]) => actions.some((a) => a.type === type);
  const running = goal?.steps.some((s) => s.status === "doing");
  if (did("step-started") && running) return "focus";
  if (screen === "focus" && running && !did("step-finished")) return "focus";
  if ((did("goal-set") || did("roadmap-changed")) && openSteps(goal).length > 0) return "ready";
  if (did("step-finished")) return "checkin";
  const open = openSteps(goal).length > 0;
  return screen === "focus" && open ? "focus" : desk && open ? "ready" : "talk";
}

// A saved line comes back only on the same date and part of the day, so a morning line never greets the evening.
export function dayPart(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${greeting(date.getHours(), null)}`;
}

// Words that, on their own, only say yes to a booking offer ("Yes, book it", "Sounds good", "Lock it in"); a reply
// with any other word ("not", "later", a time) means more than yes.
const YES_WORDS = new Set(
  "yes yeah yep yup sure ok okay alright cool sounds good great perfect works absolutely definitely please thanks thank you thing lets do go ahead it that this for me book block add schedule lock in put on to my calendar".split(" "),
);
const onlyYes = (reply: string) => {
  const words = reply.toLowerCase().replace(/['’]/g, "").match(/[a-z]+|\d+/g) ?? [];
  return words.length > 0 && words.every((word) => YES_WORDS.has(word));
};

// Quick replies as the server sent them, kept to three short non-empty strings whatever arrives. Beside a booking
// offer its chip is the one way to book, so replies that only say yes go and two stay (three chips with Something else).
export function quickReplies(options: unknown, offered = false): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((o): o is string => typeof o === "string" && o.trim() !== "")
    .map((o) => o.trim().slice(0, 80))
    // Chips are keyed by label and the card adds its own "Something else", so no label may repeat.
    .filter((o, i, all) => all.indexOf(o) === i && !/^something else\W*$/i.test(o) && !(offered && onlyYes(o)))
    .slice(0, offered ? 2 : 3);
}

// Zeno's tap answers on a step's screen, less the ones its own buttons already are or that only put it off (Nov 4): a
// second Start reset a running clock, and a second Done or Stop for now read as another action (live, Nov 3). A bare
// "Yes" stays: it answers the question.
const ECHOES = new Set(
  ["start", "start now", "start it", "begin", "go", "go ahead", "ready", "im ready", "lets go", "lets start", "lets do it", "lets do this", "do it",
    "do it now", "not now", "not yet", "not today", "later", "maybe later", "pause", "take a break", "help", "need help", "i need help", "stuck",
    "im stuck", "did it", "i did it", "all done", "im done"],
);
export function extraReplies(options: string[]): string[] {
  return options.filter((option) => {
    const words = option.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const rest = words.replace(/^(yes|yeah|yep|ok|okay|sure)\b ?/, "");
    return rest === "" || !(ECHOES.has(rest) || /^(done|finished|stop)\b/.test(rest));
  });
}

// Whether a spoken line asks something, so hands-free listening opens the mic after it.
export const asks = (line: string) => /\?["'”’)]*$/.test(line.trim());

// Longer lines get a smaller hand so a reply still fits the card.
export function cardSize(text: string): "l" | "m" | "s" {
  return text.length <= 90 ? "l" : text.length <= 160 ? "m" : "s";
}

// The Focus stopwatch, M:SS from 0:00 ("75:03" past an hour).
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- The home and a goal's desk (Vi, Nov 3: she picks the goal, Zeno picks the step) ----------

// Lowercase, with every run of characters that are not letters or digits made one space.
const titleKey = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Two titles name the same goal when either holds the other ("Essay 2" and "HIST 110: essay 2!").
export function sameTitle(a: string, b: string) {
  const [x, y] = [titleKey(a), titleKey(b)];
  return x !== "" && y !== "" && (x.includes(y) || y.includes(x));
}

const DAY_MS = 86_400_000;
const daysFrom = (today: string, date: string) => Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
const choiceDue = (choice: Choice) => (choice.kind === "plan" ? choice.goal.due ?? null : choice.kind === "deadline" ? choice.deadline.date : null);
const byDue = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

// Every plan with a step open, the current one first and as the page has it now (the day's copy of it may be older).
export function openPlans(goal: Goal | null, goals: Goal[]): Goal[] {
  const plans: Goal[] = [];
  for (const plan of [goal, ...goals]) if (plan && openSteps(plan).length > 0 && !plans.some((one) => one.id === plan.id)) plans.push(plan);
  return plans;
}

// The home's goal options, at most 3 (a few options raise motivation, many lower it): the current plan first while a
// step of it is open, then the other open plans and the deadlines due within 7 days that no open plan covers, soonest
// first (no due date last). The newest email that asks something takes the third slot, unless it already became a plan
// here (`handled`: email ids, see mailPlan).
export function homeChoices(goal: Goal | null, goals: Goal[], deadlines: Deadline[], emails: DayEmail[], today: string, handled: string[] = []): Choice[] {
  const plans = openPlans(goal, goals);
  const current = goal && plans[0]?.id === goal.id ? plans[0] : null;
  const soon = deadlines.filter((deadline, i) => {
    const days = daysFrom(today, deadline.date);
    const covered = [...plans.map((plan) => plan.title), ...deadlines.slice(0, i).map((one) => one.title)].some((title) => sameTitle(title, deadline.title));
    return days >= 0 && days <= 7 && !covered;
  });
  const rest: Choice[] = [
    ...plans.filter((plan) => plan !== current).map((plan): Choice => ({ kind: "plan", goal: plan })),
    ...soon.map((deadline): Choice => ({ kind: "deadline", deadline })),
  ].sort((a, b) => byDue(choiceDue(a), choiceDue(b)));
  const list: Choice[] = current ? [{ kind: "plan", goal: current }, ...rest] : rest;
  const mail = emails.find((email) => email.asks === true && email.id && !handled.includes(email.id));
  return mail ? [...list.slice(0, 2), { kind: "mail", email: mail }] : list.slice(0, 3);
}

export type ChoiceCard = { title: string; minutes: number | null; meta: string; last: string };

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
// The sender as an option and a plan name them: a bare address by the part before its "@" (titles never hold an address).
const sender = (from: string) => senderName(from).split("@")[0] || senderName(from);

// An option card's words: the title (minutes on the right), a grey line, and a last line. `currentId` is the current
// plan's, which picks up where she stopped.
export function choiceCard(choice: Choice, currentId: string | null, today: string): ChoiceCard {
  if (choice.kind === "mail") {
    const name = sender(choice.email.from);
    return { title: `Answer ${name}`, minutes: 2, meta: `Email · ${name}`, last: choice.email.subject };
  }
  if (choice.kind === "deadline") {
    const { title, date } = choice.deadline;
    const due = dueLabel(date, today);
    return { title, minutes: null, meta: ["not started", dueLabel(date, today, "short")].filter(Boolean).join(" · "), last: due && `${capital(due)}.` };
  }
  const { goal } = choice;
  const done = goal.steps.filter((step) => step.status === "done").length;
  const next = openSteps(goal)[0];
  const resumes = goal.id === currentId && (done > 0 || next?.status === "doing");
  return {
    title: goal.title,
    minutes: next?.minutes ?? null,
    // No count of 0: the font's slashed zero read as "Ø" (Nov 3).
    meta: [done ? `${done} of ${goal.steps.length} done` : "not started", goal.due ? dueLabel(goal.due, today, "short") : ""].filter(Boolean).join(" · "),
    last: resumes ? "Picks up where you stopped." : next ? `Next: ${next.title}` : "",
  };
}

// The plan an email that asks something becomes: one 2-minute reply, named for its sender and subject (cut to 40
// characters at a word), or plain words when the API refuses those.
export function mailPlan(email: DayEmail | null) {
  if (!email) return { title: "Answer an email", steps: [{ title: "Reply to the email", minutes: 2 }] };
  const name = sender(email.from);
  const subject = email.subject.trim();
  const cut = subject.slice(0, 41);
  const about = subject.length <= 40 ? subject : (/\s/.test(cut) && cut.replace(/\s+\S*$/, "")) || subject.slice(0, 40);
  return { title: `Answer ${name}`, steps: [{ title: about ? `Reply to ${name} about ${about}` : `Reply to ${name}`, minutes: 2 }] };
}

// The step Zeno proposes on the desk: the one she tapped while it is still open, else the first open one.
export const proposedStep = (goal: Goal | null, id: string | null): Step | null =>
  openSteps(goal).find((step) => step.id === id) ?? openSteps(goal)[0] ?? null;

// "Another step": the open step after the proposed one, round again after the last.
export function nextProposal(goal: Goal | null, id: string | null): string | null {
  const open = openSteps(goal);
  if (open.length === 0) return null;
  return open[(Math.max(0, open.findIndex((step) => step.id === id)) + 1) % open.length].id;
}

// The first todo step a plan change added or reworded, in plan order ("Make it smaller"'s first piece, even when Zeno
// renamed the step into it rather than adding one: live, Nov 3, the bigger rest was proposed); null for none.
export const addedStep = (before: Goal | null, after: Goal | null) =>
  after?.steps.find((step) => step.status === "todo" && !before?.steps.some((old) => old.id === step.id && old.title === step.title))?.id ?? null;

// The desk's steps list (Nov 4): every done or skipped step and the next `room` open ones (more when the marked one is
// further on); the open steps after those wait under "Later (N)".
export function splitLater(steps: Step[], marked?: string, room = 5): { shown: Step[]; later: number } {
  const open = steps.filter((step) => step.status === "todo" || step.status === "doing");
  const hidden = new Set(open.slice(Math.max(room, open.findIndex((step) => step.id === marked) + 1)).map((step) => step.id));
  return { shown: steps.filter((step) => !hidden.has(step.id)), later: hidden.size };
}

// A step left running when the page opens, so it goes straight to Focus; one started 3 hours ago or more (a tab closed
// mid-step yesterday) opens on the home instead.
// shortcut: 3 hours is a guess at the longest real focus; ask Vi if a step runs longer.
export function runningStep(goal: Goal | null, now: number): Step | null {
  const step = goal?.steps.find((one) => one.status === "doing");
  const ran = now - Date.parse(step?.startedAt ?? "");
  return step && ran >= 0 && ran < 3 * 3_600_000 ? step : null;
}

// How long a finished step really took, from its start to its done; null without both.
export function realMinutes(step: Step): number | null {
  const ms = Date.parse(step.doneAt ?? "") - Date.parse(step.startedAt ?? "");
  return ms >= 0 ? Math.max(1, Math.round(ms / 60_000)) : null;
}

// "45 min", "2 h", "1 h 25 min".
export function duration(minutes: number) {
  const m = Math.max(1, Math.floor(minutes));
  const [h, rest] = [Math.floor(m / 60), m % 60];
  return h === 0 ? `${rest} min` : rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

// The goal strip's caption: "3 of 7 done", and right after a Done, once more than half is done, "4 of 7 · over halfway".
// None done is said in words: the font's slashed zero read as "Ø of 5 done" (Nov 3).
export const barCaption = (done: number, total: number, justDone = false) =>
  done === 0
    ? total === 1
      ? "Not done yet"
      : `None of ${total} done yet`
    : justDone && done * 2 > total && done < total
      ? `${done} of ${total} · over halfway`
      : `${done} of ${total} done`;

const localDay = (iso: string, timeZone: string) => localDate(timeZone, new Date(iso));

// "Where you stopped": the newest done step, "Draft the thesis · done yesterday in 12 min", by the person's `today`
// (YYYY-MM-DD in `timeZone`); null before any.
export function stoppedLine(goal: Goal | null, timeZone: string, today: string): string | null {
  const last = (goal?.steps ?? [])
    .filter((step) => step.status === "done" && !Number.isNaN(Date.parse(step.doneAt ?? "")))
    .sort((a, b) => Date.parse(b.doneAt ?? "") - Date.parse(a.doneAt ?? ""))[0];
  if (!last?.doneAt) return null;
  const date = localDay(last.doneAt, timeZone);
  const ago = daysFrom(date, today);
  if (Number.isNaN(ago)) return null;
  const day = new Date(`${date}T12:00:00Z`);
  const when =
    ago <= 0
      ? "today"
      : ago === 1
        ? "yesterday"
        : day.toLocaleDateString("en-US", { timeZone: "UTC", ...(ago < 7 ? { weekday: "long" } : { month: "short", day: "numeric" }) });
  const minutes = realMinutes(last);
  return `${last.title} · done ${when}${minutes ? ` in ${minutes} min` : ""}`;
}

// The wrap line's "Today: 2 steps, 41 min.": steps finished today across the plans (each counted once, the first copy
// of a plan winning), with the minutes they really took when known; null when none.
export function todayLine(plans: (Goal | null)[], timeZone: string, now: Date): string | null {
  const today = localDate(timeZone, now);
  const done = new Map<string, Step>();
  for (const step of plans.flatMap((plan) => plan?.steps ?? [])) {
    if (step.status === "done" && step.doneAt && localDay(step.doneAt, timeZone) === today && !done.has(step.id)) done.set(step.id, step);
  }
  if (done.size === 0) return null;
  const minutes = [...done.values()].reduce((sum, step) => sum + (realMinutes(step) ?? 0), 0);
  return `Today: ${done.size} ${done.size === 1 ? "step" : "steps"}${minutes ? `, ${duration(minutes)}` : ""}.`;
}

// After a Done, "You have 1 h 25 min until BIO 101.": now is in a free slot that ends where one of today's events
// begins (never Zeno's own block, and not the end of the waking day); null otherwise.
export function untilNext(events: DayEvent[], free: FreeSlot[], now: number): string | null {
  const slot = free.find((one) => Date.parse(one.start) <= now && now < Date.parse(one.end));
  if (!slot) return null;
  const end = Date.parse(slot.end);
  const next = events.find((event) => !event.allDay && !event.zeno && Math.abs(Date.parse(event.start) - end) < 60_000 && event.title.trim());
  return next ? `You have ${duration((end - now) / 60_000)} until ${next.title.trim()}.` : null;
}

// What a saved model opening was written for: the plan (its id, each step's id, status, title and minutes) and the
// device's Canvas list (each assignment's id and due time). Any change to them asks the model again.
export const openingSig = (goal: Goal | null, canvas: Pick<CanvasAssignment, "id" | "due">[] | null) =>
  JSON.stringify([
    goal?.id ?? null,
    goal?.steps.map((step) => [step.id, step.status, step.title, step.minutes]) ?? [],
    canvas?.map((item) => [item.id, item.due]) ?? null,
  ]);

// A saved opening under 20 minutes old whose day still matches shows again on page load, with no model call (Vi wants
// Zeno cheaper to run), unless an event began or ended since ("Before CS 146 at 2…" is wrong at 2:03). One saved before
// it had a time and a signature is asked for again.
export function openingReusable(opening: { at?: string; sig?: string } | null | undefined, sig: string, now: number, events: DayEvent[]) {
  const at = Date.parse(opening?.at ?? "");
  const passed = (time: string) => Date.parse(time) > at && Date.parse(time) <= now;
  const changed = events.some((event) => !event.allDay && (passed(event.start) || passed(event.end)));
  return now - at >= 0 && now - at < 20 * 60_000 && opening?.sig === sig && !changed;
}

// The pattern ids this device's openings named, newest last and at most 20, with the ids in `noticed` added.
export function addHeard(heard: string[], noticed: unknown): string[] {
  const added = Array.isArray(noticed) ? noticed.filter((id): id is string => typeof id === "string") : [];
  return [...heard.filter((id) => !added.includes(id)), ...added].slice(-20);
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The Canvas item a plan is for: the plan's title holds the item's as whole words, any case ("Essay 2", or "HIST 110:
// Essay 2" as its deadline names it), so "Exam" never takes "Work the example problems". A one-word title (a bare "Quiz",
// kept for a title that held a code) needs its course in the plan too. One whose course the plan names comes first,
// then the longest title, so a bare "Quiz" never takes another course's "Quiz 7".
export function canvasFor<T extends { title: string; course?: string }>(plan: Goal | null, items: T[]): T | undefined {
  const title = plan?.title.toLowerCase() ?? "";
  const holds = (text = "") =>
    text.trim() !== "" && new RegExp(`(?<![\\p{L}\\p{N}])${escaped(text.trim().toLowerCase())}(?![\\p{L}\\p{N}])`, "u").test(title);
  return items
    .filter((item) => holds(item.title) && (/\s/.test(item.title.trim()) || holds(item.course)))
    .sort((a, b) => Number(holds(b.course)) - Number(holds(a.course)) || b.title.trim().length - a.title.trim().length)[0];
}

// Canvas linked or unlinked in its sheet re-plans the home card, only on that card (never mid-focus, after a Done, in
// talk or after stopping): a Connect when some of what it found is still due, a Disconnect always, since the card may
// hold one of the deadlines it took away.
export const replanOnCanvas = (screen: Screen | null, linked: boolean, found: Pick<CanvasAssignment, "submitted">[]) =>
  screen === "ready" && (!linked || found.some((item) => !item.submitted));

// What the screen after Done, or after a skip said in Focus, says: the next step, or that the plan is finished. A goal
// that keeps going (rhythm) is never finished: its next few are being planned (POST /api/goal/next).
export function doneLine(goal: Goal | null, skipped = false): string {
  const next = openSteps(goal)[0];
  if (!next && goal?.rhythm) return `${skipped ? "Skipped." : "Nice."} Planning your next few…`;
  if (!next) return `${skipped ? "Skipped. " : ""}That's all of ${goal?.title.replace(/[.!?]+$/, "") || "it"}.`;
  return `${skipped ? "Skipped." : "Nice."} Next: ${next.title.replace(/\.+$/, "")}${next.minutes ? `, ${next.minutes} min` : ""}.`;
}

// After a goal that keeps going got its next few steps: "Planned your next few: Run 20 min easy, then 2 more." Only the
// next one is named (live, Nov 4: three titles with their own commas read as one jumble); the steps list has them all.
export function nextFewLine(before: Goal | null, after: Goal): string {
  const added = after.steps.filter((step) => step.status === "todo" && !before?.steps.some((old) => old.id === step.id));
  if (added.length === 0) return "Planned your next few.";
  const first = added[0].title.replace(/[.!?]+$/, "");
  return `Planned your next few: ${first}${added.length > 1 ? `, then ${added.length - 1} more` : ""}.`;
}

// A line as Zeno says it: "15 min" is "15 minutes" and "1 h" is "1 hour".
export const spoken = (line: string) =>
  line
    .replace(/\b1 min(?![\w-])/g, "1 minute")
    .replace(/(\d) min(?![\w-])/g, "$1 minutes")
    .replace(/\b1 h(?![\w-])/g, "1 hour")
    .replace(/(\d) h(?![\w-])/g, "$1 hours");

// A step that is an email to write, so Focus offers to draft it in Gmail ("Draft an email to…", "Ask … by email"), never
// one to read ("Read the email from Dana").
export const isEmailStep = (title: string) =>
  /^(e-?mail|write to|reply to|message)\b|\b(draft|write|send|compose|answer)\b.*\be-?mail\b|\bby e-?mail\b/i.test(title.trim());

// A step that reads or looks things up, so the desk lays out Helpful links for it (Nov 4: never for "Put shoes out"
// or a landlord reply; any step still gets them on a tap).
export const isResearchStep = (title: string) =>
  /\b(read|reading|readings|research|look up|look into|search|sources?|articles?|papers?|studies|references?|citations?|examples?|compare|learn about)\b/i.test(
    title,
  );

// One step's new status, as the server will save it, so a tap shows at once.
export function withStatus(goal: Goal, stepId: string, status: StepStatus, now: Date): Goal {
  const at = now.toISOString();
  return {
    ...goal,
    steps: goal.steps.map((step) =>
      step.id === stepId
        ? { ...step, status, startedAt: status === "doing" ? at : status === "todo" ? null : step.startedAt, doneAt: status === "done" ? at : step.doneAt }
        : status === "doing" && step.status === "doing"
          ? { ...step, status: "todo", startedAt: null }
          : step,
    ),
  };
}

// Nothing resets a running clock (Nov 4): when `next` runs the same step as `before` from a later start (a save's
// answer, a start said again, or a smaller first piece carrying on its step's clock), the earlier start stays.
export function keepClock(before: Goal | null, next: Goal | null): Goal | null {
  const was = before?.steps.find((step) => step.status === "doing");
  const now = next?.steps.find((step) => step.status === "doing" && step.id === was?.id);
  if (!next || !now?.startedAt || !was?.startedAt || !(Date.parse(was.startedAt) < Date.parse(now.startedAt))) return next;
  return { ...next, steps: next.steps.map((step) => (step === now ? { ...step, startedAt: was.startedAt } : step)) };
}

// "due Friday" style (or "due Fri"), from YYYY-MM-DD dates; "" before the browser's clock.
export function dueLabel(due: string, today: string, weekday: "long" | "short" = "long"): string {
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  const date = new Date(`${due}T12:00:00Z`);
  const named = date.toLocaleDateString("en-US", { timeZone: "UTC", ...(days > 0 && days < 7 ? { weekday } : { month: "short", day: "numeric" }) });
  if (days < 0) return `was due ${named}`;
  return days === 0 ? "due today" : days === 1 ? "due tomorrow" : `due ${named}`;
}

// The goal strip's line under the title (Nov 4): "due Thu Nov 12 · 9 days left"; for a goal that keeps going, its rhythm
// and week, counted in Monday weeks from its first finished step ("3 runs a week · week 2"), with the days left when it
// also has a due date. "" before the browser's clock.
export function goalLine(goal: Pick<Goal, "due" | "rhythm" | "steps">, today: string, timeZone: string): string {
  const days = goal.due ? daysFrom(today, goal.due) : NaN;
  if (!today || (goal.due && Number.isNaN(days))) return "";
  const date = goal.due ? new Date(`${goal.due}T12:00:00Z`) : null;
  const named = date?.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).replace(",", "");
  const left = days < 0 ? `was due ${named}` : days === 0 ? "due today" : days === 1 ? "due tomorrow" : `${days} days left`;
  const rhythm = goal.rhythm?.trim();
  if (!rhythm) return goal.due ? (days > 1 ? `due ${named} · ${left}` : left) : "";
  const monday = (day: string) => Date.parse(day) - ((new Date(day).getUTCDay() + 6) % 7) * DAY_MS;
  const first = goal.steps.flatMap((step) => (step.status === "done" && step.doneAt ? [localDate(timeZone, new Date(step.doneAt))] : [])).sort()[0];
  const week = first ? Math.max(1, Math.round((monday(today) - monday(first)) / (7 * DAY_MS)) + 1) : 1;
  return [rhythm, `week ${week}`, goal.due ? left : ""].filter(Boolean).join(" · ");
}

// ---------- Calendar ----------

const FIVE = 5 * 60_000;

// Stopping offers one block tomorrow only for a big commitment (Vi, Nov 2): the plan's open steps add up to an hour or
// more and none of it is booked yet. The block's minutes, at most two hours, or 0 when there is nothing to offer.
export function laterMinutes(goal: Goal | null): number {
  const open = openSteps(goal);
  const total = open.reduce((sum, step) => sum + (step.minutes ?? 10), 0);
  return total >= 60 && !open[0].scheduledAt ? Math.min(total, 120) : 0;
}

// That block in tomorrow's earliest free time that fits (a 5-minute start, at least half an hour out), linked to the
// plan's first open step and named as it is saved, so the calendar says what tomorrow's card says (Vi, Nov 2); null
// when tomorrow has no room.
export function laterBlock(goal: Goal, minutes: number, slots: FreeSlot[], timeZone: string, now = new Date()): CalendarBlock | null {
  const step = openSteps(goal)[0];
  if (!step) return null;
  const tomorrow = dayBounds(timeZone, now).end;
  const dayAfter = dayBounds(timeZone, tomorrow).end.getTime();
  const from = Math.max(tomorrow.getTime(), now.getTime() + 30 * 60_000);
  for (const slot of slots) {
    const start = Math.ceil(Math.max(Date.parse(slot.start), from) / FIVE) * FIVE;
    const end = start + minutes * 60_000;
    if (start < dayAfter && end <= Date.parse(slot.end)) {
      return { title: step.title, kind: "step", start: new Date(start).toISOString(), end: new Date(end).toISOString(), stepId: step.id };
    }
  }
  return null;
}

export function isTomorrow(iso: string, timeZone: string, now = new Date()) {
  return localDate(timeZone, new Date(iso)) === localDate(timeZone, dayBounds(timeZone, now).end);
}

const dayWord = (iso: string, timeZone: string, now: Date) =>
  localDate(timeZone, new Date(iso)) === localDate(timeZone, now)
    ? ""
    : `${isTomorrow(iso, timeZone, now) ? "tomorrow" : new Date(iso).toLocaleDateString("en-US", { timeZone, weekday: "short" })} `;

// "9:30–9:40 AM", "tomorrow 9:30–9:40 AM" or "Mon 9:30–9:40 AM".
export function slotLabel(start: string, end: string, timeZone: string, now = new Date()): string {
  const [from, to] = [formatTime(start, timeZone), formatTime(end, timeZone)];
  const same = from.slice(-2) === to.slice(-2);
  return `${dayWord(start, timeZone, now)}${same ? from.slice(0, -3) : from}–${to}`;
}

// The first of today's timed events starting in the next `within` ms (not already started). Never Zeno's own block:
// Zeno's items never notify (Vi), in the app either.
export function soonEvent(events: DayEvent[], now: number, within = 10 * 60_000): DayEvent | null {
  return events.find((event) => !event.allDay && !event.zeno && Date.parse(event.start) > now && Date.parse(event.start) - now <= within) ?? null;
}

// ---------- Streaks ----------

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function streakLine(progress: Progress) {
  const steps = progress.stepsThisWeek;
  return `Day ${progress.streak} · ${steps} ${steps === 1 ? "step" : "steps"} this week`;
}

// ---------- Focus: a stopwatch and one quiet check-in (Vi, Nov 3: "I don't want any alarm") ----------

// The step's one check-in, in minutes from its start: Muse's planned minutes at the person's pace (GET /api/day; 1 until
// it is known), never under 3.
export const checkinMinute = (planned: number, pace?: number) =>
  Math.max(3, Math.round(planned * (pace && Number.isFinite(pace) && pace > 0 ? pace : 1)));

const WRAP_UPS = ["Finish the line you're on, then Done.", "Wrap up this bit, then Done.", "Get it to a stopping point, then Done."];

// The lines under the Focus card, shown and never said: calm (the planned minutes are on the card already), the
// check-in for its minute (then calm again, however long the step runs), and the welcome back after the page was hidden
// a minute or more.
export const FOCUS = {
  calm: "I'll stay quiet.",
  checkin: (minute: number) => `${minute} min in. ${WRAP_UPS[minute % WRAP_UPS.length]}`,
  back: (startedAt: string, now: number) => `Back. ${Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000))} min on this.`,
};

// ---------- Memory ----------

export type Fact = { id: string; text: string; group: MemoryGroup; device: boolean };

// What first sign-in's scan learned, said in one line without the model. The scan files exams and deadlines under
// projects with undated projects, so a deadline is a projects fact that names a day.
const DATED = /\bdue\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i;
export function foundLine(facts: { group: MemoryGroup; text: string }[]): string {
  if (facts.length === 0) return "I couldn't find much yet. I'll learn as you go.";
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const deadlines = facts.filter((fact) => fact.group === "projects" && DATED.test(fact.text)).length;
  return `I read your calendar and email and learned ${count(facts.length, "thing")}${deadlines ? `, including ${count(deadlines, "deadline")}` : ""}.`;
}

// Memory's Add box: a line break, or more than one memory's 200 characters, is pasted notes (POST /api/import).
export const isNotes = (text: string) => text.includes("\n") || [...text].length > 200;

// The Memory sheet's groups in order, each with its plain name; empty groups are left out.
export function groupFacts(facts: Fact[]): { group: MemoryGroup; name: string; facts: Fact[] }[] {
  const groupOf = (fact: Fact) => (MEMORY_GROUPS.includes(fact.group) ? fact.group : "about");
  return MEMORY_GROUPS.map((group) => ({ group, name: GROUP_NAMES[group], facts: facts.filter((fact) => groupOf(fact) === group) })).filter(
    (entry) => entry.facts.length > 0,
  );
}

// ---------- The goals panel (Nov 4: a sidebar on a laptop, the home on a phone; docs/PLAN-NOV4-GOALS.md, shell) ----------

// The panel's goals: the open plans by due date (undated last), then by title, so the order holds across reloads and
// never follows which plan is current.
export const panelGoals = (plans: Goal[]) =>
  [...plans].sort((a, b) => byDue(a.due ?? null, b.due ?? null) || a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1));

// "Suggestions" under the goals: deadlines due within 7 days that no open plan covers, soonest first, then the newest
// email that asks something and has no plan here yet (`handled`: email ids). 3 at most; the email keeps its slot.
export function panelSuggestions(plans: Goal[], deadlines: Deadline[], emails: DayEmail[], today: string, handled: string[] = []): Choice[] {
  const soon = deadlines
    .filter((deadline, i) => {
      const days = daysFrom(today, deadline.date);
      const titles = [...plans.map((plan) => plan.title), ...deadlines.slice(0, i).map((one) => one.title)];
      return days >= 0 && days <= 7 && !titles.some((title) => sameTitle(title, deadline.title));
    })
    .sort((a, b) => byDue(a.date, b.date));
  const list: Choice[] = soon.map((deadline) => ({ kind: "deadline", deadline }));
  const mail = emails.find((email) => email.asks === true && email.id && !handled.includes(email.id));
  return mail ? [...list.slice(0, 2), { kind: "mail", email: mail }] : list.slice(0, 3);
}

// "due Thu Nov 12 · 9 days left", "due today", "due tomorrow", or "was due Mon Nov 2" once it has passed, from
// YYYY-MM-DD dates; "" before the browser's clock.
export function dueLine(due: string, today: string): string {
  const days = daysFrom(today, due);
  if (Number.isNaN(days)) return "";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  const date = new Date(`${due}T12:00:00Z`);
  const named = date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).replace(",", "");
  return days < 0 ? `was due ${named}` : `due ${named} · ${days} days left`;
}

export type PanelRow = { title: string; aside: string; line: string; when: string };

// A goal row's words: its next step ("Now:" while it runs; the desk's own pick for the open goal, so the two never
// disagree), and when it is due or how often it repeats.
export function goalRow(goal: Goal, today: string, proposed?: Step | null): PanelRow {
  const open = openSteps(goal);
  const next = open.find((step) => step.id === proposed?.id) ?? open[0];
  return {
    title: goal.title,
    aside: "",
    line: next ? `${next.status === "doing" ? "Now" : "Next"}: ${next.title.replace(/\.+$/, "")}${next.minutes ? ` · ${next.minutes} min` : ""}` : "",
    when: [goal.rhythm?.trim(), goal.due ? dueLine(goal.due, today) : ""].filter(Boolean).join(" · "),
  };
}

// A suggestion row's words: a deadline to plan, or an email to answer in 2 minutes.
export function suggestionRow(choice: Choice, today: string): PanelRow {
  if (choice.kind === "mail") return { title: `Answer ${sender(choice.email.from)}`, aside: "2 min", line: choice.email.subject.trim(), when: "" };
  if (choice.kind === "deadline") return { title: choice.deadline.title, aside: "Plan it", line: "", when: dueLine(choice.deadline.date, today) };
  return goalRow(choice.goal, today);
}
