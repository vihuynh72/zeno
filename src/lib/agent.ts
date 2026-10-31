import { askWithTools, ZENO_VOICE_PROMPT, type AgentMessage, type ChatMessage, type ToolCall } from "@/lib/ai";
import { dayToText, type UserContext } from "@/lib/context";
import type { Goal, Memory, StepStatus, TalkAction } from "@/lib/day";
import { addMemory, forgetMemory, replaceRemainingSteps, setGoal, setStepStatus, type NewStep } from "@/lib/goals";

// The client sends history, so trust only plain user and assistant turns, never a system role.
export function cleanHistory(raw: unknown): ChatMessage[] {
  return (Array.isArray(raw) ? raw.slice(-12) : [])
    .filter(
      (item) =>
        (item?.role === "user" || item?.role === "assistant") && typeof item.content === "string",
    )
    .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) }));
}

// The model sees short refs (s1 for steps, m1 for memories), never ids. A ref keeps
// pointing at the same row for the whole turn, even after the plan changes.
export type Refs = Map<string, string>; // id -> ref

export function refOf(refs: Refs, id: string, prefix: "s" | "m"): string {
  let ref = refs.get(id);
  if (!ref) {
    ref = `${prefix}${[...refs.values()].filter((known) => known[0] === prefix).length + 1}`;
    refs.set(id, ref);
  }
  return ref;
}

const idOf = (refs: Refs, ref: unknown) => [...refs].find(([, known]) => known === ref)?.[0];

export function goalText(goal: Goal | null, refs: Refs): string {
  if (!goal) return "Current goal: none yet.";
  return [
    `Current goal: ${goal.title}`,
    ...goal.steps.map(
      (step) =>
        `${refOf(refs, step.id, "s")} [${step.status}${step.minutes ? `, ${step.minutes} min` : ""}] ${step.title}`,
    ),
  ].join("\n");
}

// When the database could not be read, the model must not guess the plan or claim a save.
export function planText(context: UserContext, refs: Refs): string {
  return context.tasksState === "ok"
    ? goalText(context.goal, refs)
    : "Their saved goal and memories could not be read just now. Do not guess them.";
}

export function systemPrompt(firstName: string | null, memories: Memory[], refs: Refs): string {
  const lines = [ZENO_VOICE_PROMPT];
  if (firstName) lines.push(`The person's first name is ${firstName}.`);
  if (memories.length > 0) {
    lines.push(
      "What you remember about them:",
      ...memories.map((memory) => `${refOf(refs, memory.id, "m")}: ${memory.text}`),
    );
  }
  return lines.join("\n");
}

const stepFields = {
  title: { type: "string", description: "What to do, starting with a verb, in a few words." },
  minutes: { type: "integer", minimum: 1, maximum: 240, description: "Honest estimate in minutes." },
};

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "set_goal",
      description:
        "Save the one thing the person wants to get done, with its steps in order. It becomes the current goal; any other goal is paused.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short name for the goal, in their words." },
          steps: {
            type: "array",
            minItems: 1,
            maxItems: 7,
            description:
              "One step for a simple thing, three to seven for a bigger one. The first step is tiny and concrete, five to fifteen minutes.",
            items: { type: "object", properties: stepFields, required: ["title", "minutes"] },
          },
        },
        required: ["title", "steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_steps",
      description:
        "Replace the todo steps of the current goal with this full new list, in order. Pass a todo step's ref to keep or edit it, leave a ref out to drop that step, and omit ref for a new step. Started, done and skipped steps never change.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            minItems: 1,
            maxItems: 7,
            items: {
              type: "object",
              properties: { ref: { type: "string", description: "Ref of an existing todo step, like s2." }, ...stepFields },
              required: ["title", "minutes"],
            },
          },
        },
        required: ["steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_step",
      description: "Mark a step of the current goal as started.",
      parameters: {
        type: "object",
        properties: { ref: { type: "string", description: "Step ref, like s1." } },
        required: ["ref"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish_step",
      description: "Mark a step of the current goal as done or skipped.",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string", description: "Step ref, like s1." },
          outcome: { type: "string", enum: ["done", "skipped"] },
        },
        required: ["ref", "outcome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember",
      description: "Save one short sentence about the person that will help on later days.",
      parameters: {
        type: "object",
        properties: { text: { type: "string", description: "One short sentence, like 'Works best right after class.'" } },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forget",
      description: "Delete one thing you remember, when they ask you to forget it or it is wrong.",
      parameters: {
        type: "object",
        properties: { ref: { type: "string", description: "Memory ref, like m1." } },
        required: ["ref"],
      },
    },
  },
];

type Checked =
  | { error: string }
  | { name: "set_goal"; title: string; steps: NewStep[] }
  | { name: "update_steps"; goalId: string; steps: NewStep[] }
  | { name: "step"; stepId: string; status: StepStatus }
  | { name: "remember"; text: string }
  | { name: "forget"; memoryId: string };

const titleOf = (value: unknown) =>
  typeof value === "string" && value.trim() && value.trim().length <= 120 ? value.trim() : null;

// Refs may only name todo steps of the current goal, so set_goal (no goal passed) takes none.
function stepsOf(value: unknown, goal: Goal | null, refs: Refs): NewStep[] | string {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) return "steps must list 1 to 7 steps";
  const steps: NewStep[] = [];
  for (const item of value) {
    const title = titleOf(item?.title);
    if (!title) return "every step needs a title of 1 to 120 characters";
    const minutes = item?.minutes ?? null;
    if (minutes !== null && !(Number.isInteger(minutes) && minutes >= 1 && minutes <= 240)) {
      return "minutes must be a whole number from 1 to 240";
    }
    const id = item?.ref ? idOf(refs, item.ref) : undefined;
    const todo = goal?.steps.some((step) => step.id === id && step.status === "todo");
    if (item?.ref && (!todo || steps.some((step) => step.id === id))) {
      return `${item.ref} is not a todo step of the current goal, or is listed twice`;
    }
    steps.push({ id, title, minutes });
  }
  return steps;
}

// The model's arguments are untrusted: check every type, length, range and ref.
export function checkCall(call: ToolCall, goal: Goal | null, refs: Refs): Checked {
  let args: Record<string, unknown> | null;
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    return { error: "arguments were not valid JSON" };
  }
  switch (call.function.name) {
    case "set_goal": {
      const title = titleOf(args?.title);
      const steps = stepsOf(args?.steps, null, refs);
      if (!title) return { error: "title must be 1 to 120 characters" };
      return typeof steps === "string" ? { error: steps } : { name: "set_goal", title, steps };
    }
    case "update_steps": {
      if (!goal) return { error: "there is no current goal yet, use set_goal" };
      const steps = stepsOf(args?.steps, goal, refs);
      return typeof steps === "string" ? { error: steps } : { name: "update_steps", goalId: goal.id, steps };
    }
    case "start_step":
    case "finish_step": {
      const stepId = idOf(refs, args?.ref);
      if (!stepId || !goal?.steps.some((step) => step.id === stepId)) {
        return { error: `${args?.ref} is not a step of the current goal` };
      }
      const status = call.function.name === "start_step" ? "doing" : args?.outcome;
      if (status !== "doing" && status !== "done" && status !== "skipped") {
        return { error: "outcome must be done or skipped" };
      }
      return { name: "step", stepId, status };
    }
    case "remember": {
      const text = typeof args?.text === "string" ? args.text.trim() : "";
      return text ? { name: "remember", text } : { error: "text must be one short sentence" };
    }
    case "forget": {
      const memoryId = typeof args?.ref === "string" && args.ref.startsWith("m") ? idOf(refs, args.ref) : undefined;
      return memoryId ? { name: "forget", memoryId } : { error: `${args?.ref} is not a memory ref` };
    }
    default:
      return { error: `there is no tool named ${call.function.name}` };
  }
}

// Measured live: low gave no better roadmaps than minimal and took about twice as long per call.
const EFFORT = "minimal";

// One turn of the Guided day conversation: the model may change the goal, steps and memory
// through tools, then answers in words. Returns the final words only, never a tool preamble.
export async function talk(
  context: UserContext,
  firstName: string | null,
  history: ChatMessage[],
  message: string,
): Promise<{ reply: string; goal: Goal | null; actions: TalkAction[]; options: string[] }> {
  const email = context.email;
  const refs: Refs = new Map();
  let goal = context.goal;
  const actions: TalkAction[] = [];
  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt(firstName, context.memories, refs) },
    ...history,
    {
      role: "user",
      content: `Context about the person's day:\n${dayToText(context)}\n\n${planText(context, refs)}\n\nThe person says:\n${message}`,
    },
  ];

  async function run(call: ToolCall): Promise<object> {
    const checked = checkCall(call, goal, refs);
    if ("error" in checked) return checked;
    try {
      if (checked.name === "remember") {
        await addMemory(email, checked.text);
        actions.push({ type: "remembered", label: checked.text });
        return { ok: true };
      }
      if (checked.name === "forget") {
        if (!(await forgetMemory(email, checked.memoryId))) return { error: "that memory is already gone" };
        const text = context.memories.find((memory) => memory.id === checked.memoryId)?.text ?? "";
        actions.push({ type: "forgot", label: text });
        return { ok: true };
      }
      const changed =
        checked.name === "set_goal"
          ? await setGoal(email, checked.title, checked.steps)
          : checked.name === "update_steps"
            ? await replaceRemainingSteps(email, checked.goalId, checked.steps)
            : await setStepStatus(email, checked.stepId, checked.status);
      if (!changed) return { error: "that goal or step no longer exists" };
      goal = changed;
      if (checked.name === "step") {
        const step = goal.steps.find((item) => item.id === checked.stepId);
        actions.push({ type: checked.status === "doing" ? "step-started" : "step-finished", label: step?.title ?? "" });
      } else {
        actions.push({ type: checked.name === "set_goal" ? "goal-set" : "roadmap-changed", label: goal.title });
      }
      return { ok: true, goal: goalText(goal, refs) };
    } catch (error) {
      console.error(`Tool ${call.function.name} failed:`, error);
      return { error: "could not save that just now" };
    }
  }

  // One deadline across every round, so the route answers inside maxDuration 30.
  const signal = AbortSignal.timeout(25000);
  let reply: string | null = null;
  try {
    for (let round = 0; round < 4; round++) {
      const answer = await askWithTools(messages, { effort: EFFORT, maxTokens: 1024, tools: TOOLS }, signal);
      if (!answer.tool_calls) {
        reply = answer.content;
        break;
      }
      // Muse often says "Got it, I'll add that" next to its tool calls; that preamble is never the reply.
      messages.push({ role: "assistant", content: answer.content, tool_calls: answer.tool_calls });
      for (const call of answer.tool_calls) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(await run(call)) });
      }
    }
  } catch (error) {
    // Once something was saved, a short honest reply beats an error that hides the change.
    if (actions.length === 0) throw error;
    console.error("Talk stopped after saving a change:", error);
  }
  return {
    reply:
      reply ??
      (actions.length > 0
        ? "I made that change, but lost my words for a second. Want to keep going?"
        : "Sorry, I got tangled up there. Could you say that again?"),
    goal,
    actions,
    options: [],
  };
}
