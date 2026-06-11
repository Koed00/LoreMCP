// Imperative shell: DocTreeReader port -- the ONLY module that imports
// node:fs. Implements the probe() contract (brief.md Section 9, Principle
// 12) and the live (no-cache) listDir/readFile/pathExists primitives.
import * as fs from "node:fs";

export type ProbeOutcome =
  | { ok: true }
  | { ok: false; errorCode: "REPO_PATH_NOT_FOUND"; reason: string };

export type ReadFileOutcome =
  | { ok: true; content: string }
  | { ok: false; reason: string };

export type DocTreeReader = {
  /**
   * Fault-injection-safe existence/readability check for `docPath`
   * (brief.md Section 9, scenarios 1-3). MUST NOT throw.
   */
  probe(docPath: string): ProbeOutcome;
  /** Live `readdir` of `path`. Returns entry names, or [] if not a directory. */
  listDir(path: string): string[];
  /**
   * Live `readFile` of `path` (utf-8). Returns a structured "not found"
   * outcome for TOCTOU (file disappeared after listDir) instead of
   * throwing -- callers must handle the `{ok:false}` case (brief.md
   * Section 9, scenario 4).
   */
  readFile(path: string): ReadFileOutcome;
  /** Live existence check (does not distinguish file vs directory). */
  pathExists(path: string): boolean;
};

export function createFsDocTreeReader(): DocTreeReader {
  return {
    probe(docPath: string): ProbeOutcome {
      let stats: fs.Stats;
      try {
        stats = fs.statSync(docPath);
      } catch {
        return {
          ok: false,
          errorCode: "REPO_PATH_NOT_FOUND",
          reason: `Path does not exist: ${docPath}`,
        };
      }

      if (!stats.isDirectory()) {
        return {
          ok: false,
          errorCode: "REPO_PATH_NOT_FOUND",
          reason: `Path exists but is not a directory: ${docPath}`,
        };
      }

      try {
        fs.accessSync(docPath, fs.constants.R_OK);
      } catch {
        return {
          ok: false,
          errorCode: "REPO_PATH_NOT_FOUND",
          reason: `Path exists but is not readable: ${docPath}`,
        };
      }

      return { ok: true };
    },

    listDir(path: string): string[] {
      try {
        return fs.readdirSync(path);
      } catch {
        return [];
      }
    },

    readFile(path: string): ReadFileOutcome {
      try {
        const content = fs.readFileSync(path, "utf-8");
        return { ok: true, content };
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : `Failed to read file: ${path}`;
        return { ok: false, reason };
      }
    },

    pathExists(path: string): boolean {
      return fs.existsSync(path);
    },
  };
}
