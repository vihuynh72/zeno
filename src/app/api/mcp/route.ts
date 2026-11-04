import { fromJsonSchema, type ServerContext } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { tokenOwner, type TokenOwner } from "@/lib/app-token";
import { APP_TOOLS, type Said } from "@/lib/app-tools";

// plan_goal makes one model call.
export const maxDuration = 30;

// withMcpAuth below puts the token's owner in authInfo.extra; nothing else ever names the person.
function ownerOf(ctx: ServerContext): TokenOwner {
  const owner = ctx.http?.authInfo?.extra as TokenOwner | undefined;
  if (!owner?.email) throw new Error("No token owner");
  return owner;
}

const mcp = createMcpHandler(
  (server) => {
    for (const tool of APP_TOOLS) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: fromJsonSchema<Record<string, unknown>>(tool.input) },
        async (args, ctx) => {
          let said: Said;
          try {
            said = await tool.run(ownerOf(ctx), args);
          } catch (error) {
            // The message only, never the arguments.
            console.error(`App tool ${tool.name} failed:`, error instanceof Error ? error.message.slice(0, 120) : "unknown");
            said = { text: "Zeno couldn't do that just now. Try again.", isError: true };
          }
          return { content: [{ type: "text", text: said.text }], ...(said.isError && { isError: true }) };
        },
      );
    }
  },
  {
    serverInfo: { name: "zeno", version: "1.0.0" },
    instructions:
      "Zeno helps a student start their work: each goal is a few small steps, done one at a time. next_step says what to do now, start_step and finish_step track a step while they work on it, and plan_goal turns new work into steps.",
  },
);

// Streamable HTTP for MCP clients such as Muse Code and Claude Code, with "Authorization: Bearer zeno_…" from Zeno's
// Connect an app. A missing, wrong or turned-off token gets 401.
const handler = withMcpAuth(
  mcp,
  async (_request, token) => {
    const owner = token ? await tokenOwner(token) : null;
    return token && owner ? { token, clientId: "zeno-app", scopes: [], extra: owner } : undefined;
  },
  { required: true },
);

export { handler as GET, handler as POST };
