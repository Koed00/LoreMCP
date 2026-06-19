import { describe, it, expect } from "vitest";
import {
  validateConcern,
  matchConcernInSnapshot,
  detectRejectedPaths,
  extractHeadingAnchoredSnippet,
  type ConcernScanInput,
} from "../../src/core/concern-matcher.js";

// ---------------------------------------------------------------------------
// extractHeadingAnchoredSnippet
// ---------------------------------------------------------------------------

describe("extractHeadingAnchoredSnippet", () => {
  it("returns only the matched section in a multi-section file", () => {
    const content = [
      "## D-1: deployment target",
      "",
      "We deploy via Docker Compose on a single host.",
      "",
      "## D-2: caching layer",
      "",
      "We use Redis for caching session data across requests.",
      "",
      "## D-3: logging format",
      "",
      "We emit structured JSON logs to stdout.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "caching");

    expect(result).not.toBeNull();
    expect(result).toContain("## D-2: caching layer");
    expect(result).not.toContain("## D-1: deployment target");
    expect(result).not.toContain("## D-3: logging format");
  });

  it("returns null for headingless content, signaling caller to fall back", () => {
    const content =
      "All testing uses vitest for unit and integration tests. No headings here.";

    const result = extractHeadingAnchoredSnippet(content, "testing");

    expect(result).toBeNull();
  });

  it("anchors the snippet at a heading when the concern appears only in the heading line", () => {
    const content = [
      "## D-0: unrelated decision",
      "",
      "We chose a monorepo layout for simplicity.",
      "",
      "## D-auth: JWT strategy",
      "",
      "We use signed tokens for session management without mentioning the word here.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth");

    expect(result).not.toBeNull();
    expect(result!.trim().startsWith("## D-auth: JWT strategy")).toBe(true);
  });

  it("resolves to the section with the highest occurrence count when multiple sections match", () => {
    const content = [
      "## D-1: rate-limiting strategy",
      "",
      "rate-limiting is applied at the gateway. rate-limiting uses a token",
      "bucket algorithm. rate-limiting thresholds are configurable per route.",
      "",
      "## D-2: monitoring",
      "",
      "We also reference rate-limiting briefly here for context on alerts.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "rate-limiting");

    expect(result).not.toBeNull();
    expect(result).toContain("## D-1: rate-limiting strategy");
    expect(result).not.toContain("## D-2: monitoring");
  });

  it("returns null when no section contains a match (defensive case)", () => {
    const content = [
      "## D-1: deployment target",
      "",
      "We deploy via Docker Compose on a single host.",
      "",
      "## D-2: logging format",
      "",
      "We emit structured JSON logs to stdout.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "caching");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateConcern
// ---------------------------------------------------------------------------

describe("validateConcern", () => {
  it("returns invalid for an empty string", () => {
    const result = validateConcern("");
    expect(result).toEqual({ valid: false, reason: expect.any(String) });
  });

  it("returns invalid for a whitespace-only string", () => {
    const result = validateConcern("   ");
    expect(result).toEqual({ valid: false, reason: expect.any(String) });
  });

  it("returns invalid for a string with no alphanumeric characters", () => {
    const result = validateConcern("???");
    expect(result).toEqual({ valid: false, reason: expect.any(String) });
  });

  it("returns valid for a simple keyword", () => {
    const result = validateConcern("auth");
    expect(result).toEqual({ valid: true });
  });

  it("returns valid for a hyphenated keyword", () => {
    const result = validateConcern("data-persistence");
    expect(result).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// detectRejectedPaths
// ---------------------------------------------------------------------------

describe("detectRejectedPaths", () => {
  it("returns no RejectedPath when concern is only in a paragraph without rejection keyword", () => {
    const content = `We chose JWT for auth.\n\nRedis was rejected: too complex for caching.\n\nFinal decision stands.`;
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result.length).toBe(0); // "auth" is only in first paragraph which has no rejection keyword
  });

  it("returns a RejectedPath when concern and 'rejected:' appear in the same paragraph", () => {
    const content = `Session-based auth was considered.\n\nJWT auth approach rejected: adds complexity without benefit.\n\nWe chose API keys instead.`;
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      repoName: "my-repo",
      sourceFile: "docs/ADR-001.md",
      type: "rejected_alternative",
    });
    expect(result[0].snippet).toContain("auth");
  });

  it("returns no RejectedPath when paragraph has only the concern but no rejection keyword", () => {
    const content = `We use auth tokens for all API calls.\n\nThe auth system is well-tested.`;
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result.length).toBe(0);
  });

  it("returns no RejectedPath when paragraph has rejection keyword but not the concern", () => {
    const content = `Redis was rejected: we don't need caching yet.\n\nAuth uses JWT.`;
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result.length).toBe(0);
  });

  it("caps the snippet at 1500 characters for long paragraphs", () => {
    const longText = "auth " + "x".repeat(2000) + " out of scope";
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", longText, "auth");
    expect(result.length).toBe(1);
    expect(result[0].snippet.length).toBeLessThanOrEqual(1500);
  });
});

// ---------------------------------------------------------------------------
// matchConcernInSnapshot
// ---------------------------------------------------------------------------

function makeBaseInput(overrides: Partial<ConcernScanInput> = {}): ConcernScanInput {
  return {
    concern: "auth",
    repoName: "test-repo",
    docPath: "/tmp/test-repo/docs",
    featureFiles: [],
    adrFiles: [],
    claudeMdFile: null,
    featureDirectoryNames: [],
    ...overrides,
  };
}

describe("matchConcernInSnapshot", () => {
  it("returns empty result when nothing mentions the concern", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      featureFiles: [{ sourceFile: "docs/feature/payment/design/wave-decisions.md", phase: "design", content: "Payment processing via Stripe." }],
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-001.md", content: "We use PostgreSQL." }],
    }));
    expect(result.matches).toHaveLength(0);
    expect(result.rejectedPaths).toHaveLength(0);
  });

  it("returns feature-level match when feature file content contains concern", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      featureFiles: [{ sourceFile: "docs/feature/auth-flow/design/wave-decisions.md", phase: "design", content: "We use JWT for auth token management." }],
      featureDirectoryNames: ["auth-flow"],
    }));
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].relevance).toBe("feature-level");
    expect(result.matches[0].repoName).toBe("test-repo");
    expect(result.matches[0].sourceFile).toBe("docs/feature/auth-flow/design/wave-decisions.md");
  });

  it("returns feature-level match when feature directory name contains concern", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      featureFiles: [{ sourceFile: "docs/feature/auth-service/design/wave-decisions.md", phase: "design", content: "No keyword here." }],
      featureDirectoryNames: ["auth-service"],
    }));
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].relevance).toBe("feature-level");
  });

  it("returns architecture-level match when ADR content contains concern", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-007-auth.md", content: "We selected JWT for auth." }],
    }));
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].relevance).toBe("architecture-level");
    expect(result.matches[0].phase).toBe("architecture");
  });

  it("returns repo-conventions match when CLAUDE.md content contains concern", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      claudeMdFile: { sourceFile: "CLAUDE.md", content: "All endpoints require auth via JWT." },
    }));
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].relevance).toBe("repo-conventions");
    expect(result.matches[0].phase).toBe("repo-conventions");
  });

  it("orders matches: feature-level first, then architecture-level, then repo-conventions", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      featureFiles: [{ sourceFile: "docs/feature/auth-flow/design/wave-decisions.md", phase: "design", content: "auth tokens" }],
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-007.md", content: "auth strategy" }],
      claudeMdFile: { sourceFile: "CLAUDE.md", content: "auth required" },
      featureDirectoryNames: ["auth-flow"],
    }));
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0].relevance).toBe("feature-level");
    expect(result.matches[1].relevance).toBe("architecture-level");
    expect(result.matches[2].relevance).toBe("repo-conventions");
  });

  it("case-insensitive matching", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      concern: "Auth",
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-007.md", content: "We use auth tokens." }],
    }));
    expect(result.matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// format-response: concern formatters
// ---------------------------------------------------------------------------

describe("formatInvalidConcern (via format-response)", async () => {
  const { formatInvalidConcern } = await import("../../src/core/format-response.js");

  it("returns INVALID_CONCERN error shape", () => {
    const result = formatInvalidConcern("???");
    expect(result.error).toBe("INVALID_CONCERN");
    expect(result.concern).toBe("???");
    expect(result.message).toBeDefined();
    expect(result.retrievedAt).toMatch(/live/i);
  });
});

describe("formatConcernNotFound (via format-response)", async () => {
  const { formatConcernNotFound } = await import("../../src/core/format-response.js");

  it("returns CONCERN_NOT_FOUND shape with searched repos", () => {
    const result = formatConcernNotFound("auth", ["repo-a", "repo-b"], []);
    expect(result.error).toBe("CONCERN_NOT_FOUND");
    expect(result.concern).toBe("auth");
    expect(result.searchedRepos).toEqual(["repo-a", "repo-b"]);
    expect(result.retrievedAt).toMatch(/live/i);
  });
});

describe("formatResolveConcernResponse (via format-response)", async () => {
  const { formatResolveConcernResponse } = await import("../../src/core/format-response.js");

  it("returns success shape with matches and retrieved_at live", () => {
    const matches = [
      { repoName: "repo-a", sourceFile: "docs/feature/auth/design/wave-decisions.md", phase: "design", snippet: "auth tokens", relevance: "feature-level" as const },
    ];
    const result = formatResolveConcernResponse("auth", matches, [], []);
    expect(result.concern).toBe("auth");
    expect(result.matches).toEqual(matches);
    expect(result.retrievedAt).toMatch(/live/i);
    expect(result.warnings).toBeUndefined();
  });

  it("adds partial-structure warning when no feature-level matches", () => {
    const matches = [
      { repoName: "repo-a", sourceFile: "docs/product/architecture/ADR-001.md", phase: "architecture", snippet: "auth strategy", relevance: "architecture-level" as const },
    ];
    const result = formatResolveConcernResponse("auth", matches, [], []);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => /feature/i.test(w))).toBe(true);
  });
});
