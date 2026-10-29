export const AI_MODEL = "muse-spark-1.3";

export function aiConfigured() {
  return Boolean(process.env.META_MODEL_API_KEY);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type AskOptions = {
  effort: "minimal" | "low";
  maxTokens: number;
  schema?: { name: string; schema: object };
};

async function callModel(
  apiKey: string,
  messages: ChatMessage[],
  options: AskOptions,
  maxTokens: number,
  signal: AbortSignal,
): Promise<string | null> {
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
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Model request failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  console.log(
    `Model call model=${AI_MODEL} effort=${options.effort} max_completion_tokens=${maxTokens} ms=${Date.now() - started} prompt_tokens=${data.usage?.prompt_tokens} completion_tokens=${data.usage?.completion_tokens} reasoning_tokens=${data.usage?.completion_tokens_details?.reasoning_tokens}`,
  );
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function askModel(messages: ChatMessage[], options: AskOptions): Promise<string> {
  const apiKey = process.env.META_MODEL_API_KEY;
  if (!apiKey) {
    throw new Error("META_MODEL_API_KEY is not set");
  }

  // One deadline for the call and its retry, so routes still answer inside maxDuration 30.
  const signal = AbortSignal.timeout(25000);
  // Muse Spark reasons before it answers. A small token budget can be spent
  // entirely on reasoning and return no text, so retry once with double the
  // room before giving up.
  const first = await callModel(apiKey, messages, options, options.maxTokens, signal);
  if (first) return first;
  const second = await callModel(apiKey, messages, options, options.maxTokens * 2, signal);
  if (second) return second;
  throw new Error("Model returned an empty reply after retry");
}

export const ZENO_SYSTEM_PROMPT = [
  "You are Zeno, a calm daily chief of staff inside a small productivity app.",
  "Help the person start and finish real goals. The first step of anything is the hardest, so always make the next action small and concrete.",
  "Use the context you are given about today: calendar events and goals. Refer to real items by name. Never invent events, goals, emails, or completed work.",
  "A scheduled block does not mean work is done. Only call something done when the context says it is done.",
  "Keep replies short and warm, plain words, easy to read. End with one clear next action the person can do now, unless they asked a direct question that needs only an answer.",
  "The person stays in charge. Suggest, do not command. If a plan looks too big for the day, say so kindly and propose a smaller cut.",
].join(" ");
