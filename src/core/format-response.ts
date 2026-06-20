import type {
  ClassifyResult,
  ListFeaturesResult,
} from "./classify-structure.js";
import type { ConcernMatch, RejectedPath } from "./concern-matcher.js";
import { capSnippetAtHeadingBoundary } from "./concern-matcher.js";

// Mirrors concern-matcher.ts's SNIPPET_MAX_CHARS (same value, independent
// constant) -- this one bounds query_context's per-file snippet size, the
// other bounds resolve_concern's per-match snippet size. Kept separate
// because the two tools' truncation policies are free to diverge.
const SNIPPET_MAX_CHARS = 8000;

export type QueryContextResultItem = {
  sourceFile: string;
  phase: string;
  snippet: string;
};

export type QueryContextResponse = {
  repoName: string;
  featureId: string;
  results: QueryContextResultItem[];
  retrievedAt: string;
  warnings?: string[];
};

export type ListFeaturesResponse = {
  repoName: string;
  docPath: string;
  features: { featureId: string; phases: string[] }[];
  hasArchitectureAdrs: boolean;
  hasClaudeMd: boolean;
};

export type RepoNotConfiguredError = {
  error: "REPO_NOT_CONFIGURED";
  repoName: string;
  message: string;
  availableRepos: string[];
};

export type RepoPathNotFoundError = {
  error: "REPO_PATH_NOT_FOUND";
  repoName: string;
  configuredPath: string;
  message: string;
  availableRepos: string[];
};

export type FeatureNotFoundError = {
  error: "FEATURE_NOT_FOUND";
  repoName: string;
  featureId: string;
  message: string;
  availableFeatures: string[];
};

export type NoNwaveStructureError = {
  error: "NO_NWAVE_STRUCTURE";
  repoName: string;
  configuredPath: string;
  message: string;
};

export type StructuredError =
  | RepoNotConfiguredError
  | RepoPathNotFoundError
  | FeatureNotFoundError
  | NoNwaveStructureError;

export function formatRepoNotConfigured(
  repoName: string,
  availableRepos: string[],
): RepoNotConfiguredError {
  return {
    error: "REPO_NOT_CONFIGURED",
    repoName,
    message: `Repo "${repoName}" is not configured in lore-mcp.config.json.`,
    availableRepos,
  };
}

export function formatRepoPathNotFound(
  repoName: string,
  configuredPath: string,
  availableRepos: string[],
): RepoPathNotFoundError {
  return {
    error: "REPO_PATH_NOT_FOUND",
    repoName,
    configuredPath,
    message: `Configured path "${configuredPath}" for repo "${repoName}" does not exist or is not readable.`,
    availableRepos,
  };
}

export function formatFeatureNotFound(
  repoName: string,
  featureId: string,
  availableFeatures: string[],
): FeatureNotFoundError {
  return {
    error: "FEATURE_NOT_FOUND",
    repoName,
    featureId,
    message: `Feature "${featureId}" was not found in repo "${repoName}".`,
    availableFeatures,
  };
}

export function formatNoNwaveStructure(
  repoName: string,
  configuredPath: string,
): NoNwaveStructureError {
  return {
    error: "NO_NWAVE_STRUCTURE",
    repoName,
    configuredPath,
    message: `Repo "${repoName}" at "${configuredPath}" does not contain nWave-structured documentation. Expected docs/feature/*, docs/product/architecture/*.md, or CLAUDE.md.`,
  };
}

function buildQueryContextResults(
  classified: ClassifyResult,
  fileContents: Map<string, string>,
): { results: QueryContextResultItem[]; toctouWarnings: string[]; perFileTruncations: number } {
  const results: QueryContextResultItem[] = [];
  const toctouWarnings: string[] = [];
  let perFileTruncations = 0;

  for (const file of classified.filesToRead) {
    const content = fileContents.get(file.sourceFile);
    if (content === undefined) {
      toctouWarnings.push(
        `${file.sourceFile} could not be read (file may have been removed)`,
      );
      continue;
    }
    const { snippet, truncated } = capSnippetAtHeadingBoundary(content, SNIPPET_MAX_CHARS);
    if (truncated) {
      perFileTruncations += 1;
    }
    results.push({ sourceFile: file.sourceFile, phase: file.phase, snippet });
  }

  return { results, toctouWarnings, perFileTruncations };
}

// 60000, not 24000 (3x SNIPPET_MAX_CHARS) -- the smaller value crushed this
// project's own deep-history ab-mcp feature from 15 results down to 1,
// dropping foundational decisions entirely. 60000 comfortably preserves
// ab-mcp's full 43,697-char history while still meaningfully bounding the
// original 97,705-char pathological case that motivated this cap.
const TOTAL_RESPONSE_MAX_CHARS = 60000;

// Repo-wide content (ADRs, CLAUDE.md) is not specific to the queried feature --
// when budget-constrained, it is dropped before any of the feature's OWN
// wave-decisions, regardless of age. Within each group, oldest is dropped first.
const REPO_WIDE_PHASES = new Set(["architecture", "claude-md"]);

function isRepoWide(result: QueryContextResultItem): boolean {
  return REPO_WIDE_PHASES.has(result.phase);
}

function keepNewestWithinBudget(
  results: QueryContextResultItem[],
  remainingBudget: number,
): { kept: QueryContextResultItem[]; cumulativeLength: number } {
  const kept: QueryContextResultItem[] = [];
  let cumulativeLength = 0;

  for (let index = results.length - 1; index >= 0; index -= 1) {
    const candidate = results[index];
    if (candidate === undefined) {
      continue;
    }
    const nextCumulativeLength = cumulativeLength + candidate.snippet.length;
    if (nextCumulativeLength > remainingBudget) {
      break;
    }
    cumulativeLength = nextCumulativeLength;
    kept.unshift(candidate);
  }

  return { kept, cumulativeLength };
}

export function capResultsToTotalBudget(
  results: QueryContextResultItem[],
): { results: QueryContextResultItem[]; truncated: boolean } {
  const totalLength = results.reduce((sum, result) => sum + result.snippet.length, 0);
  if (totalLength <= TOTAL_RESPONSE_MAX_CHARS) {
    return { results, truncated: false };
  }

  const featureResults = results.filter((r) => !isRepoWide(r));
  const repoWideResults = results.filter(isRepoWide);

  const featureLength = featureResults.reduce((sum, r) => sum + r.snippet.length, 0);

  if (featureLength <= TOTAL_RESPONSE_MAX_CHARS) {
    // All feature-specific content fits -- fill remaining budget with the
    // newest repo-wide content (ADRs/CLAUDE.md), dropping the oldest first.
    const remainingBudget = TOTAL_RESPONSE_MAX_CHARS - featureLength;
    const { kept: keptRepoWide } = keepNewestWithinBudget(repoWideResults, remainingBudget);
    const keptSet = new Set(keptRepoWide);
    const kept = results.filter((r) => !isRepoWide(r) || keptSet.has(r));
    return { results: kept, truncated: kept.length < results.length };
  }

  // Even feature-specific content alone exceeds budget -- repo-wide content is
  // dropped entirely, and feature-specific content drops its oldest first.
  const { kept } = keepNewestWithinBudget(featureResults, TOTAL_RESPONSE_MAX_CHARS);
  return { results: kept, truncated: true };
}

function formatTruncationWarning(keptCount: number, totalCount: number): string {
  const omittedCount = totalCount - keptCount;
  return `Response truncated to stay within the total size limit; oldest wave content dropped. ${omittedCount} of ${totalCount} results omitted.`;
}

export function formatQueryContextResponse(
  repoName: string,
  featureId: string,
  configuredPath: string,
  classified: ClassifyResult,
  fileContents: Map<string, string>,
): QueryContextResponse | StructuredError {
  if (classified.outcome === "FEATURE_NOT_FOUND") {
    return formatFeatureNotFound(repoName, featureId, classified.availableFeatures);
  }

  if (classified.outcome === "NO_NWAVE_STRUCTURE") {
    return formatNoNwaveStructure(repoName, configuredPath);
  }

  const { results: builtResults, toctouWarnings, perFileTruncations } = buildQueryContextResults(
    classified,
    fileContents,
  );
  const { results, truncated } = capResultsToTotalBudget(builtResults);
  const truncationWarnings = truncated
    ? [formatTruncationWarning(results.length, builtResults.length)]
    : [];
  const perFileTruncationWarnings =
    perFileTruncations > 0
      ? [`${perFileTruncations} result(s) had their individual snippet truncated to ${SNIPPET_MAX_CHARS} chars.`]
      : [];
  const warnings = [
    ...classified.warnings,
    ...toctouWarnings,
    ...perFileTruncationWarnings,
    ...truncationWarnings,
  ];

  return {
    repoName,
    featureId,
    results,
    retrievedAt: new Date().toISOString(),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ---------------------------------------------------------------------------
// Concern-based querying response types and formatters
// ---------------------------------------------------------------------------

export type InvalidConcernError = {
  error: "INVALID_CONCERN";
  concern: string;
  message: string;
  retrievedAt: string;
};

export type ConcernNotFoundError = {
  error: "CONCERN_NOT_FOUND";
  concern: string;
  message: string;
  searchedRepos: string[];
  warnings?: string[];
  retrievedAt: string;
};

export type ResolveConcernResponse = {
  concern: string;
  matches: ConcernMatch[];
  rejectedPaths: RejectedPath[];
  warnings?: string[];
  retrievedAt: string;
};

export function formatInvalidConcern(concern: string): InvalidConcernError {
  return {
    error: "INVALID_CONCERN",
    concern,
    message: `Concern "${concern}" is invalid. It must be non-empty and contain at least one alphanumeric character.`,
    retrievedAt: "live (no cache)",
  };
}

export function formatConcernNotFound(
  concern: string,
  searchedRepos: string[],
  skipWarnings: string[],
): ConcernNotFoundError {
  return {
    error: "CONCERN_NOT_FOUND",
    concern,
    message: `No nWave artifacts mentioning "${concern}" were found across the searched repos. Try list_concerns() to browse available topics.`,
    searchedRepos,
    ...(skipWarnings.length > 0 ? { warnings: skipWarnings } : {}),
    retrievedAt: "live (no cache)",
  };
}

export function formatResolveConcernResponse(
  concern: string,
  allMatches: ConcernMatch[],
  allRejectedPaths: RejectedPath[],
  warnings: string[],
): ResolveConcernResponse {
  const hasFeatureLevelMatch = allMatches.some((m) => m.relevance === "feature-level");
  const allWarnings = hasFeatureLevelMatch
    ? warnings
    : [
        ...warnings,
        `No feature-level documentation found for "${concern}". Matches are from architecture or repo-conventions only.`,
      ];

  return {
    concern,
    matches: allMatches,
    rejectedPaths: allRejectedPaths,
    ...(allWarnings.length > 0 ? { warnings: allWarnings } : {}),
    retrievedAt: "live (no cache)",
  };
}

export type ListConcernsResponse = {
  concerns: string[];
  searchedRepos: string[];
  warnings?: string[];
};

export function formatListConcernsResponse(
  concerns: string[],
  searchedRepos: string[],
  warnings: string[],
): ListConcernsResponse {
  return {
    concerns,
    searchedRepos,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function formatListFeaturesResponse(
  repoName: string,
  docPath: string,
  classified: ListFeaturesResult,
): ListFeaturesResponse | StructuredError {
  if (classified.isNoNwaveStructure) {
    return formatNoNwaveStructure(repoName, docPath);
  }

  return {
    repoName,
    docPath,
    features: classified.features,
    hasArchitectureAdrs: classified.hasArchitectureAdrs,
    hasClaudeMd: classified.hasClaudeMd,
  };
}
