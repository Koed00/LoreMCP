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
  formatInvalidConcern,
  formatConcernNotFound,
  formatResolveConcernResponse,
  formatListConcernsResponse,
  type QueryContextResponse,
} from "../core/format-response.js";
import {
  validateConcern,
  matchConcernInSnapshot,
  collectConcernCandidates,
  type ConcernMatch,
  type RejectedPath,
  type ConcernScanInput,
  type ConcernCandidateInput,
} from "../core/concern-matcher.js";

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
    features: discoverFeatures(reader, entry.docPath),
    adrFiles: discoverAdrFiles(reader, entry.docPath, docPathRelative),
    claudeMdPath: discoverClaudeMdPath(reader, repoRoot),
  };
}

const DELIVER_PHASE_NAME = "deliver";
const EXECUTION_LOG_FILENAME = "execution-log.json";

/** Enumerates docs/feature/{featureId}/{phase}/ -> { featureId: [phases] }. */
export function discoverFeatures(
  reader: DocTreeReader,
  docPath: string,
): Record<string, string[]> {
  const featureRootAbsolute = path.join(docPath, FEATURE_DIR);
  const featureIds = reader.listDir(featureRootAbsolute);

  const features: Record<string, string[]> = {};
  for (const featureId of featureIds) {
    const featureDirAbsolute = path.join(featureRootAbsolute, featureId);
    const phases = reader
      .listDir(featureDirAbsolute)
      .filter((entryName) => isDetectedPhase(reader, featureDirAbsolute, entryName));
    if (phases.length > 0) {
      features[featureId] = phases;
    }
  }

  return features;
}

/** Decides whether `entryName` (a phase directory) counts as a detected phase. */
function isDetectedPhase(
  reader: DocTreeReader,
  featureDirAbsolute: string,
  entryName: string,
): boolean {
  if (entryName === DELIVER_PHASE_NAME) {
    return hasCommittedDeliverPhase(reader, path.join(featureDirAbsolute, entryName));
  }
  return reader.pathExists(path.join(featureDirAbsolute, entryName, "wave-decisions.md"));
}

/**
 * Checks `deliverDirAbsolute/execution-log.json` for at least one event with
 * `p === "COMMIT"`. Missing file or malformed/unparseable JSON is treated as
 * "deliver phase not detected" (fail-closed).
 */
function hasCommittedDeliverPhase(reader: DocTreeReader, deliverDirAbsolute: string): boolean {
  const executionLogAbsolute = path.join(deliverDirAbsolute, EXECUTION_LOG_FILENAME);
  const outcome = reader.readFile(executionLogAbsolute);
  if (!outcome.ok) {
    return false;
  }

  try {
    const parsed = JSON.parse(outcome.content) as { events?: unknown };
    if (!Array.isArray(parsed.events)) {
      return false;
    }
    return parsed.events.some(
      (event) => typeof event === "object" && event !== null && (event as { p?: unknown }).p === "COMMIT",
    );
  } catch {
    return false;
  }
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

type DocFile = { sourceFile: string; phase: string; content: string };
type AdrFile = { sourceFile: string; content: string };

/** Reads each repo feature's wave-decisions.md (per phase), skipping unreadable files. */
function readFeatureFiles(
  reader: DocTreeReader,
  repoRoot: string,
  docPathRelative: string,
  features: Record<string, string[]>,
): DocFile[] {
  const featureFiles: DocFile[] = [];
  for (const [featureId, phases] of Object.entries(features)) {
    for (const phase of phases) {
      const sourceFile = path.join(docPathRelative, FEATURE_DIR, featureId, phase, "wave-decisions.md");
      const absolutePath = path.join(repoRoot, sourceFile);
      const outcome = reader.readFile(absolutePath);
      if (outcome.ok) {
        featureFiles.push({ sourceFile, phase, content: outcome.content });
      }
    }
  }
  return featureFiles;
}

/** Reads each ADR file listed in `adrSourceFiles`, skipping unreadable files. */
function readAdrFiles(reader: DocTreeReader, repoRoot: string, adrSourceFiles: string[]): AdrFile[] {
  const adrFiles: AdrFile[] = [];
  for (const adrSourceFile of adrSourceFiles) {
    const absolutePath = path.join(repoRoot, adrSourceFile);
    const outcome = reader.readFile(absolutePath);
    if (outcome.ok) {
      adrFiles.push({ sourceFile: adrSourceFile, content: outcome.content });
    }
  }
  return adrFiles;
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

function annotateWithLiveTimestamp(response: QueryContextResponse): QueryContextResponse {
  return { ...response, retrievedAt: `live (uncached) read at ${response.retrievedAt}` };
}

function toToolResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(toSnakeCaseKeys(result)) }] };
}

type RepoLookupResult =
  | { found: false; toolResult: ReturnType<typeof toToolResult> }
  | { found: true; entry: RepoEntry; repoNames: string[] };

function resolveRepoEntry(repos: RepoEntry[], repoName: string): RepoLookupResult {
  const entry = repos.find((r) => r.repoName === repoName);
  const repoNames = repos.map((r) => r.repoName);
  if (!entry) {
    return { found: false, toolResult: toToolResult(formatRepoNotConfigured(repoName, repoNames)) };
  }
  return { found: true, entry, repoNames };
}

export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer({
    name: "lore-mcp",
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
      let repos: RepoEntry[];
      try {
        repos = loadConfig(options.configPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return toToolResult({ error: "CONFIG_ERROR", message: msg });
      }
      const lookup = resolveRepoEntry(repos, repo_name);
      if (!lookup.found) return lookup.toolResult;

      const { entry, repoNames } = lookup;
      const probe = reader.probe(entry.docPath);
      if (!probe.ok) {
        return toToolResult(formatRepoPathNotFound(repo_name, entry.docPath, repoNames));
      }

      const snapshot = buildTreeSnapshot(reader, entry);
      const classified = classifyRepoForListFeatures(snapshot);
      return toToolResult(formatListFeaturesResponse(entry.repoName, entry.docPath, classified));
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
      let repos: RepoEntry[];
      try {
        repos = loadConfig(options.configPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return toToolResult({ error: "CONFIG_ERROR", message: msg });
      }
      const lookup = resolveRepoEntry(repos, repo_name);
      if (!lookup.found) return lookup.toolResult;

      const { entry, repoNames } = lookup;
      const probe = reader.probe(entry.docPath);
      if (!probe.ok) {
        return toToolResult(formatRepoPathNotFound(repo_name, entry.docPath, repoNames));
      }

      const repoRoot = path.dirname(entry.docPath);
      const snapshot = buildTreeSnapshot(reader, entry);
      const classified = classifyStructure(snapshot, feature_id);
      const fileContents = readClassifiedFiles(reader, repoRoot, classified);
      const response = formatQueryContextResponse(
        entry.repoName,
        feature_id,
        entry.docPath,
        classified,
        fileContents,
      );

      const annotated =
        "error" in response
          ? response
          : annotateWithLiveTimestamp(response);
      return toToolResult(annotated);
    },
  );

  server.registerTool(
    "resolve_concern",
    {
      description:
        "Search all configured repos for nWave artifacts mentioning concern, returning matches (with relevance tier), rejected alternatives, and partial-structure warnings. No repo_name required — searches across all configured repos.",
      inputSchema: { concern: z.string() },
    },
    async ({ concern }) => {
      const validation = validateConcern(concern);
      if (!validation.valid) {
        return toToolResult(formatInvalidConcern(concern));
      }

      let repos: RepoEntry[];
      try {
        repos = loadConfig(options.configPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return toToolResult({ error: "CONFIG_ERROR", message: msg });
      }

      const allMatches: ConcernMatch[] = [];
      const allRejectedPaths: RejectedPath[] = [];
      const allWarnings: string[] = [];
      const searchedRepos: string[] = [];
      const skipWarnings: string[] = [];

      for (const entry of repos) {
        const repoRoot = path.dirname(entry.docPath);
        const probe = reader.probe(entry.docPath);
        const hasClaudeMd = reader.pathExists(path.join(repoRoot, CLAUDE_MD_FILENAME));
        if (!probe.ok && !hasClaudeMd) {
          skipWarnings.push(`Skipped repo "${entry.repoName}": ${probe.reason}`);
          continue;
        }

        searchedRepos.push(entry.repoName);
        const docPathRelative = path.relative(repoRoot, entry.docPath);
        const snapshot = buildTreeSnapshot(reader, entry);

        // Collect feature files
        const featureDirectoryNames = Object.keys(snapshot.features);
        const featureFiles: ConcernScanInput["featureFiles"] = readFeatureFiles(
          reader,
          repoRoot,
          docPathRelative,
          snapshot.features,
        );

        // Collect ADR files
        const adrFiles: ConcernScanInput["adrFiles"] = readAdrFiles(reader, repoRoot, snapshot.adrFiles);

        // Collect CLAUDE.md
        let claudeMdFile: ConcernScanInput["claudeMdFile"] = null;
        if (snapshot.claudeMdPath !== null) {
          const absolutePath = path.join(repoRoot, snapshot.claudeMdPath);
          const outcome = reader.readFile(absolutePath);
          if (outcome.ok) {
            claudeMdFile = { sourceFile: snapshot.claudeMdPath, content: outcome.content };
          }
        }

        const scanInput: ConcernScanInput = {
          concern,
          repoName: entry.repoName,
          docPath: entry.docPath,
          featureFiles,
          adrFiles,
          claudeMdFile,
          featureDirectoryNames,
        };

        const result = matchConcernInSnapshot(scanInput);
        allMatches.push(...result.matches);
        allRejectedPaths.push(...result.rejectedPaths);
        allWarnings.push(...result.truncationWarnings);
      }

      if (allMatches.length === 0) {
        return toToolResult(formatConcernNotFound(concern, searchedRepos, [...skipWarnings, ...allWarnings]));
      }

      return toToolResult(
        formatResolveConcernResponse(concern, allMatches, allRejectedPaths, [...skipWarnings, ...allWarnings]),
      );
    },
  );

  const MAX_CONCERN_CANDIDATES = 200;

  server.registerTool(
    "list_concerns",
    {
      description:
        "Scan all configured repos for candidate concern/topic strings (feature directory names, ADR titles, decision heading text) an agent can browse before calling resolve_concern. No arguments.",
      inputSchema: {},
    },
    async () => {
      let repos: RepoEntry[];
      try {
        repos = loadConfig(options.configPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return toToolResult({ error: "CONFIG_ERROR", message: msg });
      }

      const allCandidates: string[] = [];
      const searchedRepos: string[] = [];
      const skipWarnings: string[] = [];

      for (const entry of repos) {
        const repoRoot = path.dirname(entry.docPath);
        searchedRepos.push(entry.repoName);

        const probe = reader.probe(entry.docPath);
        if (!probe.ok) {
          continue;
        }

        const docPathRelative = path.relative(repoRoot, entry.docPath);
        const snapshot = buildTreeSnapshot(reader, entry);

        const featureDirectoryNames = Object.keys(snapshot.features);
        const featureFiles: ConcernCandidateInput["featureFiles"] = readFeatureFiles(
          reader,
          repoRoot,
          docPathRelative,
          snapshot.features,
        );
        const adrFiles: ConcernCandidateInput["adrFiles"] = readAdrFiles(reader, repoRoot, snapshot.adrFiles);

        const candidates = collectConcernCandidates({
          featureDirectoryNames,
          adrFiles,
          featureFiles,
        });
        allCandidates.push(...candidates);
      }

      const deduped = Array.from(new Set(allCandidates));
      const capped = deduped.slice(0, MAX_CONCERN_CANDIDATES);
      const truncationWarning =
        deduped.length > MAX_CONCERN_CANDIDATES
          ? [`Result truncated to ${MAX_CONCERN_CANDIDATES} of ${deduped.length} candidate concerns.`]
          : [];

      return toToolResult(
        formatListConcernsResponse(capped, searchedRepos, [...skipWarnings, ...truncationWarning]),
      );
    },
  );

  return server;
}
