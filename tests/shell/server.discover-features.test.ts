import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createFsDocTreeReader } from "../../src/shell/fs-doc-tree-reader.js";
import { discoverFeatures } from "../../src/shell/server.js";

const reader = createFsDocTreeReader();

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ab-mcp-discover-features-"));
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  writeFile(filePath, JSON.stringify(value));
}

describe("discoverFeatures deliver-phase detection", () => {
  const cleanupDirs: string[] = [];

  afterEach(() => {
    while (cleanupDirs.length > 0) {
      const dir = cleanupDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeDocPath(): string {
    const docPath = makeTempDir();
    cleanupDirs.push(docPath);
    return docPath;
  }

  it("includes deliver when execution-log.json has a COMMIT entry", () => {
    const docPath = makeDocPath();
    writeJson(
      path.join(docPath, "feature", "shipped", "deliver", "execution-log.json"),
      { events: [{ sid: "01-01", p: "PREPARE" }, { sid: "01-01", p: "COMMIT" }] },
    );

    const features = discoverFeatures(reader, docPath);

    expect(features["shipped"]).toContain("deliver");
  });

  it("omits deliver when execution-log.json has zero COMMIT entries", () => {
    const docPath = makeDocPath();
    writeJson(
      path.join(docPath, "feature", "mid-deliver", "deliver", "execution-log.json"),
      { events: [{ sid: "01-01", p: "PREPARE" }, { sid: "01-01", p: "RED_ACCEPTANCE" }] },
    );
    // Give the feature another valid phase so it's not dropped entirely.
    writeFile(
      path.join(docPath, "feature", "mid-deliver", "design", "wave-decisions.md"),
      "# decisions\n",
    );

    const features = discoverFeatures(reader, docPath);

    expect(features["mid-deliver"]).not.toContain("deliver");
  });

  it("omits deliver when execution-log.json is malformed JSON", () => {
    const docPath = makeDocPath();
    writeFile(
      path.join(docPath, "feature", "broken-log", "deliver", "execution-log.json"),
      "{ not valid json",
    );
    writeFile(
      path.join(docPath, "feature", "broken-log", "design", "wave-decisions.md"),
      "# decisions\n",
    );

    const features = discoverFeatures(reader, docPath);

    expect(features["broken-log"]).not.toContain("deliver");
  });

  it("omits deliver when execution-log.json is missing from the deliver directory", () => {
    const docPath = makeDocPath();
    // deliver/ directory exists (has some other file) but no execution-log.json
    writeFile(
      path.join(docPath, "feature", "empty-deliver", "deliver", "notes.txt"),
      "irrelevant",
    );
    writeFile(
      path.join(docPath, "feature", "empty-deliver", "design", "wave-decisions.md"),
      "# decisions\n",
    );

    const features = discoverFeatures(reader, docPath);

    expect(features["empty-deliver"]).not.toContain("deliver");
  });

  it("behaves identically to today when no deliver directory exists at all", () => {
    const docPath = makeDocPath();
    writeFile(
      path.join(docPath, "feature", "no-deliver-yet", "design", "wave-decisions.md"),
      "# design decisions\n",
    );
    writeFile(
      path.join(docPath, "feature", "no-deliver-yet", "discuss", "wave-decisions.md"),
      "# discuss decisions\n",
    );

    const features = discoverFeatures(reader, docPath);

    expect(features["no-deliver-yet"]).toEqual(["design", "discuss"]);
  });
});
