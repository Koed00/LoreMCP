// Imperative shell: composition root / McpToolSurface port. Registers
// list_features and query_context with @modelcontextprotocol/sdk and wires
// shell adapters -> core -> shell formatter.
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "./config-loader.js";
import { createFsDocTreeReader, type DocTreeReader } from "./fs-doc-tree-reader.js";
import {
  classifyStructure,
  classifyRepoForListFeatures,
  type RepoEntry,
  type TreeSnapshot,
  type ClassifyResult,
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

const ARCHITECTURE_DIR = "product/architecture";
const FEATURE_DIR = "feature";
const CLAUDE_MD_FILENAME = "CLAUDE.md";

/**
 * Builds a {@link TreeSnapshot} for `entry` by enumerating the real
 * filesystem under `entry.docPath` (live, no cache -- ADR-004). All
 * `TreeSnapshot` paths are relative to the repo root (the parent directory
 * of `docPath`), matching the `docs/...` / `CLAUDE.md` conventions baked
 * into classify-structure.ts.
 */
function buildTreeSnapshot(reader: DocTreeReader, entry: RepoEntry): TreeSnapshot {
  const repoRoot = path.dirname(entry.docPath);
  const docPathRelative = path.relative(repoRoot, entry.docPath);

  return {
    repoName: entry.repoName,
    docPath: entry.docPath,
    docPathExists: true,
    features: discoverFeatures(reader, entry.docPath, docPathRelative),
    adrFiles: discoverAdrFiles(reader, entry.docPath, docPathRelative),
    claudeMdPath: discoverClaudeMdPath(reader, repoRoot),
  };
}

/** Enumerates docs/feature/{featureId}/{phase}/ -> { featureId: [phases] }. */
function discoverFeatures(
  reader: DocTreeReader,
  docPath: string,
  docPathRelative: string,
): Record<string, string[]> {
  const featureRootAbsolute = path.join(docPath, FEATURE_DIR);
  const featureIds = reader.listDir(featureRootAbsolute);

  const features: Record<string, string[]> = {};
  for (const featureId of featureIds) {
    const featureDirAbsolute = path.join(featureRootAbsolute, featureId);
    const phases = reader
      .listDir(featureDirAbsolute)
      .filter((entryName) =>
        reader.pathExists(
          path.join(featureDirAbsolute, entryName, "wave-decisions.md"),
        ),
      );
    if (phases.length > 0) {
      features[featureId] = phases;
    }
  }

  return features;
}

/** Enumerates docs/product/architecture/*.md -> repo-root-relative paths, sorted. */
function discoverAdrFiles(
  reader: DocTreeReader,
  docPath: string,
  docPathRelative: string,
): string[] {
  const architectureDirAbsolute = path.join(docPath, ARCHITECTURE_DIR);
  return reader
    .listDir(architectureDirAbsolute)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => path.join(docPathRelative, ARCHITECTURE_DIR, fileName))
    .sort();
}

/** Checks for <repoRoot>/CLAUDE.md (OQ-1: doc_path/../CLAUDE.md). */
function discoverClaudeMdPath(reader: DocTreeReader, repoRoot: string): string | null {
  const claudeMdAbsolute = path.join(repoRoot, CLAUDE_MD_FILENAME);
  return reader.pathExists(claudeMdAbsolute) ? CLAUDE_MD_FILENAME : null;
}

/**
 * Reads each file in `classified.filesToRead` via `reader.readFile`,
 * resolving repo-root-relative `sourceFile` paths against `repoRoot`.
 * Only successful reads are included -- TOCTOU failures are reported as
 * warnings by formatQueryContextResponse.
 */
function readClassifiedFiles(
  reader: DocTreeReader,
  repoRoot: string,
  classified: ClassifyResult,
): Map<string, string> {
  const fileContents = new Map<string, string>();

  for (const file of classified.filesToRead) {
    const absolutePath = path.join(repoRoot, file.sourceFile);
    const outcome = reader.readFile(absolutePath);
    if (outcome.ok) {
      fileContents.set(file.sourceFile, outcome.content);
    }
  }

  return fileContents;
}

/** Recursively converts camelCase object keys to snake_case for the MCP JSON contract. */
function toSnakeCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toSnakeCaseKeys);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, fieldValue]) => [
        camelToSnakeCase(key),
        toSnakeCaseKeys(fieldValue),
      ]),
    );
  }

  return value;
}

function camelToSnakeCase(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toLowerCase();
}

/**
 * Marks a query_context success response's `retrievedAt` timestamp as a
 * live (uncached) read (ADR-004: no caching).
 */
function withLiveRetrievedAt<T extends { retrievedAt?: string }>(result: T): T {
  if (result.retrievedAt === undefined) {
    return result;
  }
  return { ...result, retrievedAt: `live (uncached) read at ${result.retrievedAt}` };
}

function toToolResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(toSnakeCaseKeys(result)) }] };
}

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
        return toToolResult(result);
      }

      const probe = reader.probe(entry.docPath);
      if (!probe.ok) {
        const result = formatRepoPathNotFound(
          repo_name,
          entry.docPath,
          repos.map((r) => r.repoName),
        );
        return toToolResult(result);
      }

      const snapshot = buildTreeSnapshot(reader, entry);
      const classified = classifyRepoForListFeatures(snapshot);
      const result = formatListFeaturesResponse(entry.repoName, entry.docPath, classified);
      return toToolResult(result);
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
        return toToolResult(result);
      }

      const probe = reader.probe(entry.docPath);
      if (!probe.ok) {
        const result = formatRepoPathNotFound(
          repo_name,
          entry.docPath,
          repos.map((r) => r.repoName),
        );
        return toToolResult(result);
      }

      const repoRoot = path.dirname(entry.docPath);
      const snapshot = buildTreeSnapshot(reader, entry);
      const classified = classifyStructure(snapshot, feature_id);
      const fileContents = readClassifiedFiles(reader, repoRoot, classified);
      const result = formatQueryContextResponse(
        entry.repoName,
        feature_id,
        entry.docPath,
        classified,
        fileContents,
      );
      return toToolResult(withLiveRetrievedAt(result as any));
    },
  );

  return server;
}
