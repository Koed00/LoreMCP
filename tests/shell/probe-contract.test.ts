import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("probe contract meta-test", () => {
  const probeTestSource = fs.readFileSync(
    path.join(
      __dirname,
      "fs-doc-tree-reader.probe.test.ts",
    ),
    "utf-8",
  );

  const requiredScenarioPhrasings = [
    "path does not exist",
    "path exists but is not a directory",
    "path exists but is not readable",
    "file disappears between listDir and readFile",
    "symlink escaping doc_path root is followed and read normally",
    "directory listing uses exact readdir results (case-sensitive)",
  ];

  it.each(requiredScenarioPhrasings)(
    "fs-doc-tree-reader.probe.test.ts contains an it(...) description matching: %s",
    (phrasing) => {
      expect(probeTestSource).toContain(phrasing);
    },
  );
});
