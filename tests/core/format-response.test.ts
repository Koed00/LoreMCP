import { describe, it, expect } from "vitest";
import {
  formatRepoNotConfigured,
  formatRepoPathNotFound,
  formatFeatureNotFound,
  formatNoNwaveStructure,
  formatQueryContextResponse,
  formatListFeaturesResponse,
  formatInvalidConcern,
  formatConcernNotFound,
  formatResolveConcernResponse,
  formatListConcernsResponse,
} from "../../src/core/format-response.js";
import type { ClassifyResult, ListFeaturesResult } from "../../src/core/classify-structure.js";

describe("formatRepoNotConfigured", () => {
  it("shapes a REPO_NOT_CONFIGURED error mentioning the repo name", () => {
    const result = formatRepoNotConfigured("unknown-repo", ["repo-a", "repo-b"]);

    expect(result).toEqual({
      error: "REPO_NOT_CONFIGURED",
      repoName: "unknown-repo",
      message: expect.stringContaining("unknown-repo"),
      availableRepos: ["repo-a", "repo-b"],
    });
    expect(result.message.toLowerCase()).toContain("not configured");
  });
});

describe("formatRepoPathNotFound", () => {
  it("shapes a REPO_PATH_NOT_FOUND error mentioning the configured path", () => {
    const result = formatRepoPathNotFound("repo-a", "/srv/repo-a/docs", ["repo-a", "repo-b"]);

    expect(result).toEqual({
      error: "REPO_PATH_NOT_FOUND",
      repoName: "repo-a",
      configuredPath: "/srv/repo-a/docs",
      message: expect.stringContaining("/srv/repo-a/docs"),
      availableRepos: ["repo-a", "repo-b"],
    });
  });
});

describe("formatFeatureNotFound", () => {
  it("shapes a FEATURE_NOT_FOUND error mentioning the requested feature id", () => {
    const result = formatFeatureNotFound("repo-a", "missing-feature", ["feature-x", "feature-y"]);

    expect(result).toEqual({
      error: "FEATURE_NOT_FOUND",
      repoName: "repo-a",
      featureId: "missing-feature",
      message: expect.stringContaining("missing-feature"),
      availableFeatures: ["feature-x", "feature-y"],
    });
  });
});

describe("formatNoNwaveStructure", () => {
  it("shapes a NO_NWAVE_STRUCTURE error explaining what nWave docs are required", () => {
    const result = formatNoNwaveStructure("repo-a", "/srv/repo-a/docs");

    expect(result).toEqual({
      error: "NO_NWAVE_STRUCTURE",
      repoName: "repo-a",
      configuredPath: "/srv/repo-a/docs",
      message: expect.any(String),
    });
    expect(result.message).toContain("docs/feature");
    expect(result.message).toContain("docs/product/architecture");
    expect(result.message).toContain("CLAUDE.md");
  });
});

describe("formatQueryContextResponse", () => {
  it("returns a FEATURE_NOT_FOUND error when classification outcome is FEATURE_NOT_FOUND", () => {
    const classified: ClassifyResult = {
      outcome: "FEATURE_NOT_FOUND",
      filesToRead: [],
      warnings: [],
      availableFeatures: ["feature-x", "feature-y"],
    };

    const result = formatQueryContextResponse(
      "repo-a",
      "missing-feature",
      "/srv/repo-a/docs",
      classified,
      new Map(),
    );

    expect(result).toEqual({
      error: "FEATURE_NOT_FOUND",
      repoName: "repo-a",
      featureId: "missing-feature",
      message: expect.stringContaining("missing-feature"),
      availableFeatures: ["feature-x", "feature-y"],
    });
  });

  it("returns a NO_NWAVE_STRUCTURE error when classification outcome is NO_NWAVE_STRUCTURE", () => {
    const classified: ClassifyResult = {
      outcome: "NO_NWAVE_STRUCTURE",
      filesToRead: [],
      warnings: [],
      availableFeatures: [],
    };

    const result = formatQueryContextResponse(
      "repo-a",
      "any-feature",
      "/srv/repo-a/docs",
      classified,
      new Map(),
    );

    expect(result).toEqual({
      error: "NO_NWAVE_STRUCTURE",
      repoName: "repo-a",
      configuredPath: "/srv/repo-a/docs",
      message: expect.any(String),
    });
  });

  it("builds results for FULL outcome with snippets from fileContents, omitting warnings when empty", () => {
    const classified: ClassifyResult = {
      outcome: "FULL",
      filesToRead: [
        { sourceFile: "docs/feature/ab-mcp/discover/wave-decisions.md", phase: "discover" },
        { sourceFile: "docs/product/architecture/adr-001.md", phase: "architecture" },
      ],
      warnings: [],
      availableFeatures: ["ab-mcp"],
    };
    const fileContents = new Map<string, string>([
      ["docs/feature/ab-mcp/discover/wave-decisions.md", "# Discover\nContent A"],
      ["docs/product/architecture/adr-001.md", "# ADR 001\nContent B"],
    ]);

    const result = formatQueryContextResponse(
      "repo-a",
      "ab-mcp",
      "/srv/repo-a/docs",
      classified,
      fileContents,
    );

    expect(result).not.toHaveProperty("error");
    const response = result as Exclude<typeof result, { error: string }>;
    expect(response).toMatchObject({
      repoName: "repo-a",
      featureId: "ab-mcp",
      results: [
        {
          sourceFile: "docs/feature/ab-mcp/discover/wave-decisions.md",
          phase: "discover",
          snippet: "# Discover\nContent A",
        },
        {
          sourceFile: "docs/product/architecture/adr-001.md",
          phase: "architecture",
          snippet: "# ADR 001\nContent B",
        },
      ],
    });
    expect(typeof (response as { retrievedAt: string }).retrievedAt).toBe("string");
    expect(() => new Date((response as { retrievedAt: string }).retrievedAt).toISOString()).not.toThrow();
    expect(response).not.toHaveProperty("warnings");
  });

  it("builds results for PARTIAL outcome and includes classified warnings", () => {
    const classified: ClassifyResult = {
      outcome: "PARTIAL",
      filesToRead: [
        { sourceFile: "docs/product/architecture/adr-002.md", phase: "architecture" },
      ],
      warnings: ["Repo has architecture ADRs but no feature-level wave-decisions.md for the requested feature."],
      availableFeatures: ["other-feature"],
    };
    const fileContents = new Map<string, string>([
      ["docs/product/architecture/adr-002.md", "# ADR 002"],
    ]);

    const result = formatQueryContextResponse(
      "repo-a",
      "missing-feature",
      "/srv/repo-a/docs",
      classified,
      fileContents,
    );

    expect(result).toMatchObject({
      repoName: "repo-a",
      featureId: "missing-feature",
      results: [
        {
          sourceFile: "docs/product/architecture/adr-002.md",
          phase: "architecture",
          snippet: "# ADR 002",
        },
      ],
      warnings: ["Repo has architecture ADRs but no feature-level wave-decisions.md for the requested feature."],
    });
  });

  it("omits a result item and adds a TOCTOU warning when fileContents is missing an entry", () => {
    const classified: ClassifyResult = {
      outcome: "FULL",
      filesToRead: [
        { sourceFile: "docs/feature/ab-mcp/discover/wave-decisions.md", phase: "discover" },
        { sourceFile: "docs/product/architecture/adr-001.md", phase: "architecture" },
      ],
      warnings: [],
      availableFeatures: ["ab-mcp"],
    };
    const fileContents = new Map<string, string>([
      ["docs/feature/ab-mcp/discover/wave-decisions.md", "# Discover\nContent A"],
      // adr-001.md missing -- simulates TOCTOU file removal
    ]);

    const result = formatQueryContextResponse(
      "repo-a",
      "ab-mcp",
      "/srv/repo-a/docs",
      classified,
      fileContents,
    );

    expect(result).toMatchObject({
      results: [
        {
          sourceFile: "docs/feature/ab-mcp/discover/wave-decisions.md",
          phase: "discover",
          snippet: "# Discover\nContent A",
        },
      ],
    });
    const response = result as { warnings?: string[] };
    expect(response.warnings).toBeDefined();
    expect(response.warnings).toContainEqual(
      expect.stringContaining("docs/product/architecture/adr-001.md"),
    );
    expect(response.warnings!.some((warning) => warning.includes("could not be read"))).toBe(true);
  });
});

describe("formatListFeaturesResponse", () => {
  it("returns a NO_NWAVE_STRUCTURE error when classification reports no nWave structure", () => {
    const classified: ListFeaturesResult = {
      features: [],
      hasArchitectureAdrs: false,
      hasClaudeMd: false,
      isNoNwaveStructure: true,
    };

    const result = formatListFeaturesResponse("repo-a", "/srv/repo-a/docs", classified);

    expect(result).toEqual({
      error: "NO_NWAVE_STRUCTURE",
      repoName: "repo-a",
      configuredPath: "/srv/repo-a/docs",
      message: expect.any(String),
    });
  });

  it("shapes a normal ListFeaturesResponse from a classified ListFeaturesResult", () => {
    const classified: ListFeaturesResult = {
      features: [
        { featureId: "ab-mcp", phases: ["discover", "deliver"] },
        { featureId: "other-feature", phases: ["discover"] },
      ],
      hasArchitectureAdrs: true,
      hasClaudeMd: true,
      isNoNwaveStructure: false,
    };

    const result = formatListFeaturesResponse("repo-a", "/srv/repo-a/docs", classified);

    expect(result).toEqual({
      repoName: "repo-a",
      docPath: "/srv/repo-a/docs",
      features: [
        { featureId: "ab-mcp", phases: ["discover", "deliver"] },
        { featureId: "other-feature", phases: ["discover"] },
      ],
      hasArchitectureAdrs: true,
      hasClaudeMd: true,
    });
  });
});

describe("formatInvalidConcern", () => {
  it("includes the literal explanatory message text, not an empty string", () => {
    const result = formatInvalidConcern("???");
    expect(result.message).toBe(
      'Concern "???" is invalid. It must be non-empty and contain at least one alphanumeric character.',
    );
  });
});

describe("formatConcernNotFound", () => {
  it("includes the literal explanatory message text, not an empty string", () => {
    const result = formatConcernNotFound("auth", ["repo-a"], []);
    expect(result.message).toBe(
      'No nWave artifacts mentioning "auth" were found across the searched repos.',
    );
  });

  it("omits the warnings field entirely when skipWarnings is empty", () => {
    const result = formatConcernNotFound("auth", ["repo-a"], []);
    expect(result).not.toHaveProperty("warnings");
  });

  it("includes the warnings field with the exact skipWarnings content when non-empty", () => {
    const result = formatConcernNotFound("auth", ["repo-a"], ["repo-b was skipped: permission denied"]);
    expect(result.warnings).toEqual(["repo-b was skipped: permission denied"]);
  });
});

describe("formatResolveConcernResponse", () => {
  it("does not add the partial-structure warning when at least one match is feature-level, even alongside non-feature-level matches", () => {
    // Mixed relevances: one feature-level, one architecture-level. `some` should
    // find the feature-level match and suppress the warning. A mutant changing
    // `some` to `every` would incorrectly require ALL matches to be feature-level,
    // flipping hasFeatureLevelMatch to false and adding the warning -- this test
    // would then fail because warnings would be defined.
    const matches = [
      { repoName: "repo-a", sourceFile: "docs/feature/auth/design/wave-decisions.md", phase: "design", snippet: "auth tokens", relevance: "feature-level" as const },
      { repoName: "repo-a", sourceFile: "docs/product/architecture/ADR-001.md", phase: "architecture", snippet: "auth strategy", relevance: "architecture-level" as const },
    ];
    const result = formatResolveConcernResponse("auth", matches, [], []);
    expect(result.warnings).toBeUndefined();
  });
});

describe("formatListConcernsResponse", () => {
  it("shapes a response with concerns and searchedRepos, omitting warnings when empty", () => {
    const result = formatListConcernsResponse(["auth", "caching"], ["repo-a", "repo-b"], []);

    expect(result).toEqual({
      concerns: ["auth", "caching"],
      searchedRepos: ["repo-a", "repo-b"],
    });
    expect(result).not.toHaveProperty("warnings");
  });

  it("includes the warnings field with the exact content when non-empty", () => {
    const result = formatListConcernsResponse(
      ["auth"],
      ["repo-a"],
      ["repo-b was skipped: permission denied"],
    );

    expect(result).toEqual({
      concerns: ["auth"],
      searchedRepos: ["repo-a"],
      warnings: ["repo-b was skipped: permission denied"],
    });
  });

  it("returns an empty concerns array unmodified when no concerns are found", () => {
    const result = formatListConcernsResponse([], ["repo-a"], []);
    expect(result.concerns).toEqual([]);
    expect(result.searchedRepos).toEqual(["repo-a"]);
  });
});
