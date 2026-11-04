import type { JsonSchemaType } from "@modelcontextprotocol/server";
import { checkPlanRequest, savePlan } from "@/lib/agent";
import { bearerOf, tokenOwner, type TokenOwner } from "@/lib/app-token";
import type { CompanionNow, Goal, Step } from "@/lib/day";
import { ensureSchema, getSql } from "@/lib/db";
import { activateGoal, changeStepStatus, currentGoal, isId, openGoals } from "@/lib/goals";
import { localDate } from "@/lib/tz";
import { runningStep } from "@/components/day-flow";

// What a connected app can do with its token (docs/PLAN-NOV3-APPS.md): the MCP tools at /api/mcp and the Mac clock's
// /api/companion. Goals and steps only, never mail, calendar or memories. The person is always the token's owner, never
// an argument, and every query names their email.

export type Said = { text: string; isError?: true };
const refuse = (text: string): Said => ({ text, isError: true });

// The running step first, then the rest still to do, in roadmap order (as day-flow's openSteps).
const openOf = (goal: Goal) => [...goal.steps.filter((step) => step.status === "doing"), ...goal.steps.filter((step) => step.status === "todo")];
const doneOf = (goal: Goal) => goal.steps.filter((step) => step.status === "done").length;

const minutesSince = (iso: string, now: Date) => Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));

// "Outline the thesis · 15 min · started 4 min ago · id …": the id is what start_step and finish_step take.
export const stepLine = (step: Step, now = new Date()) =>
  [
    step.title,
    step.minutes && `${step.minutes} min`,
    step.status === "doing" && step.startedAt && `started ${minutesSince(step.startedAt, now)} min ago`,
    `id ${step.id}`,
  ]
    .filter(Boolean)
    .join(" · ");

export const goalLine = (goal: Goal) =>
  [goal.title, goal.rhythm, `${doneOf(goal)} of ${goal.steps.length} done`, goal.due && `due ${goal.due}`].filter(Boolean).join(" · ");

// A goal that keeps going never runs out (Nov 4): with no step left, Zeno plans its next few when it opens there. No model
// call here.
const planNext = (goal: Goal) => `Nothing next yet in ${goal.title}: open Zeno to plan the next few.`;

const stepsText = (goal: Goal, now = new Date()) => {
  const open = openOf(goal).map((step) => `- ${step.status === "doing" ? "running" : "todo"}: ${stepLine(step, now)}`);
  return open.length === 0 && goal.rhythm ? [`- ${planNext(goal)}`] : open;
};

// list_goals: every open plan, in openGoals' order, with its open steps.
export function goalsText(goals: Goal[], currentId: string | null, now = new Date()): string {
  if (goals.length === 0) return "No open goals. plan_goal makes one.";
  return goals
    .map((goal) => [`${goalLine(goal)}${goal.id === currentId ? " · current" : ""}`, ...stepsText(goal, now)].join("\n"))
    .join("\n\n");
}

// A step started 3 hours ago or more counts as not running, as on the web (day-flow's runningStep): a tab closed
// mid-step yesterday never shows as running in the Mac clock or next_step, and Done never finishes it (review, Nov 3).
export function settled(goal: Goal | null, now = Date.now()): Goal | null {
  if (!goal) return null;
  const running = runningStep(goal, now);
  return { ...goal, steps: goal.steps.map((step) => (step.status === "doing" && step !== running ? { ...step, status: "todo", startedAt: null } : step)) };
}

// next_step: the current plan's running step, else its next one.
export function nextText(raw: Goal | null, now = new Date()): string {
  const goal = settled(raw, now.getTime());
  if (!goal) return "No current goal. list_goals shows your goals, and plan_goal makes one.";
  const step = openOf(goal)[0];
  if (!step) return goal.rhythm ? planNext(goal) : `Every step of ${goal.title} is done. plan_goal makes a new goal.`;
  return `${step.status === "doing" ? "Running" : "Next"}: ${stepLine(step, now)}\nGoal: ${goalLine(goal)}`;
}

// GET /api/companion/now: the same step for the Mac menu bar, in the CompanionNow shape.
export function nowOf(raw: Goal | null, now = Date.now()): CompanionNow {
  const goal = settled(raw, now);
  const step = goal && openOf(goal)[0];
  return {
    state: "ok",
    step: step ? { id: step.id, title: step.title, minutes: step.minutes, startedAt: step.startedAt, status: step.status === "doing" ? "doing" : "todo" } : null,
    goal: goal && { title: goal.title, done: doneOf(goal), total: goal.steps.length, due: goal.due ?? null },
  };
}

export const companionNow = async (email: string) => nowOf(await currentGoal(email));

// The current plan's running step, finished (with changeStepStatus, as the app's Done); null when no step is running.
async function finishRunning(email: string) {
  const step = settled(await currentGoal(email))?.steps.find((one) => one.status === "doing");
  return step ? { step, changed: await changeStepStatus(email, step.id, "done") } : null;
}

// POST /api/companion/done: finishes the running step, then says what comes next. With none running it changes nothing.
export async function companionDone(email: string): Promise<CompanionNow> {
  await finishRunning(email);
  return companionNow(email);
}

// Both companion routes: the bearer token's owner, else 401; a failure is 500 with nothing about the person.
export async function companionReply(request: Request, act: (email: string) => Promise<CompanionNow>): Promise<Response> {
  const json = (body: CompanionNow, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  // Outside the try: reading the headers is where the build learns the route is dynamic, and that signal must not be caught.
  const token = bearerOf(request);
  try {
    const owner = token ? await tokenOwner(token) : null;
    return owner ? json(await act(owner.email)) : json({ state: "unauthorized" }, 401);
  } catch (error) {
    console.error("Companion failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return json({ state: "error" }, 500);
  }
}

// One of this person's open steps (todo or running) with its plan, or null.
async function openStep(email: string, id: unknown): Promise<{ goal: Goal; step: Step } | null> {
  if (!isId(id)) return null;
  for (const goal of await openGoals(email)) {
    const step = openOf(goal).find((one) => one.id === id);
    if (step) return { goal, step };
  }
  return null;
}

const NO_STEP = "No open step has that id. next_step or list_goals shows the ids.";

// shortcut: counts every plan made in the last 24 hours, the app's own too; count connected-app plans alone if 20 ever bites.
export const PLANS_PER_DAY = 20;

async function planGoal(owner: TokenOwner, args: Record<string, unknown>): Promise<Said> {
  const today = localDate(owner.timeZone);
  const plan = checkPlanRequest({ title: args.title, due: args.due }, today);
  if (!plan) return refuse("Give a title of 1 to 120 characters with nothing private in it, and a due date (YYYY-MM-DD) of today or later, or none.");
  await ensureSchema();
  const [made] = await getSql()`
    SELECT count(*)::int AS plans FROM goals WHERE user_email = ${owner.email} AND created_at > now() - interval '24 hours'
  `;
  if (Number(made.plans) >= PLANS_PER_DAY) return refuse(`That's ${PLANS_PER_DAY} new plans in a day, the most Zeno makes. Try again tomorrow.`);
  const goal = await savePlan(owner.email, plan, today);
  return { text: [`Current goal now: ${goalLine(goal)}`, ...stepsText(goal)].join("\n") };
}

async function startStep(owner: TokenOwner, args: Record<string, unknown>): Promise<Said> {
  const found = await openStep(owner.email, args.step_id);
  if (!found) return refuse(NO_STEP);
  // One current plan and one running step, as the app keeps them: its plan becomes the current one first.
  await activateGoal(owner.email, found.goal.id);
  const changed = await changeStepStatus(owner.email, found.step.id, "doing");
  if (!changed) return refuse(NO_STEP);
  return { text: `Started: ${found.step.title}${found.step.minutes ? `, ${found.step.minutes} min planned` : ""}. finish_step when it's done.` };
}

async function finishStep(owner: TokenOwner, args: Record<string, unknown>): Promise<Said> {
  let done: { step: Step; changed: { goal: Goal } | null } | null;
  if (args.step_id == null) {
    done = await finishRunning(owner.email);
    if (!done) return refuse("No step is running. Give a step_id, or start one with start_step.");
  } else {
    const found = await openStep(owner.email, args.step_id);
    if (!found) return refuse(NO_STEP);
    done = { step: found.step, changed: await changeStepStatus(owner.email, found.step.id, "done") };
  }
  if (!done.changed) return refuse(NO_STEP);
  const goal = done.changed.goal;
  const next = openOf(goal)[0];
  return { text: `Done: ${done.step.title}. ${next ? `Next: ${stepLine(next)}` : goal.rhythm ? planNext(goal) : `That's all of ${goal.title}.`}` };
}

const NONE: JsonSchemaType = { type: "object", properties: {} };
const STEP_ID = { type: "string", description: "A step id from next_step or list_goals." } as const;

// The MCP tools at /api/mcp; run is called with the token's owner only.
export const APP_TOOLS: {
  name: string;
  description: string;
  input: JsonSchemaType;
  run(owner: TokenOwner, args: Record<string, unknown>): Promise<Said>;
}[] = [
  {
    name: "list_goals",
    description: "List your open goals in Zeno with their steps still to do and the step ids. The current goal is marked.",
    input: NONE,
    run: async (owner) => {
      const [goals, current] = await Promise.all([openGoals(owner.email), currentGoal(owner.email)]);
      return { text: goalsText(goals, current?.id ?? null) };
    },
  },
  {
    name: "next_step",
    description: "The step to work on now: the running step of your current goal, else its next step, with its id.",
    input: NONE,
    run: async (owner) => ({ text: nextText(await currentGoal(owner.email)) }),
  },
  {
    name: "plan_goal",
    description:
      "Make a new goal: Zeno breaks it into 3 to 7 small steps (the first about 5 minutes) and makes it the current goal. An open goal with the same title opens instead of a copy. At most 20 new plans a day.",
    input: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 120, description: "What to work on, like 'PHIL 134 essay'." },
        due: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "The due date as YYYY-MM-DD, if there is one." },
      },
      required: ["title"],
    },
    run: planGoal,
  },
  {
    name: "start_step",
    description: "Start a step's timer. One step runs at a time, and the step's goal becomes the current one.",
    input: { type: "object", properties: { step_id: STEP_ID }, required: ["step_id"] },
    run: startStep,
  },
  {
    name: "finish_step",
    description: "Mark a step done. Leave out step_id to finish the running step.",
    input: { type: "object", properties: { step_id: { ...STEP_ID, type: ["string", "null"] } } },
    run: finishStep,
  },
];
