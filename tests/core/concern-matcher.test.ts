import { describe, it, expect } from "vitest";
import {
  validateConcern,
  matchConcernInSnapshot,
  detectRejectedPaths,
  extractHeadingAnchoredSnippet,
  type ConcernScanInput,
} from "../../src/core/concern-matcher.js";

// ---------------------------------------------------------------------------
// capSnippetAtHeadingBoundary (exercised indirectly through matchConcernInSnapshot,
// which is the public driving port -- the feature-level snippet field is capped
// at SNIPPET_MAX_CHARS = 8000 with heading-boundary truncation)
// ---------------------------------------------------------------------------

describe("capSnippetAtHeadingBoundary (via matchConcernInSnapshot)", () => {
  it("truncates at the last heading boundary before the 8000-char limit, dropping content after it", () => {
    // Build content where a heading appears shortly before the 8000-char cutoff,
    // so the truncation logic finds "\n#" within the truncated slice and cuts there.
    const filler = "auth detail line that repeats to pad content out long enough.\n".repeat(200);
    const beforeHeading = filler.slice(0, 7900);
    const content = `${beforeHeading}\n# Trailing Heading\nThis text must be dropped because it is past the heading boundary used for truncation.`;

    const result = matchConcernInSnapshot({
      concern: "auth",
      repoName: "test-repo",
      docPath: "/tmp/test-repo/docs",
      featureFiles: [{ sourceFile: "docs/feature/auth/design/wave-decisions.md", phase: "design", content }],
      adrFiles: [],
      claudeMdFile: null,
      featureDirectoryNames: [],
    });

    expect(result.matches).toHaveLength(1);
    const snippet = result.matches[0]!.snippet;
    expect(snippet.length).toBeLessThan(content.length);
    expect(snippet).not.toContain("This text must be dropped");
    expect(result.truncationWarnings).toHaveLength(1);
    expect(result.truncationWarnings[0]).toContain("8000 chars");
  });

  it("truncates at the raw 8000-char cutoff when no heading boundary is found before it", () => {
    // No "\n#" markers at all -- capSnippetAtHeadingBoundary falls back to the
    // raw slice(0, maxChars) rather than searching for a heading.
    const content = "auth content with no headings at all. ".repeat(400);
    expect(content.length).toBeGreaterThan(8000);

    const result = matchConcernInSnapshot({
      concern: "auth",
      repoName: "test-repo",
      docPath: "/tmp/test-repo/docs",
      featureFiles: [{ sourceFile: "docs/feature/auth/design/wave-decisions.md", phase: "design", content }],
      adrFiles: [],
      claudeMdFile: null,
      featureDirectoryNames: [],
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.snippet.length).toBe(8000);
    expect(result.truncationWarnings).toHaveLength(1);
  });

  it("does not truncate or warn when content is shorter than the 8000-char limit", () => {
    const content = "Short auth content well under the limit.";

    const result = matchConcernInSnapshot({
      concern: "auth",
      repoName: "test-repo",
      docPath: "/tmp/test-repo/docs",
      featureFiles: [{ sourceFile: "docs/feature/auth/design/wave-decisions.md", phase: "design", content }],
      adrFiles: [],
      claudeMdFile: null,
      featureDirectoryNames: [],
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.snippet).toBe(content);
    expect(result.truncationWarnings).toHaveLength(0);
  });
});

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

  it("excludes a top-level title heading's section when the concern only matches a nested subsection", () => {
    const content = [
      "# Wave Decisions -- DESIGN (platform)",
      "",
      "## D-1: deployment target",
      "",
      "We deploy via Docker Compose on a single host.",
      "",
      "## D-2: logging format",
      "",
      "We emit structured JSON logs to stdout for logging consistency.",
      "",
      "## D-3: monitoring",
      "",
      "We use Prometheus for metrics collection.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "logging");

    expect(result).not.toBeNull();
    expect(result).toContain("## D-2: logging format");
    expect(result).not.toContain("## D-1: deployment target");
    expect(result).not.toContain("## D-3: monitoring");
    expect(result!.trim().startsWith("# Wave Decisions -- DESIGN (platform)")).toBe(false);
  });

  it("still applies density tie-break among unrelated sibling sections (no ancestor relationship)", () => {
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

  it("keeps an ancestor whose own text genuinely matches, and still applies density among it and its descendant", () => {
    const content = [
      "# ADR-005: Concern Matching Strategy",
      "",
      "We use case-insensitive concern matching across all matching nWave artifacts.",
      "Concern matching is applied uniformly regardless of file type.",
      "",
      "## Alternatives Considered",
      "",
      "Semantic concern matching via embeddings was considered and rejected.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "concern matching");

    // The H1's own text (3 occurrences) out-densities the H2 descendant's own
    // text (1 occurrence) -- the ancestor is NOT excluded because it has a
    // genuine own-text match, and correctly wins the density comparison.
    expect(result).not.toBeNull();
    expect(result).toContain("# ADR-005: Concern Matching Strategy");
  });

  it("does not treat a '#' that is not at the start of a line as a heading", () => {
    // HEADING_PATTERN is anchored with ^ -- a line like "See note #1 about auth"
    // must NOT be detected as a heading. Without the heading anchor, partitioning
    // would behave differently and the concern match would not be heading-anchored.
    const content = [
      "## D-1: auth strategy",
      "",
      "See note #1 about auth tokens below for details on auth implementation.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth");

    expect(result).not.toBeNull();
    expect(result).toContain("## D-1: auth strategy");
    expect(result).toContain("See note #1 about auth tokens");
  });

  it("uses '\\n' (not empty string) to rejoin section lines, preserving line breaks", () => {
    const content = [
      "## D-1: auth strategy",
      "Line one about auth.",
      "Line two about auth.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth");

    expect(result).not.toBeNull();
    // If join("") were used instead of join("\n"), these lines would be
    // concatenated without a newline between them.
    expect(result).toContain("strategy\nLine one about auth.");
  });

  it("treats equal-level sibling headings as ending the current section (not just strictly deeper headings)", () => {
    const content = [
      "## D-1: auth strategy",
      "",
      "auth detail one.",
      "",
      "## D-2: auth followup",
      "",
      "auth detail two: this must not appear in D-1's section.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth detail one");

    expect(result).not.toBeNull();
    expect(result).toContain("## D-1: auth strategy");
    expect(result).not.toContain("D-2");
    expect(result).not.toContain("detail two");
  });

  it("does not treat a deeper-level next heading as ending the section when an even deeper or equal heading later closes it", () => {
    // Section end is determined by the FIRST heading at <= current level,
    // skipping over deeper child headings in between.
    const content = [
      "## D-1: auth strategy",
      "",
      "auth top-level text.",
      "",
      "### D-1a: auth detail child",
      "",
      "auth nested detail.",
      "",
      "## D-2: unrelated",
      "",
      "Not about auth.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth");

    expect(result).not.toBeNull();
    expect(result).toContain("### D-1a: auth detail child");
    expect(result).not.toContain("D-2");
  });

  it("returns null when content has no headings at all (zero sections)", () => {
    const result = extractHeadingAnchoredSnippet("", "auth");
    expect(result).toBeNull();
  });

  it("treats two equally-dense matching sections as a tie, deterministically picking one consistently", () => {
    const content = [
      "## D-1: auth alpha",
      "",
      "auth appears once here.",
      "",
      "## D-2: auth beta",
      "",
      "auth appears once here too.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth");

    // Both sections have exactly 1 occurrence (in heading + body counted via text).
    // The reduce-based density pick must consistently resolve ties without
    // crashing or returning null.
    expect(result).not.toBeNull();
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
    expect(result).toEqual({ valid: false, reason: "Concern must not be empty." });
  });

  it("returns invalid for a whitespace-only string", () => {
    const result = validateConcern("   ");
    expect(result).toEqual({ valid: false, reason: "Concern must not be empty." });
  });

  it("returns invalid for a string with no alphanumeric characters", () => {
    const result = validateConcern("???");
    expect(result).toEqual({
      valid: false,
      reason: "Concern must contain at least one alphanumeric character.",
    });
  });

  it("trims surrounding whitespace before validating, so a padded valid concern passes", () => {
    const result = validateConcern("  auth  ");
    expect(result).toEqual({ valid: true });
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

  it("does not truncate a rejected paragraph that is exactly at the 1500-char limit", () => {
    // content.length <= maxChars boundary: exactly 1500 chars must NOT be truncated.
    const padding = "x".repeat(1500 - "auth rejected: ".length);
    const exactLengthText = `auth rejected: ${padding}`;
    expect(exactLengthText.length).toBe(1500);

    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", exactLengthText, "auth");
    expect(result.length).toBe(1);
    expect(result[0].snippet).toBe(exactLengthText);
    expect(result[0].snippet.length).toBe(1500);
  });

  it("truncates a rejected paragraph at a heading boundary when one exists before the limit", () => {
    const beforeHeading = `auth rejected: ${"reason text repeated for padding. ".repeat(40)}`;
    const longTextWithHeading = `${beforeHeading}\n# Unrelated Heading\n${"more text that must be dropped. ".repeat(20)}`;
    expect(longTextWithHeading.length).toBeGreaterThan(1500);

    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", longTextWithHeading, "auth");
    expect(result.length).toBe(1);
    expect(result[0].snippet).not.toContain("Unrelated Heading");
    expect(result[0].snippet.length).toBeLessThan(longTextWithHeading.length);
  });

  it("attaches the exact phase string passed in to the resulting RejectedPath context (via matchConcernInSnapshot)", () => {
    // detectRejectedPaths takes a `phase` parameter that is currently unused in the
    // RejectedPath shape itself, but it is threaded through call sites in
    // matchConcernInSnapshot with literal "architecture" / "repo-conventions" strings.
    // Exercise both call sites end-to-end to pin those literals.
    const adrContent = "auth approach rejected: too complex, not chosen.";
    const claudeContent = "auth approach rejected: too complex, not chosen.";

    const adrResult = matchConcernInSnapshot({
      concern: "auth",
      repoName: "my-repo",
      docPath: "/tmp/my-repo/docs",
      featureFiles: [],
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-001.md", content: adrContent }],
      claudeMdFile: null,
      featureDirectoryNames: [],
    });
    expect(adrResult.rejectedPaths).toHaveLength(1);
    expect(adrResult.rejectedPaths[0]).toMatchObject({ sourceFile: "docs/product/architecture/ADR-001.md" });

    const claudeResult = matchConcernInSnapshot({
      concern: "auth",
      repoName: "my-repo",
      docPath: "/tmp/my-repo/docs",
      featureFiles: [],
      adrFiles: [],
      claudeMdFile: { sourceFile: "CLAUDE.md", content: claudeContent },
      featureDirectoryNames: [],
    });
    expect(claudeResult.rejectedPaths).toHaveLength(1);
    expect(claudeResult.rejectedPaths[0]).toMatchObject({ sourceFile: "CLAUDE.md" });
  });
});

// ---------------------------------------------------------------------------
// splitIntoParagraphs (exercised indirectly through detectRejectedPaths)
// ---------------------------------------------------------------------------

describe("splitIntoParagraphs (via detectRejectedPaths)", () => {
  it("drops paragraphs that are blank or whitespace-only between real paragraphs", () => {
    const content = "auth rejected: too complex.\n\n   \n\nFinal decision stands.";
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result.length).toBe(1);
    expect(result[0].snippet.trim().length).toBeGreaterThan(0);
  });

  it("splits on a single blank line as well as multiple consecutive blank lines", () => {
    const content = "Session-based auth was considered.\nStill one paragraph here.\n\nJWT auth approach rejected: adds complexity.";
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result.length).toBe(1);
    expect(result[0].snippet).toContain("rejected");
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
    expect(result.truncationWarnings).toEqual([]);
  });

  it("truncates and warns when ADR content exceeds the 8000-char limit", () => {
    const content = "auth strategy details repeated for length. ".repeat(300);
    expect(content.length).toBeGreaterThan(8000);

    const result = matchConcernInSnapshot(makeBaseInput({
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-007.md", content }],
    }));

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.snippet.length).toBeLessThan(content.length);
    expect(result.truncationWarnings).toHaveLength(1);
    expect(result.truncationWarnings[0]).toBe("docs/product/architecture/ADR-007.md was truncated to 8000 chars");
  });

  it("does not warn when ADR content is within the 8000-char limit", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-007.md", content: "We selected JWT for auth." }],
    }));
    expect(result.matches).toHaveLength(1);
    expect(result.truncationWarnings).toHaveLength(0);
  });

  it("truncates and warns when CLAUDE.md content exceeds the 8000-char limit", () => {
    const content = "auth conventions repeated for length to exceed the cap. ".repeat(250);
    expect(content.length).toBeGreaterThan(8000);

    const result = matchConcernInSnapshot(makeBaseInput({
      claudeMdFile: { sourceFile: "CLAUDE.md", content },
    }));

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.snippet.length).toBeLessThan(content.length);
    expect(result.truncationWarnings).toHaveLength(1);
    expect(result.truncationWarnings[0]).toBe("CLAUDE.md was truncated to 8000 chars");
  });

  it("does not warn when CLAUDE.md content is within the 8000-char limit", () => {
    const result = matchConcernInSnapshot(makeBaseInput({
      claudeMdFile: { sourceFile: "CLAUDE.md", content: "All endpoints require auth via JWT." },
    }));
    expect(result.matches).toHaveLength(1);
    expect(result.truncationWarnings).toHaveLength(0);
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
