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

function hasNoNwaveStructure(snapshot: TreeSnapshot): boolean {
  return (
    Object.keys(snapshot.features).length === 0 &&
    snapshot.adrFiles.length === 0 &&
    snapshot.claudeMdPath === null
  );
}

function adrFilesToRead(snapshot: TreeSnapshot): FileToRead[] {
  return [...snapshot.adrFiles]
    .sort()
    .map((sourceFile) => ({ sourceFile, phase: "architecture" }));
}

function claudeMdFileToRead(snapshot: TreeSnapshot): FileToRead[] {
  return snapshot.claudeMdPath !== null
    ? [{ sourceFile: snapshot.claudeMdPath, phase: "claude-md" }]
    : [];
}

// Mirrors src/shell/server.ts's DELIVER_PHASE_NAME. Duplicated rather than
// shared because classify-structure.ts is core (no imports from shell) and
// server.ts is shell -- see CLAUDE.md's functional core/imperative shell
// boundary. Keep both literals in sync if the phase name ever changes.
const DELIVER_PHASE_NAME = "deliver";

// "deliver" is a detected phase (per its execution-log.json having a COMMIT
// entry, see src/shell/server.ts's discoverFeatures), but DELIVER produces an
// execution-log.json, never a wave-decisions.md -- attempting that read would
// always TOCTOU-fail and surface a misleading "file may have been removed"
// warning for every feature's deliver phase, even when nothing went wrong.
function featurePhaseFilesToRead(
  snapshot: TreeSnapshot,
  featureId: string,
): FileToRead[] {
  const phases = snapshot.features[featureId] ?? [];
  return phases
    .filter((phase) => phase !== DELIVER_PHASE_NAME)
    .map((phase) => ({
      sourceFile: `docs/feature/${featureId}/${phase}/wave-decisions.md`,
      phase,
    }));
}

function buildPartialWarnings(snapshot: TreeSnapshot): string[] {
  const warnings: string[] = [];

  if (snapshot.adrFiles.length > 0) {
    warnings.push(
      "Repo has architecture ADRs but no feature-level wave-decisions.md for the requested feature.",
    );
  } else if (snapshot.claudeMdPath !== null) {
    warnings.push(
      "No feature-level or architecture-level documentation found; falling back to only CLAUDE.md-level context.",
    );
  }

  return warnings;
}

function classifyFull(
  snapshot: TreeSnapshot,
  featureId: string,
): ClassifyResult {
  return {
    outcome: "FULL",
    filesToRead: [
      ...featurePhaseFilesToRead(snapshot, featureId),
      ...adrFilesToRead(snapshot),
      ...claudeMdFileToRead(snapshot),
    ],
    warnings: [],
    availableFeatures: Object.keys(snapshot.features),
  };
}

function classifyPartial(snapshot: TreeSnapshot): ClassifyResult {
  return {
    outcome: "PARTIAL",
    filesToRead: [...adrFilesToRead(snapshot), ...claudeMdFileToRead(snapshot)],
    warnings: buildPartialWarnings(snapshot),
    availableFeatures: Object.keys(snapshot.features),
  };
}

function hasFallbackContext(snapshot: TreeSnapshot): boolean {
  return snapshot.adrFiles.length > 0 || snapshot.claudeMdPath !== null;
}

export function classifyStructure(
  snapshot: TreeSnapshot,
  featureId: string,
): ClassifyResult {
  if (hasNoNwaveStructure(snapshot)) {
    return {
      outcome: "NO_NWAVE_STRUCTURE",
      filesToRead: [],
      warnings: [],
      availableFeatures: [],
    };
  }

  if (featureId in snapshot.features) {
    return classifyFull(snapshot, featureId);
  }

  if (hasFallbackContext(snapshot)) {
    return classifyPartial(snapshot);
  }

  return {
    outcome: "FEATURE_NOT_FOUND",
    filesToRead: [],
    warnings: [],
    availableFeatures: Object.keys(snapshot.features),
  };
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
  if (hasNoNwaveStructure(snapshot)) {
    return {
      features: [],
      hasArchitectureAdrs: false,
      hasClaudeMd: false,
      isNoNwaveStructure: true,
    };
  }

  return {
    features: Object.entries(snapshot.features).map(([featureId, phases]) => ({
      featureId,
      phases,
    })),
    hasArchitectureAdrs: snapshot.adrFiles.length > 0,
    hasClaudeMd: snapshot.claudeMdPath !== null,
    isNoNwaveStructure: false,
  };
}
