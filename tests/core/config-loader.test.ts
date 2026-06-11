import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadConfig } from "../../src/shell/config-loader.js";

describe("loadConfig", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function writeConfigFile(fileName: string, contents: string): string {
    tempDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-config-"));
    const configPath = path.join(tempDir, fileName);
    writeFileSync(configPath, contents);
    return configPath;
  }

  it("returns RepoEntry[] with camelCase fields for a valid config file", () => {
    const configPath = writeConfigFile(
      "ab-mcp.config.json",
      JSON.stringify([
        { "repo-name": "ab-mcp", "doc-path": "/abs/path/to/AB-MCP/docs" },
        { "repo-name": "other-repo", "doc-path": "/abs/path/to/other/docs" },
      ]),
    );

    const result = loadConfig(configPath);

    expect(result).toEqual([
      { repoName: "ab-mcp", docPath: "/abs/path/to/AB-MCP/docs" },
      { repoName: "other-repo", docPath: "/abs/path/to/other/docs" },
    ]);
  });

  it("throws a clear error when the config file is missing", () => {
    const missingPath = path.join(
      mkdtempSync(path.join(tmpdir(), "ab-mcp-config-")),
      "does-not-exist.json",
    );
    tempDir = path.dirname(missingPath);

    expect(() => loadConfig(missingPath)).toThrow();
  });

  it("throws a clear error when the config file contains malformed JSON", () => {
    const configPath = writeConfigFile(
      "ab-mcp.config.json",
      "{ this is not valid json ",
    );

    expect(() => loadConfig(configPath)).toThrow();
  });

  it("throws a clear error when the config is not an array", () => {
    const configPath = writeConfigFile(
      "ab-mcp.config.json",
      JSON.stringify({ "repo-name": "ab-mcp", "doc-path": "/some/path" }),
    );

    expect(() => loadConfig(configPath)).toThrow();
  });

  it("throws a clear error when an entry is missing repo-name", () => {
    const configPath = writeConfigFile(
      "ab-mcp.config.json",
      JSON.stringify([{ "doc-path": "/abs/path/to/AB-MCP/docs" }]),
    );

    expect(() => loadConfig(configPath)).toThrow();
  });

  it("throws a clear error when an entry is missing doc-path", () => {
    const configPath = writeConfigFile(
      "ab-mcp.config.json",
      JSON.stringify([{ "repo-name": "ab-mcp" }]),
    );

    expect(() => loadConfig(configPath)).toThrow();
  });

  it("throws a clear error when an entry has wrong types for repo-name or doc-path", () => {
    const configPath = writeConfigFile(
      "ab-mcp.config.json",
      JSON.stringify([{ "repo-name": 123, "doc-path": true }]),
    );

    expect(() => loadConfig(configPath)).toThrow();
  });

  it("throws a clear error when repo-name or doc-path is an empty string", () => {
    const configPath = writeConfigFile(
      "ab-mcp.config.json",
      JSON.stringify([{ "repo-name": "", "doc-path": "" }]),
    );

    expect(() => loadConfig(configPath)).toThrow();
  });
});
