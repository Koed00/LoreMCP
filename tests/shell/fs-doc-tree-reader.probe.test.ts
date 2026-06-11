import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createFsDocTreeReader } from "../../src/shell/fs-doc-tree-reader.js";

const reader = createFsDocTreeReader();

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ab-mcp-fs-reader-"));
}

describe("createFsDocTreeReader probe contract", () => {
  const cleanupDirs: string[] = [];

  afterEach(() => {
    while (cleanupDirs.length > 0) {
      const dir = cleanupDirs.pop()!;
      try {
        fs.chmodSync(dir, 0o755);
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  });

  it("scenario 1: path does not exist returns REPO_PATH_NOT_FOUND", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const missingPath = path.join(tempDir, "does-not-exist");

    const outcome = reader.probe(missingPath);

    expect(outcome).toEqual({
      ok: false,
      errorCode: "REPO_PATH_NOT_FOUND",
      reason: expect.any(String),
    });
  });

  it("scenario 2: path exists but is not a directory returns REPO_PATH_NOT_FOUND", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const filePath = path.join(tempDir, "a-file.txt");
    fs.writeFileSync(filePath, "not a directory");

    const outcome = reader.probe(filePath);

    expect(outcome).toEqual({
      ok: false,
      errorCode: "REPO_PATH_NOT_FOUND",
      reason: expect.any(String),
    });
  });

  it("scenario 3: path exists but is not readable (permission denied)", () => {
    if (process.getuid && process.getuid() === 0) {
      // Running as root: chmod-based permission checks don't restrict access.
      return;
    }

    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const restrictedDir = path.join(tempDir, "restricted");
    fs.mkdirSync(restrictedDir);

    try {
      fs.chmodSync(restrictedDir, 0o000);

      const outcome = reader.probe(restrictedDir);

      expect(outcome).toEqual({
        ok: false,
        errorCode: "REPO_PATH_NOT_FOUND",
        reason: expect.any(String),
      });
    } finally {
      fs.chmodSync(restrictedDir, 0o755);
    }
  });

  it("scenario 4: file disappears between listDir and readFile (TOCTOU)", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const filePath = path.join(tempDir, "ephemeral.md");
    fs.writeFileSync(filePath, "ephemeral content");

    const entries = reader.listDir(tempDir);
    expect(entries).toContain("ephemeral.md");

    fs.rmSync(filePath);

    const result = reader.readFile(filePath);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.reason).toBe("string");
    }
  });

  it("scenario 5: symlink escaping doc_path root is followed and read normally", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const docRoot = path.join(tempDir, "doc-root");
    const outsideDir = path.join(tempDir, "outside");
    fs.mkdirSync(docRoot);
    fs.mkdirSync(outsideDir);

    const outsideFile = path.join(outsideDir, "external.md");
    fs.writeFileSync(outsideFile, "external content");

    const symlinkPath = path.join(docRoot, "link-to-external.md");
    fs.symlinkSync(outsideFile, symlinkPath);

    const result = reader.readFile(symlinkPath);

    expect(result).toEqual({ ok: true, content: "external content" });
  });

  it("scenario 6: directory listing uses exact readdir results (case-sensitive)", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    fs.writeFileSync(path.join(tempDir, "Wave-Decisions.md"), "content A");
    fs.writeFileSync(path.join(tempDir, "ADR-001.md"), "content C");

    const entries = reader.listDir(tempDir);

    // listDir must return exactly what readdirSync returns -- no
    // case-folding, no case-normalization, no assumed-case path
    // construction.
    expect(entries.sort()).toEqual(fs.readdirSync(tempDir).sort());
    expect(entries).toContain("Wave-Decisions.md");
    expect(entries).toContain("ADR-001.md");
    expect(entries).not.toContain("wave-decisions.md");
    expect(entries).not.toContain("adr-001.md");
  });

  it("probe returns ok:true for an existing readable directory", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);

    const outcome = reader.probe(tempDir);

    expect(outcome).toEqual({ ok: true });
  });

  it("pathExists returns true for existing path and false otherwise", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const filePath = path.join(tempDir, "exists.md");
    fs.writeFileSync(filePath, "hello");

    expect(reader.pathExists(filePath)).toBe(true);
    expect(reader.pathExists(path.join(tempDir, "missing.md"))).toBe(false);
  });

  it("listDir returns [] for a path that does not exist or is not a directory", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const filePath = path.join(tempDir, "a-file.md");
    fs.writeFileSync(filePath, "content");

    expect(reader.listDir(path.join(tempDir, "missing"))).toEqual([]);
    expect(reader.listDir(filePath)).toEqual([]);
  });

  it("readFile returns ok:true with utf-8 content for an existing file", () => {
    const tempDir = makeTempDir();
    cleanupDirs.push(tempDir);
    const filePath = path.join(tempDir, "doc.md");
    fs.writeFileSync(filePath, "# Heading\ncontent", "utf-8");

    const result = reader.readFile(filePath);

    expect(result).toEqual({ ok: true, content: "# Heading\ncontent" });
  });
});
