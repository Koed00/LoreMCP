// Acceptance-test support: spawns the real ab-mcp server (src/index.ts) as a
// subprocess and connects an MCP Client over stdio -- the real driving
// adapter path (Driving Adapter Verification). This is test infrastructure,
// not a production module, so it is NOT a __SCAFFOLD__: it is real, working
// code from the moment DISTILL creates it.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);

export type AbMcpHandle = {
  client: Client;
  close(): Promise<void>;
};

/**
 * Starts `node --import tsx src/index.ts` (the real bin entry) with
 * `AB_MCP_CONFIG` pointing at `configPath`, and connects an MCP client to it
 * over stdio.
 */
export async function startAbMcp(configPath: string): Promise<AbMcpHandle> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.join(repoRoot, "src/index.ts")],
    env: {
      ...process.env,
      AB_MCP_CONFIG: configPath,
    },
  });

  const client = new Client({ name: "ab-mcp-acceptance-tests", version: "0.1.0" });
  await client.connect(transport);

  return {
    client,
    async close() {
      await client.close();
    },
  };
}

export function repoPath(...segments: string[]): string {
  return path.join(repoRoot, ...segments);
}

/** Parses the JSON text returned in a tool call's content[0]. */
export function parseToolJson(result: { content: Array<{ type: string; text?: string }> }): any {
  const text = result.content.find((c) => c.type === "text")?.text;
  if (text === undefined) {
    throw new Error("Tool result has no text content to parse as JSON");
  }
  return JSON.parse(text);
}
