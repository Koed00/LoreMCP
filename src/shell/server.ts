// Imperative shell: composition root / McpToolSurface port. Registers
// list_features and query_context with @modelcontextprotocol/sdk and wires
// shell adapters -> core -> shell formatter. This module is REAL wiring
// (not a __SCAFFOLD__) -- it deliberately calls into scaffolded
// config-loader / fs-doc-tree-reader / core modules, which throw
// "Not yet implemented -- RED scaffold" at request time. The MCP SDK
// catches handler errors and returns them as `isError: true` tool results,
// so the server itself starts and stays up (RED, not BROKEN) -- per
// nw-distill Mandate 7 and Driving Adapter Verification.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "./config-loader.js";
import { createFsDocTreeReader } from "./fs-doc-tree-reader.js";
import {
  classifyStructure,
  classifyRepoForListFeatures,
} from "../core/classify-structure.js";
import {
  formatListFeaturesResponse,
  formatQueryContextResponse,
  formatRepoNotConfigured,
  formatRepoPathNotFound,
} from "../core/format-response.js";

export type CreateServerOptions = {
  configPath: string;
};

export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer({
    name: "ab-mcp",
    version: "0.1.0",
  });

  const reader = createFsDocTreeReader();

  server.registerTool(
    "list_features",
    {
      description:
        "Enumerate docs/feature/*/ and phase subdirectories for a configured repo, plus has_architecture_adrs/has_claude_md flags.",
      inputSchema: { repo_name: z.string() },
    },
    async ({ repo_name }) => {
      const repos = loadConfig(options.configPath);
      const entry = repos.find((r) => r.repoName === repo_name);
      if (!entry) {
        const result = formatRepoNotConfigured(
          repo_name,
          repos.map((r) => r.repoName),
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      const probe = reader.probe(entry.docPath);
      if (!probe.ok) {
        const result = formatRepoPathNotFound(
          repo_name,
          entry.docPath,
          repos.map((r) => r.repoName),
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      // TODO (DELIVER): build TreeSnapshot via reader.listDir and pass to
      // classifyRepoForListFeatures + formatListFeaturesResponse.
      const classified = classifyRepoForListFeatures({
        repoName: entry.repoName,
        docPath: entry.docPath,
        docPathExists: true,
        features: {},
        adrFiles: [],
        claudeMdPath: null,
      });
      const result = formatListFeaturesResponse(
        entry.repoName,
        entry.docPath,
        classified,
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    "query_context",
    {
      description:
        "Return live-read snippets from wave-decisions/feature-delta, ADRs, and/or CLAUDE.md for repo_name + feature_id.",
      inputSchema: { repo_name: z.string(), feature_id: z.string() },
    },
    async ({ repo_name, feature_id }) => {
      const repos = loadConfig(options.configPath);
      const entry = repos.find((r) => r.repoName === repo_name);
      if (!entry) {
        const result = formatRepoNotConfigured(
          repo_name,
          repos.map((r) => r.repoName),
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      const probe = reader.probe(entry.docPath);
      if (!probe.ok) {
        const result = formatRepoPathNotFound(
          repo_name,
          entry.docPath,
          repos.map((r) => r.repoName),
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      // TODO (DELIVER): build TreeSnapshot via reader.listDir, classify via
      // classifyStructure, read matched files via reader.readFile, then
      // formatQueryContextResponse.
      const classified = classifyStructure(
        {
          repoName: entry.repoName,
          docPath: entry.docPath,
          docPathExists: true,
          features: {},
          adrFiles: [],
          claudeMdPath: null,
        },
        feature_id,
      );
      const result = formatQueryContextResponse(
        entry.repoName,
        feature_id,
        classified,
        new Map(),
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  return server;
}
