// Pure core: shapes the 4 structured error responses + the success/partial
// list_features/query_context response contracts (brief.md Section 8).
// RED scaffold -- created by DISTILL (nw-distill).
export const __SCAFFOLD__ = true;

import type {
  ClassifyResult,
  FileToRead,
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
  throw new Error("Not yet implemented -- RED scaffold");
}

export function formatRepoPathNotFound(
  repoName: string,
  configuredPath: string,
  availableRepos: string[],
): RepoPathNotFoundError {
  throw new Error("Not yet implemented -- RED scaffold");
}

export function formatFeatureNotFound(
  repoName: string,
  featureId: string,
  availableFeatures: string[],
): FeatureNotFoundError {
  throw new Error("Not yet implemented -- RED scaffold");
}

export function formatNoNwaveStructure(
  repoName: string,
  configuredPath: string,
): NoNwaveStructureError {
  throw new Error("Not yet implemented -- RED scaffold");
}

export function formatQueryContextResponse(
  repoName: string,
  featureId: string,
  classified: ClassifyResult,
  fileContents: Map<string, string>,
): QueryContextResponse | StructuredError {
  throw new Error("Not yet implemented -- RED scaffold");
}

export function formatListFeaturesResponse(
  repoName: string,
  docPath: string,
  classified: ListFeaturesResult,
): ListFeaturesResponse | StructuredError {
  throw new Error("Not yet implemented -- RED scaffold");
}
