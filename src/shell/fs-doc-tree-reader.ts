// Imperative shell: DocTreeReader port -- the ONLY module that imports
// node:fs. Implements the probe() contract (brief.md Section 9, Principle
// 12) and the live (no-cache) listDir/readFile/pathExists primitives.
// RED scaffold -- created by DISTILL (nw-distill).
export const __SCAFFOLD__ = true;

export type ProbeOutcome =
  | { ok: true }
  | { ok: false; errorCode: "REPO_PATH_NOT_FOUND"; reason: string };

export type DocTreeReader = {
  /**
   * Fault-injection-safe existence/readability check for `docPath`
   * (brief.md Section 9, scenarios 1-3). MUST NOT throw.
   */
  probe(docPath: string): ProbeOutcome;
  /** Live `readdir` of `path`. Returns entry names, or [] if not a directory. */
  listDir(path: string): string[];
  /**
   * Live `readFile` of `path` (utf-8). Throws only for TOCTOU
   * (file disappeared after listDir) -- callers must catch and treat as
   * "omit from results + add warning" (brief.md Section 9, scenario 4).
   */
  readFile(path: string): string;
  /** Live existence check (does not distinguish file vs directory). */
  pathExists(path: string): boolean;
};

export function createFsDocTreeReader(): DocTreeReader {
  return {
    probe(docPath: string): ProbeOutcome {
      throw new Error("Not yet implemented -- RED scaffold");
    },
    listDir(path: string): string[] {
      throw new Error("Not yet implemented -- RED scaffold");
    },
    readFile(path: string): string {
      throw new Error("Not yet implemented -- RED scaffold");
    },
    pathExists(path: string): boolean {
      throw new Error("Not yet implemented -- RED scaffold");
    },
  };
}
