// src/core/concern-matcher.ts
// RED scaffold -- all functions throw "Not yet implemented" so acceptance
// tests fail RED (not BROKEN from import errors or missing tool registration).
//
// The software-crafter (DELIVER wave) replaces these throw stubs with real
// implementations. The types and contracts below are the binding spec from
// docs/feature/concern-based-querying/design/architecture-design.md.

export const __SCAFFOLD__ = true;

// ---------------------------------------------------------------------------
// Types (binding contracts from DESIGN wave)
// ---------------------------------------------------------------------------

export interface ConcernScanInput {
  /** Already validated non-empty, trimmed concern string. */
  concern: string;
  repoName: string;
  docPath: string;
  /** Pre-collected feature phase files from the TreeSnapshot + shell reads. */
  featureFiles: Array<{
    sourceFile: string;
    phase: string;
    content: string;
  }>;
  /** Pre-collected ADR files. */
  adrFiles: Array<{
    sourceFile: string;
    content: string;
  }>;
  /** CLAUDE.md content, or null if absent. */
  claudeMdFile: { sourceFile: string; content: string } | null;
  /** Feature directory names for directory-name matching (US-CBQ-01 DE-2). */
  featureDirectoryNames: string[];
}

export interface ConcernMatch {
  repoName: string;
  sourceFile: string;
  phase: string;
  /** Whole-file content, size-capped at 8 000 chars with heading-aligned truncation. */
  snippet: string;
  relevance: "feature-level" | "architecture-level" | "repo-conventions";
}

export interface RejectedPath {
  repoName: string;
  sourceFile: string;
  /** Rejection paragraph, capped at 1 500 chars. */
  snippet: string;
  type: "rejected_alternative";
}

export interface ConcernScanResult {
  matches: ConcernMatch[];
  rejectedPaths: RejectedPath[];
  /** Truncation warnings from snippet size-capping. */
  truncationWarnings: string[];
}

// ---------------------------------------------------------------------------
// Pure functions (RED stubs)
// ---------------------------------------------------------------------------

/**
 * Validates that the concern string is non-empty after trimming and contains
 * at least one alphanumeric character (/[a-zA-Z0-9]/).
 */
export function validateConcern(
  concern: string,
): { valid: true } | { valid: false; reason: string } {
  throw new Error("Not yet implemented — RED scaffold");
}

/**
 * Keyword-scans pre-collected file contents and feature directory names for
 * the concern string (case-insensitive). Returns ranked matches and rejected
 * paths. Pure: no fs access.
 */
export function matchConcernInSnapshot(
  input: ConcernScanInput,
): ConcernScanResult {
  throw new Error("Not yet implemented — RED scaffold");
}

/**
 * Splits file content into paragraphs and returns a RejectedPath for each
 * paragraph that contains both the concern keyword and a rejection keyword.
 * Pure: no fs access.
 */
export function detectRejectedPaths(
  sourceFile: string,
  repoName: string,
  phase: string,
  content: string,
  concern: string,
): RejectedPath[] {
  throw new Error("Not yet implemented — RED scaffold");
}
