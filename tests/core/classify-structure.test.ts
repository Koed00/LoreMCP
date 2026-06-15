import { describe, it, expect } from "vitest";
import {
  classifyStructure,
  classifyRepoForListFeatures,
  type TreeSnapshot,
} from "../../src/core/classify-structure.js";

const baseSnapshot: TreeSnapshot = {
  repoName: "ab-mcp",
  docPath: "docs",
  docPathExists: true,
  features: {},
  adrFiles: [],
  claudeMdPath: null,
};

describe("classifyStructure", () => {
  it("returns NO_NWAVE_STRUCTURE when no features, no ADRs, no CLAUDE.md", () => {
    const result = classifyStructure(baseSnapshot, "ab-mcp");

    expect(result).toEqual({
      outcome: "NO_NWAVE_STRUCTURE",
      filesToRead: [],
      warnings: [],
      availableFeatures: [],
    });
  });

  it("returns FEATURE_NOT_FOUND with availableFeatures when feature missing and no fallback", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      features: { "other-feature": ["discover"] },
    };

    const result = classifyStructure(snapshot, "ab-mcp");

    expect(result).toEqual({
      outcome: "FEATURE_NOT_FOUND",
      filesToRead: [],
      warnings: [],
      availableFeatures: ["other-feature"],
    });
  });

  it("returns FULL with one entry per phase for a multi-phase feature", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      features: { "ab-mcp": ["discover", "design", "distill"] },
    };

    const result = classifyStructure(snapshot, "ab-mcp");

    expect(result).toEqual({
      outcome: "FULL",
      filesToRead: [
        { sourceFile: "docs/feature/ab-mcp/discover/wave-decisions.md", phase: "discover" },
        { sourceFile: "docs/feature/ab-mcp/design/wave-decisions.md", phase: "design" },
        { sourceFile: "docs/feature/ab-mcp/distill/wave-decisions.md", phase: "distill" },
      ],
      warnings: [],
      availableFeatures: ["ab-mcp"],
    });
  });

  it("returns FULL with supplementary ADRs and CLAUDE.md and no spurious warnings", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      features: { "ab-mcp": ["discover"] },
      adrFiles: ["docs/product/architecture/ADR-001-foo.md"],
      claudeMdPath: "CLAUDE.md",
    };

    const result = classifyStructure(snapshot, "ab-mcp");

    expect(result.outcome).toBe("FULL");
    expect(result.warnings).toEqual([]);
    expect(result.filesToRead).toEqual([
      { sourceFile: "docs/feature/ab-mcp/discover/wave-decisions.md", phase: "discover" },
      { sourceFile: "docs/product/architecture/ADR-001-foo.md", phase: "architecture" },
      { sourceFile: "CLAUDE.md", phase: "claude-md" },
    ]);
    expect(result.availableFeatures).toEqual(["ab-mcp"]);
  });

  it("returns PARTIAL with ADRs only, warning mentions missing feature-level wave-decisions", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      features: { "other-feature": ["discover"] },
      adrFiles: ["docs/product/architecture/ADR-001-foo.md"],
      claudeMdPath: null,
    };

    const result = classifyStructure(snapshot, "ab-mcp");

    expect(result.outcome).toBe("PARTIAL");
    expect(result.filesToRead).toEqual([
      { sourceFile: "docs/product/architecture/ADR-001-foo.md", phase: "architecture" },
    ]);
    expect(result.availableFeatures).toEqual(["other-feature"]);
    expect(result.warnings.some((w) => w.includes("no feature-level wave-decisions.md"))).toBe(true);
  });

  it("returns PARTIAL with CLAUDE.md only, warning mentions only CLAUDE.md-level context", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      features: { "other-feature": ["discover"] },
      adrFiles: [],
      claudeMdPath: "CLAUDE.md",
    };

    const result = classifyStructure(snapshot, "ab-mcp");

    expect(result.outcome).toBe("PARTIAL");
    expect(result.filesToRead).toEqual([
      { sourceFile: "CLAUDE.md", phase: "claude-md" },
    ]);
    expect(result.availableFeatures).toEqual(["other-feature"]);
    expect(result.warnings.some((w) => w.includes("only CLAUDE.md-level context"))).toBe(true);
  });

  it("returns PARTIAL with both ADRs and CLAUDE.md, ADR entries sorted by filename", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      features: { "other-feature": ["discover"] },
      adrFiles: [
        "docs/product/architecture/ADR-002-bar.md",
        "docs/product/architecture/ADR-001-foo.md",
      ],
      claudeMdPath: "CLAUDE.md",
    };

    const result = classifyStructure(snapshot, "ab-mcp");

    expect(result.outcome).toBe("PARTIAL");
    expect(result.filesToRead).toEqual([
      { sourceFile: "docs/product/architecture/ADR-001-foo.md", phase: "architecture" },
      { sourceFile: "docs/product/architecture/ADR-002-bar.md", phase: "architecture" },
      { sourceFile: "CLAUDE.md", phase: "claude-md" },
    ]);
    expect(result.warnings.some((w) => w.includes("no feature-level wave-decisions.md"))).toBe(true);
  });
});

describe("classifyRepoForListFeatures", () => {
  it("returns isNoNwaveStructure for an empty snapshot", () => {
    const result = classifyRepoForListFeatures(baseSnapshot);

    expect(result).toEqual({
      features: [],
      hasArchitectureAdrs: false,
      hasClaudeMd: false,
      isNoNwaveStructure: true,
    });
  });

  it("returns features list for a full-structure snapshot", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      features: { "ab-mcp": ["discover", "design"] },
    };

    const result = classifyRepoForListFeatures(snapshot);

    expect(result).toEqual({
      features: [{ featureId: "ab-mcp", phases: ["discover", "design"] }],
      hasArchitectureAdrs: false,
      hasClaudeMd: false,
      isNoNwaveStructure: false,
    });
  });

  it("returns hasArchitectureAdrs true for an ADRs-only snapshot", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      adrFiles: ["docs/product/architecture/ADR-001-foo.md"],
    };

    const result = classifyRepoForListFeatures(snapshot);

    expect(result).toEqual({
      features: [],
      hasArchitectureAdrs: true,
      hasClaudeMd: false,
      isNoNwaveStructure: false,
    });
  });

  it("returns hasClaudeMd true for a CLAUDE.md-only snapshot", () => {
    const snapshot: TreeSnapshot = {
      ...baseSnapshot,
      claudeMdPath: "CLAUDE.md",
    };

    const result = classifyRepoForListFeatures(snapshot);

    expect(result).toEqual({
      features: [],
      hasArchitectureAdrs: false,
      hasClaudeMd: true,
      isNoNwaveStructure: false,
    });
  });
});
