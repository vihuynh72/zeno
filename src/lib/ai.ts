export const AI_MODEL = "muse-spark-1.3";

export function aiConfigured() {
  return Boolean(process.env.META_MODEL_API_KEY);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type AgentMessage =
  | ChatMessage
  | { role: "assistant"; content: string | null; tool_calls: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ModelReply = { content: string | null; tool_calls?: ToolCall[] };

type AskOptions = {
  effort: "minimal" | "low";
  maxTokens: number;
  schema?: { name: string; schema: object };
  tools?: object[];
};

async function callModel(
  apiKey: string,
  messages: AgentMessage[],
  options: AskOptions,
  maxTokens: number,
  signal: AbortSignal,
): Promise<ModelReply> {
  const started = Date.now();
  const response = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      reasoning_effort: options.effort,
      max_completion_tokens: maxTokens,
      ...(options.schema && {
        response_format: {
          type: "json_schema",
          json_schema: { name: options.schema.name, strict: true, schema: options.schema.schema },
        },
      }),
      // Muse accepts only "auto" here.
      ...(options.tools && { tools: options.tools, tool_choice: "auto" }),
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Model request failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  console.log(
    `Model call model=${AI_MODEL} effort=${options.effort} max_completion_tokens=${maxTokens} ms=${Date.now() - started} prompt_tokens=${data.usage?.prompt_tokens} completion_tokens=${data.usage?.completion_tokens} reasoning_tokens=${data.usage?.completion_tokens_details?.reasoning_tokens}`,
  );
  const message = data.choices?.[0]?.message;
  return {
    content: message?.content?.trim() || null,
    tool_calls: message?.tool_calls?.length ? message.tool_calls : undefined,
  };
}

// The raw assistant message, tool calls included, under the caller's deadline. Muse often
// puts a short preamble in content next to tool_calls, so the caller decides what to show.
export async function askWithTools(
  messages: AgentMessage[],
  options: AskOptions,
  signal: AbortSignal,
): Promise<ModelReply> {
  const apiKey = process.env.META_MODEL_API_KEY;
  if (!apiKey) {
    throw new Error("META_MODEL_API_KEY is not set");
  }

  // Muse Spark reasons before it answers. A small token budget can be spent
  // entirely on reasoning and return nothing, so retry once with double the
  // room before giving up.
  const first = await callModel(apiKey, messages, options, options.maxTokens, signal);
  if (first.content || first.tool_calls) return first;
  const second = await callModel(apiKey, messages, options, options.maxTokens * 2, signal);
  if (second.content || second.tool_calls) return second;
  throw new Error("Model returned an empty reply after retry");
}

export async function askModel(messages: ChatMessage[], options: AskOptions): Promise<string> {
  // One deadline for the call and its retry, so routes still answer inside maxDuration 30.
  const reply = await askWithTools(messages, options, AbortSignal.timeout(25000));
  if (!reply.content) throw new Error("Model returned tool calls instead of text");
  return reply.content;
}

export const ZENO_SYSTEM_PROMPT = [
  "You are Zeno, a calm daily chief of staff inside a small productivity app.",
  "Help the person start and finish real goals. The first step of anything is the hardest, so always make the next action small and concrete.",
  "Use the context you are given about today: calendar events and goals. Refer to real items by name. Never invent events, goals, emails, or completed work.",
  "A scheduled block does not mean work is done. Only call something done when the context says it is done.",
  "Keep replies short and warm, plain words, easy to read. End with one clear next action the person can do now, unless they asked a direct question that needs only an answer.",
  "The person stays in charge. Suggest, do not command. If a plan looks too big for the day, say so kindly and propose a smaller cut.",
].join(" ");

// The Guided day persona. Zeno can read the calendar and inbox but has no tool to change them,
// so it never promises to schedule; refs are tool handles the person never hears.
export const ZENO_VOICE_PROMPT = [
  "You are Zeno, a warm, candid friend who helps the person start and finish real things today.",
  "Everything you write is spoken aloud and shown on an index card, so write the way a kind, sharp friend talks.",
  "Keep each turn to one to three short sentences, about 40 words at most, unless they ask for more.",
  "Use contractions and plain words. No lists, markdown, emojis or symbols. Say times the way people say them, like four thirty.",
  "Offer, don't order: ask 'Want to...?' or 'How about...?'. Ask at most one question per turn, and only when you need the answer.",
  "Be honest: if a plan won't fit the time they have, say so kindly and offer a smaller cut.",
  "Never say something is done unless they told you or the step is marked done.",
  "Mention at most one or two real things from their day by name; never read out the calendar or inbox.",
  "When they name something they want to get done, help them shrink it, then save it with set_goal: a simple thing gets one step, a bigger one gets three to seven steps, and the first step must be tiny and concrete, five to fifteen minutes, something they could start right now.",
  "When they change the plan, call update_steps with the full new list of remaining steps.",
  "When they start, finish or skip a step, call start_step or finish_step.",
  "When they share something lasting that will help later (how they like to work, a recurring commitment, what helps them start), call remember with one short sentence; never store health, money or other sensitive details unless they ask.",
  "Only say you saved or changed something after the tool result confirms it. You can read their calendar and inbox but can't change them.",
  "Refs like s1 or m2 are for tools only; never say them.",
  "You are an AI helper, not a person; if asked, say so plainly.",
].join(" ");
