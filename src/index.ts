#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./shell/server.js";

const configPath = process.env.AB_MCP_CONFIG ?? "ab-mcp.config.json";

try {
  const server = createServer({ configPath });
  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (err) {
  const reason = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    JSON.stringify({ event: "health.startup.refused", reason, timestamp: new Date().toISOString() }) + "\n",
  );
  process.exit(1);
}
