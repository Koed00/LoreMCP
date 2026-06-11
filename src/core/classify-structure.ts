// Pure core: classifies a repo's nWave document-tree snapshot against a
// requested feature_id, per architecture brief.md Decision 4/5 precedence
// rules. RED scaffold -- created by DISTILL (nw-distill).
export const __SCAFFOLD__ = true;

export type RepoEntry = {
  repoName: string;
  docPath: string;
};

// Snapshot of what exists on disk for one repo, collected by the shell
// (FsDocTreeReader) BEFORE calling into this pure core function.
export type TreeSnapshot = {
  repoName: string;
  docPath: string;
  /** docPath exists and is a readable directory */
  docPathExists: boolean;
  /** feature_id -> phase directory names found under docs/feature/{feature_id}/ */
  features: Record<string, string[]>;
  /** ADR file paths found under docs/product/architecture/*.md, sorted */
  adrFiles: string[];
  /** true if <repo>/CLAUDE.md exists (OQ-1: doc_path/../CLAUDE.md) */
  claudeMdPath: string | null;
};

export type FileToRead = {
  sourceFile: string;
  phase: string;
};

export type ClassifyOutcome =
  | "FULL"
  | "PARTIAL"
  | "FEATURE_NOT_FOUND"
  | "NO_NWAVE_STRUCTURE";

export type ClassifyResult = {
  outcome: ClassifyOutcome;
  filesToRead: FileToRead[];
  warnings: string[];
  availableFeatures: string[];
};

export function classifyStructure(
  snapshot: TreeSnapshot,
  featureId: string,
): ClassifyResult {
  throw new Error("Not yet implemented -- RED scaffold");
}

export type ListFeaturesResult = {
  features: { featureId: string; phases: string[] }[];
  hasArchitectureAdrs: boolean;
  hasClaudeMd: boolean;
  isNoNwaveStructure: boolean;
};

export function classifyRepoForListFeatures(
  snapshot: TreeSnapshot,
): ListFeaturesResult {
  throw new Error("Not yet implemented -- RED scaffold");
}
