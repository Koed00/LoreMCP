#!/usr/bin/env node
// Bin entry point (`npx ab-mcp`). Connects the MCP server (src/shell/server.ts)
// to stdio -- this is the driving adapter exercised by the walking-skeleton
// acceptance test via subprocess (nw-distill Driving Adapter Verification).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./shell/server.js";

const configPath = process.env.AB_MCP_CONFIG ?? "ab-mcp.config.json";

const server = createServer({ configPath });
const transport = new StdioServerTransport();
await server.connect(transport);
