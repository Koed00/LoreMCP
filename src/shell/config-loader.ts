// Imperative shell: ConfigSource port. Reads ab-mcp.config.json (live, no
// cache) and validates its shape.
import { readFileSync } from "node:fs";

import type { RepoEntry } from "../core/classify-structure.js";

export type ConfigSource = {
  loadConfig(): RepoEntry[];
};

type RawConfigEntry = {
  "repo-name"?: unknown;
  "doc-path"?: unknown;
};

/**
 * Loads {@link RepoEntry} list from `configPath` (ab-mcp.config.json).
 * Throws if the file is missing or malformed -- the composition root
 * (server.ts) treats that as a `health.startup.refused` condition for the
 * whole process (brief.md Section 9, composition-root invariant).
 */
export function loadConfig(configPath: string): RepoEntry[] {
  const fileContents = readConfigFile(configPath);
  const parsedJson = parseConfigJson(fileContents, configPath);
  return toRepoEntries(parsedJson, configPath);
}

function readConfigFile(configPath: string): string {
  try {
    return readFileSync(configPath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read ab-mcp config file at "${configPath}": ${describeError(error)}`,
    );
  }
}

function parseConfigJson(fileContents: string, configPath: string): unknown {
  try {
    return JSON.parse(fileContents);
  } catch (error) {
    throw new Error(
      `Failed to parse ab-mcp config file at "${configPath}" as JSON: ${describeError(error)}`,
    );
  }
}

function toRepoEntries(parsedJson: unknown, configPath: string): RepoEntry[] {
  if (!Array.isArray(parsedJson)) {
    throw new Error(
      `Invalid ab-mcp config file at "${configPath}": expected a JSON array of repo entries, got ${typeof parsedJson}`,
    );
  }

  return parsedJson.map((entry, index) =>
    toRepoEntry(entry, index, configPath),
  );
}

function toRepoEntry(
  entry: unknown,
  index: number,
  configPath: string,
): RepoEntry {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(
      `Invalid ab-mcp config file at "${configPath}": entry at index ${index} must be an object`,
    );
  }

  const rawEntry = entry as RawConfigEntry;
  const repoName = requireNonEmptyString(
    rawEntry["repo-name"],
    "repo-name",
    index,
    configPath,
  );
  const docPath = requireNonEmptyString(
    rawEntry["doc-path"],
    "doc-path",
    index,
    configPath,
  );

  return { repoName, docPath };
}

function requireNonEmptyString(
  value: unknown,
  fieldName: string,
  index: number,
  configPath: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Invalid ab-mcp config file at "${configPath}": entry at index ${index} must have a non-empty string "${fieldName}"`,
    );
  }
  return value;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
