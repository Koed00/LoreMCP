// Pure core: shapes the 4 structured error responses + the success/partial
// list_features/query_context response contracts (brief.md Section 8).

import type {
  ClassifyResult,
  ListFeaturesResult,
} from "./classify-structure.js";

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
    message: `Repo "${repoName}" is not configured in ab-mcp.config.json.`,
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
): { results: QueryContextResultItem[]; toctouWarnings: string[] } {
  const results: QueryContextResultItem[] = [];
  const toctouWarnings: string[] = [];

  for (const file of classified.filesToRead) {
    const snippet = fileContents.get(file.sourceFile);
    if (snippet === undefined) {
      toctouWarnings.push(
        `${file.sourceFile} could not be read (file may have been removed)`,
      );
      continue;
    }
    results.push({ sourceFile: file.sourceFile, phase: file.phase, snippet });
  }

  return { results, toctouWarnings };
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

  const { results, toctouWarnings } = buildQueryContextResults(classified, fileContents);
  const warnings = [...classified.warnings, ...toctouWarnings];

  return {
    repoName,
    featureId,
    results,
    retrievedAt: new Date().toISOString(),
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
