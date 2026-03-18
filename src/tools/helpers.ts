import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// MCP SDK expects Zod 3 types; we use Zod 4. Runtime is compatible but the
// types aren't, so we cast the schema through this wrapper to avoid `as any`
// at every call site.
export function registerTool(
  server: McpServer,
  name: string,
  description: string,
  schema: Record<string, unknown>,
  handler: (args: any, extra: any) => any,
) {
  (server.tool as Function)(name, description, schema, handler);
}
