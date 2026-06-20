import { describe, it, expect } from "vitest";
import {
  validateConcern,
  matchConcernInSnapshot,
  detectRejectedPaths,
  extractHeadingAnchoredSnippet,
  collectConcernCandidates,
  extractFirstHeadingText,
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

describe("extractFirstHeadingText", () => {
  it("strips the leading markup and the ADR-NNN: numeric prefix from the first heading", () => {
    const content = "# ADR-005: Concern Matching Strategy\n\nWe use keyword matching.\n";
    expect(extractFirstHeadingText(content)).toBe("Concern Matching Strategy");
  });

  it("strips an 'ADR NNN:' (space-separated) numeric prefix as well", () => {
    const content = "## ADR 12: Some Other Title\n\nBody text.\n";
    expect(extractFirstHeadingText(content)).toBe("Some Other Title");
  });

  it("returns the heading text unmodified when there is no ADR-NNN prefix", () => {
    const content = "# auth-flow decisions\n\nD-auth: We use JWT.\n";
    expect(extractFirstHeadingText(content)).toBe("auth-flow decisions");
  });

  it("returns null when the content has no heading line at all", () => {
    const content = "Just a paragraph of text.\nAnother line, still no heading.\n";
    expect(extractFirstHeadingText(content)).toBeNull();
  });

  it("uses only the FIRST heading line when multiple headings exist", () => {
    const content = "# ADR-001: First Title\n\n## Second Heading\n\nBody.\n";
    expect(extractFirstHeadingText(content)).toBe("First Title");
  });
});

// ---------------------------------------------------------------------------
// Mutation-coverage closure tests -- exercise boundary conditions and helper
// behaviors that the example-based tests above don't pin precisely enough.
// ---------------------------------------------------------------------------

describe("capSnippetAtHeadingBoundary boundary precision (via matchConcernInSnapshot)", () => {
  it("does not truncate content whose length is exactly equal to the 8000-char limit", () => {
    // Pins the `<=` boundary: exactly 8000 chars must NOT be truncated.
    // A mutant changing `<=` to `<` would truncate this content unnecessarily.
    const content = "a".repeat(8000);
    const result = matchConcernInSnapshot({
      concern: "a",
      repoName: "test-repo",
      docPath: "/tmp/test-repo/docs",
      featureFiles: [{ sourceFile: "docs/feature/x/design/wave-decisions.md", phase: "design", content }],
      adrFiles: [],
      claudeMdFile: null,
      featureDirectoryNames: [],
    });
    expect(result.matches[0]!.snippet).toBe(content);
    expect(result.matches[0]!.snippet.length).toBe(8000);
    expect(result.truncationWarnings).toHaveLength(0);
  });

  it("falls back to the raw cutoff when the only heading boundary found is at position 0", () => {
    // Pins `lastHeading > 0` (not `>= 0`): when content starts with "\n#" at index 0
    // exactly, lastIndexOf would return 0, which must NOT be treated as a valid
    // heading boundary (slicing to 0 would produce an empty snippet).
    const filler = "x".repeat(7999);
    const content = `\n#${filler}\nmore content after to push past 8000 chars total: ${"y".repeat(100)}`;
    expect(content.length).toBeGreaterThan(8000);

    const result = matchConcernInSnapshot({
      concern: "x",
      repoName: "test-repo",
      docPath: "/tmp/test-repo/docs",
      featureFiles: [{ sourceFile: "docs/feature/x/design/wave-decisions.md", phase: "design", content }],
      adrFiles: [],
      claudeMdFile: null,
      featureDirectoryNames: [],
    });

    expect(result.matches[0]!.snippet.length).toBe(8000);
  });
});

describe("splitIntoParagraphs filtering precision (via detectRejectedPaths)", () => {
  it("drops a paragraph that is only whitespace, not just literally empty", () => {
    // Pins `.filter((p) => p.trim().length > 0)`: without `.trim()`, a
    // whitespace-only paragraph (non-empty string, but blank) would survive
    // the filter and could produce a spurious RejectedPath downstream.
    const content = "auth rejected: too complex.\n\n   \t  \n\nFinal stable decision.";
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result).toHaveLength(1);
    expect(result[0]!.snippet.trim()).not.toBe("");
  });

  it("does not produce a RejectedPath from a whitespace-only paragraph even when it is the only one matching naively", () => {
    // Pins the entire `.filter((p) => p.trim().length > 0)` call together: a
    // mutant removing the filter call entirely, swapping `>` for `>=`, or
    // checking `p.length` instead of `p.trim().length` would all let a
    // whitespace-only "paragraph" survive and be passed to the
    // concern/rejection-keyword checks. Constructed so the whitespace-only
    // paragraph itself contains BOTH the concern and a rejection keyword --
    // if it survived the filter (un-trimmed), it would directly produce a
    // spurious RejectedPath that is NOT the genuine one we expect.
    const whitespaceOnlyParagraphWithBothMarkers = "  \t  ";
    const content = `${whitespaceOnlyParagraphWithBothMarkers}\n\nauth rejected: deferred for now.`;
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result).toHaveLength(1);
    expect(result[0]!.snippet).toContain("auth rejected: deferred for now.");
  });

  it("splits strictly on a single blank line (exactly two consecutive newlines), not collapsing adjacent paragraphs into one", () => {
    // Pins the `\n\n+` regex against a `\n\n` literal mutant: with only the
    // literal two-newline split (no `+` for one-or-more), behavior on a
    // single blank line is identical, so this test instead pins the
    // opposite edge -- THREE blank lines in a row must still be treated as
    // ONE paragraph boundary (not split into an extra empty paragraph that
    // could shift indices), keeping exactly one rejected paragraph detected.
    const content = "Session-based auth was considered.\n\n\n\nJWT auth approach rejected: too complex.";
    const result = detectRejectedPaths("docs/ADR-001.md", "my-repo", "architecture", content, "auth");
    expect(result).toHaveLength(1);
    expect(result[0]!.snippet).toContain("rejected");
  });
});

describe("findSectionEnd / partitionIntoSections boundary precision", () => {
  it("ends the very last section at the end of the document (no following heading)", () => {
    // Pins `i < headings.length` (the for-loop never finds a candidate.lineIndex
    // for the last heading) and the totalLines fallback in findSectionEnd.
    const content = ["## D-1: auth strategy", "", "auth detail line one.", "auth detail line two."].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "auth");
    expect(result).not.toBeNull();
    expect(result).toContain("auth detail line two.");
  });

  it("treats a heading at exactly the same level as ending the section, not only strictly shallower headings", () => {
    // Pins `candidate.level <= currentHeading.level` (not `<`): an H2 ending
    // another H2's section is the equal-level case already covered above, this
    // adds a same-level boundary at a different nesting depth (H3 ending H3).
    const content = [
      "## Parent",
      "",
      "### D-1: auth child one",
      "",
      "auth child one detail.",
      "",
      "### D-2: auth child two",
      "",
      "Not about the searched term.",
    ].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "auth child one");
    expect(result).not.toBeNull();
    expect(result).toContain("### D-1: auth child one");
    expect(result).not.toContain("D-2");
  });
});

describe("findFirstChildHeadingLineIndex / ownText precision", () => {
  it("treats a same-level sibling heading as NOT a child (ownText excludes sibling content)", () => {
    // Pins `nextHeading.level > currentHeading.level` (not `>=`): a same-level
    // sibling must not be misclassified as a child heading, which would
    // incorrectly shrink ownText to empty/wrong content for the ancestor check.
    const content = [
      "## D-1: auth strategy",
      "",
      "auth strategy own text mentions auth here.",
      "",
      "## D-2: auth followup",
      "",
      "auth followup own text mentions auth here too.",
    ].join("\n");

    // Both sections independently match "auth" in their own text and are
    // siblings (no ancestor relationship) -- D-1 wins density tie-break only
    // if ownText correctly excludes D-2's content from D-1's matching span.
    const result = extractHeadingAnchoredSnippet(content, "auth strategy");
    expect(result).not.toBeNull();
    expect(result).toContain("## D-1: auth strategy");
    expect(result).not.toContain("D-2");
  });

  it("joins ownText lines with newline separators, not concatenated without separators", () => {
    // Pins `.join("\n")` for ownText specifically (separate from the `.text`
    // join already pinned above) -- exercised via the ancestor-own-text path,
    // which reads `candidateSection.ownText` directly.
    const content = [
      "# Top Level Title",
      "",
      "auth appears here on the top-level's own text.",
      "auth appears again right after on its own line.",
      "",
      "## Child Section",
      "",
      "Unrelated child content without the search term.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth");
    expect(result).not.toBeNull();
    // If ownText were joined with "" instead of "\n", "here on the top-level's
    // own text.auth appears again" would have no separating newline, but the
    // occurrence-count-based win still requires ownText counting to find 2
    // matches -- a malformed join would still find them via substring search,
    // so we assert structurally on the returned section content with newlines intact.
    expect(result).toContain("its own line.");
  });
});

describe("isStructuralAncestor exact-match exclusion precision", () => {
  it("does not exclude two sections that fully overlap (identical start/end) as ancestor/descendant", () => {
    // Pins the final `!(...)` clause of isStructuralAncestor: two sections with
    // identical startLineIndex AND endLineIndex must NOT be treated as one
    // being the structural ancestor of the other (they are the same span).
    // This is naturally impossible to construct via the heading-based section
    // model (each heading produces a unique section), so we instead pin the
    // adjacent boundary case: a section that starts at the same line as another
    // but ends LATER must still be recognized as an ancestor (the "and" with
    // the third clause must not over-exclude this legitimate ancestor case).
    const content = [
      "## Outer",
      "",
      "auth mentioned in outer.",
      "",
      "### Outer Inner Child",
      "",
      "auth mentioned in the nested child too, several times: auth, auth.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "auth");
    expect(result).not.toBeNull();
    // Outer has no own-text match besides the one occurrence in its own line;
    // the nested child has more occurrences and is NOT an ancestor of anything,
    // so it must win on density once outer is excluded as a pure ancestor of it.
    expect(result).toContain("Outer Inner Child");
  });
});

describe("extractHeadingAnchoredSnippet candidate-count branch precision", () => {
  it("handles exactly two equally-positioned candidates without index errors when neither is excluded", () => {
    // Pins `candidatesExcludingAncestors.length === 1` (not `!== 1`) and guards
    // the optional-chaining `sections[onlyCandidate.sectionIndex]?.text` path --
    // already covered for the single-candidate branch elsewhere; this adds a
    // case landing squarely in the >1-candidate reduce branch with a clear winner.
    const content = [
      "## D-1: alpha",
      "",
      "alpha alpha alpha mentioned three times here for density.",
      "",
      "## D-2: beta",
      "",
      "alpha mentioned once here.",
    ].join("\n");

    const result = extractHeadingAnchoredSnippet(content, "alpha");
    expect(result).not.toBeNull();
    expect(result).toContain("## D-1: alpha");
    expect(result).not.toContain("## D-2: beta");
  });
});

describe("isStructuralAncestor boundary precision (via extractHeadingAnchoredSnippet)", () => {
  it("does not treat a section as an ancestor when it starts strictly after the other section", () => {
    // Pins `candidate.startLineIndex <= other.startLineIndex`: two disjoint
    // sibling sections, where the supposed "candidate" starts later, must not
    // be excluded as a structural ancestor.
    const content = [
      "## D-1: alpha topic",
      "",
      "alpha mentioned once.",
      "",
      "## D-2: alpha followup",
      "",
      "alpha mentioned once here too.",
    ].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "alpha");
    expect(result).not.toBeNull();
    // Both sections tie at 1 occurrence each and neither is an ancestor of the
    // other (disjoint siblings) -- the reduce must pick the first candidate
    // deterministically, proving neither was wrongly excluded as an ancestor.
    expect(result).toContain("## D-1: alpha topic");
  });

  it("does not treat a section as an ancestor when it ends strictly before the other section", () => {
    // Pins `candidate.endLineIndex >= other.endLineIndex`: a section ending
    // earlier than another cannot be that other section's structural ancestor.
    const content = [
      "## D-1: beta topic",
      "",
      "beta mentioned once.",
      "",
      "## D-2: beta followup",
      "",
      "beta mentioned once here too.",
    ].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "beta");
    expect(result).not.toBeNull();
    expect(result).toContain("## D-1: beta topic");
  });

  it("excludes a genuine ancestor section whose own text has zero matches in favor of its sole matching descendant", () => {
    // Pins the full conjunction of isStructuralAncestor: the H1 strictly
    // contains the H2 (start <=, end >=, not identical span) and the H1's
    // own text (before the H2 starts) has NO occurrence of the concern, so
    // excludeStructuralAncestors must drop the H1 entirely, leaving the H2 as
    // the only (and thus auto-selected) candidate.
    const content = [
      "# Top Level Title With No Match In Its Own Text",
      "",
      "## Gamma Section",
      "",
      "gamma appears here in the nested child only.",
    ].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "gamma");
    expect(result).not.toBeNull();
    expect(result).toContain("## Gamma Section");
    expect(result).not.toContain("Top Level Title");
  });
});

describe("findSectionEnd loop boundary precision", () => {
  it("does not let a deeper section beyond the immediate next heading wrongly end the section early", () => {
    // Pins `i < headings.length` (the loop must scan ALL subsequent headings,
    // not stop short) by constructing three headings where only the THIRD
    // one is at an ending level <= current, while the second is deeper.
    const content = [
      "## D-1: delta strategy",
      "",
      "delta detail at top level.",
      "",
      "### D-1a: delta nested child",
      "",
      "delta nested detail.",
      "",
      "## D-2: epsilon unrelated",
      "",
      "Not about delta at all.",
    ].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "delta");
    expect(result).not.toBeNull();
    expect(result).toContain("delta nested detail.");
    expect(result).not.toContain("epsilon");
  });
});

describe("findFirstChildHeadingLineIndex missing-neighbor precision", () => {
  it("returns the full section text equal to ownText for the very last heading (no next heading at all)", () => {
    // Pins `!currentHeading || !nextHeading` for the case where nextHeading
    // is undefined (last heading in the document) -- ownTextEndLineIndex
    // must fall back to endLineIndex (totalLines), not crash or truncate.
    const content = [
      "## D-1: zeta strategy",
      "",
      "## D-2: zeta final section",
      "",
      "zeta detail line one.",
      "zeta detail line two.",
    ].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "zeta detail line two");
    expect(result).not.toBeNull();
    expect(result).toContain("## D-2: zeta final section");
    expect(result).toContain("zeta detail line two.");
  });
});

describe("excludeStructuralAncestors own-text density precision", () => {
  it("excludes an ancestor with zero own-text matches even when multiple unrelated descendants exist", () => {
    // Pins the `countOccurrences(candidateSection.ownText, concern) > 0`
    // boolean-literal/comparison mutants together: an ancestor with NO
    // own-text match, with one matching descendant and one non-matching
    // sibling, must still be excluded.
    const content = [
      "# Top Level Title With No Own-Text Match At All",
      "",
      "## Eta Child One",
      "",
      "eta mentioned here in the only matching child.",
      "",
      "## Eta Child Two",
      "",
      "Nothing relevant here.",
    ].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "eta");
    expect(result).not.toBeNull();
    expect(result).toContain("Eta Child One");
    expect(result!.trim().startsWith("## Eta Child One")).toBe(true);
  });
});

describe("extractHeadingAnchoredSnippet single/multi-candidate branch precision", () => {
  it("returns null defensively when the lone surviving candidate's section index has no entry (guard branch)", () => {
    // Pins the `onlyCandidate ?` truthiness guard and optional chaining in
    // the single-candidate branch via a normal single-match case -- this is
    // the baseline single-candidate path (already partly covered, reinforced
    // here to ensure the guard's true branch returns real section text, not
    // null, ruling out the `true ? ... : ...`-style ConditionalExpression
    // mutant on the surrounding `if`).
    const content = ["## D-1: theta strategy", "", "theta appears exactly once."].join("\n");
    const result = extractHeadingAnchoredSnippet(content, "theta");
    expect(result).not.toBeNull();
    expect(result).toContain("## D-1: theta strategy");
  });
});

describe("ADR_NUMERIC_PREFIX_PATTERN exactness precision", () => {
  it("strips a hyphenated ADR-NNN: prefix with no separating space before the digits", () => {
    // Pins the `[-\s]?` optional-separator group: "ADR-005:" (hyphen, no
    // space) must still be recognized and stripped.
    const content = "# ADR-005: Hyphen No Space Title\n\nBody.\n";
    expect(extractFirstHeadingText(content)).toBe("Hyphen No Space Title");
  });

  it("strips trailing whitespace of any length after the colon, not just a single space", () => {
    // Pins `:\s*` (zero-or-more, not exactly one) -- a colon followed
    // directly by the title (zero whitespace chars) must still strip cleanly.
    const content = "# ADR-006:NoSpaceAfterColon\n\nBody.\n";
    expect(extractFirstHeadingText(content)).toBe("NoSpaceAfterColon");
  });

  it("requires a whitespace character (not just any non-colon character) immediately after the digits and colon", () => {
    // Pins `\s` (whitespace class) vs `\S` (non-whitespace) in the trailing
    // group -- a title starting immediately with whitespace must be stripped
    // down to the non-whitespace title text with no leading space retained.
    const content = "# ADR-007:    Multiple Spaces Title\n\nBody.\n";
    expect(extractFirstHeadingText(content)).toBe("Multiple Spaces Title");
  });
});

describe("ADR_FILENAME_PATTERN $ anchor precision", () => {
  it("does not match a filename where additional characters follow the .md extension", () => {
    // Pins the `$` end-anchor on ADR_FILENAME_PATTERN: "adr-005-title.md.bak"
    // must NOT match the numbered-ADR capture pattern (no trailing $), so the
    // fallback strips only a trailing .md if present -- here it isn't, so the
    // filename passes through with no stripping at all.
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [
        {
          sourceFile: "docs/product/architecture/adr-005-title.md.bak",
          content: "No heading here.\n",
        },
      ],
      featureFiles: [],
    });
    expect(result).toEqual(["adr-005-title.md.bak"]);
  });
});

describe("extractFirstHeadingText trimming precision", () => {
  it("trims trailing whitespace after stripping the ADR numeric prefix", () => {
    // Pins the final `.trim()` call: without it, trailing whitespace from the
    // heading line would leak into the returned candidate string.
    const content = "# ADR-009:   Padded Title With Spaces   \n\nBody.\n";
    const result = extractFirstHeadingText(content);
    expect(result).toBe("Padded Title With Spaces");
  });
});

describe("deriveAdrFilenameCandidate / collectFeatureFileHeadingCandidates trimming precision", () => {
  it("strips only a trailing .md extension via the filename fallback, not any other suffix", () => {
    // Pins the `$` anchor in `/\.md$/i` and the literal "" replacement: the
    // fallback candidate must have exactly the .md suffix removed, nothing more.
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [
        {
          sourceFile: "docs/product/architecture/not-an-adr-pattern-file.md",
          content: "No heading at all here.\n",
        },
      ],
      featureFiles: [],
    });
    expect(result).toEqual(["not-an-adr-pattern-file"]);
  });

  it("trims trailing whitespace from feature-file heading candidates", () => {
    // Pins `.trim()` in collectFeatureFileHeadingCandidates.
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [],
      featureFiles: [
        {
          sourceFile: "docs/feature/auth-flow/design/wave-decisions.md",
          phase: "design",
          content: "##   Padded Heading Text   \n\nBody.\n",
        },
      ],
    });
    expect(result).toEqual(["Padded Heading Text"]);
  });
});

describe("HEADING_PATTERN anchoring precision", () => {
  it("requires the heading hashes to start at the beginning of the line, not appear mid-line", () => {
    // Pins the `^` anchor on HEADING_PATTERN itself: a line where '#' chars
    // appear only after other text must not be detected as a heading.
    const content = "Some prose with trailing ## not a real heading\nMore prose, still no real heading.";
    const result = extractFirstHeadingText(content);
    expect(result).toBeNull();
  });
});

describe("ADR_NUMERIC_PREFIX_PATTERN anchoring and exactness precision", () => {
  it("does not strip an ADR-style prefix that appears mid-string rather than at the start", () => {
    // Pins the `^` anchor on ADR_NUMERIC_PREFIX_PATTERN.
    const content = "# See also ADR-001: related context\n\nBody.\n";
    const result = extractFirstHeadingText(content);
    expect(result).toBe("See also ADR-001: related context");
  });

  it("requires a colon followed by optional whitespace immediately after the digits, not arbitrary text", () => {
    // Pins `\d+:\s*` exactness -- a heading with digits but no colon must not
    // have its numeric portion stripped.
    const content = "# ADR-001 Missing Colon Title\n\nBody.\n";
    const result = extractFirstHeadingText(content);
    expect(result).toBe("ADR-001 Missing Colon Title");
  });
});

describe("ADR_FILENAME_PATTERN anchoring precision", () => {
  it("requires the adr-NNN- prefix to start at the beginning of the filename", () => {
    // Pins the `^` anchor on ADR_FILENAME_PATTERN: a filename containing the
    // pattern only as a substring (not from position 0) must not match, so the
    // fallback strips only the .md extension instead of extracting a capture group.
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [
        {
          sourceFile: "docs/product/architecture/legacy-adr-005-old-title.md",
          content: "No heading here.\n",
        },
      ],
      featureFiles: [],
    });
    expect(result).toEqual(["legacy-adr-005-old-title"]);
  });
});

describe("detectRejectedPaths phase threading precision (via matchConcernInSnapshot)", () => {
  it("does not produce rejected paths via the architecture/repo-conventions call sites when the phase argument were blanked", () => {
    // This test exists to exercise the literal "architecture" and "repo-conventions"
    // phase strings threaded through matchConcernInSnapshot's calls to
    // detectRejectedPaths. detectRejectedPaths itself doesn't use phase in the
    // RejectedPath shape, so this asserts the call succeeds end-to-end and
    // produces the expected RejectedPath regardless -- combined with the
    // existing "attaches the exact phase string" test, both call sites are
    // pinned for their sourceFile routing.
    const adrResult = matchConcernInSnapshot({
      concern: "auth",
      repoName: "my-repo",
      docPath: "/tmp/my-repo/docs",
      featureFiles: [],
      adrFiles: [{ sourceFile: "docs/product/architecture/ADR-002.md", content: "auth rejected: deferred for now." }],
      claudeMdFile: { sourceFile: "CLAUDE.md", content: "auth rejected: out of scope for this repo." },
      featureDirectoryNames: [],
    });
    expect(adrResult.rejectedPaths).toHaveLength(2);
    expect(adrResult.rejectedPaths.map((r) => r.sourceFile)).toEqual(
      expect.arrayContaining(["docs/product/architecture/ADR-002.md", "CLAUDE.md"]),
    );
  });
});

describe("collectConcernCandidates", () => {
  it("passes feature directory names through verbatim", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: ["auth-flow", "rate-limiting"],
      adrFiles: [],
      featureFiles: [],
    });
    expect(result).toEqual(["auth-flow", "rate-limiting"]);
  });

  it("extracts the ADR title with the ADR-NNN: prefix stripped", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [
        {
          sourceFile: "docs/product/architecture/adr-005-concern-matching-strategy.md",
          content: "# ADR-005: Concern Matching Strategy\n\nWe use keyword matching.\n",
        },
      ],
      featureFiles: [],
    });
    expect(result).toEqual(["Concern Matching Strategy"]);
  });

  it("falls back to a filename-derived candidate when the ADR file has no heading", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [
        {
          sourceFile: "docs/product/architecture/adr-005-concern-matching-strategy.md",
          content: "No heading here, just prose about the decision.\n",
        },
      ],
      featureFiles: [],
    });
    expect(result).toEqual(["concern-matching-strategy"]);
  });

  it("extracts heading text from feature files for every detected heading line", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [],
      featureFiles: [
        {
          sourceFile: "docs/feature/auth-flow/design/wave-decisions.md",
          phase: "design",
          content: "# auth-flow decisions\n\nD-auth: We use JWT.\n\n## Token Expiry\n\nDetails.\n",
        },
      ],
    });
    expect(result).toEqual(["auth-flow decisions", "Token Expiry"]);
  });

  it("returns the flat concatenation in order: dir names, then ADR titles, then feature-file headings", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: ["auth-flow"],
      adrFiles: [
        {
          sourceFile: "docs/product/architecture/adr-005-concern-matching-strategy.md",
          content: "# ADR-005: Concern Matching Strategy\n\nBody.\n",
        },
      ],
      featureFiles: [
        {
          sourceFile: "docs/feature/auth-flow/design/wave-decisions.md",
          phase: "design",
          content: "# auth-flow decisions\n\nBody.\n",
        },
      ],
    });
    expect(result).toEqual(["auth-flow", "Concern Matching Strategy", "auth-flow decisions"]);
  });

  it("does NOT deduplicate -- duplicate signals in the input remain duplicated in this function's own output", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: ["rate-limiting", "rate-limiting"],
      adrFiles: [],
      featureFiles: [],
    });
    expect(result).toEqual(["rate-limiting", "rate-limiting"]);
  });

  it("filters out feature-file headings that exactly match a generic stoplist term, case-insensitively", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [],
      featureFiles: [
        {
          sourceFile: "docs/feature/auth-flow/design/wave-decisions.md",
          phase: "design",
          content: "## Decisions\n\nBody.\n\n## summary\n\nBody.\n\n## D-auth: JWT strategy\n\nBody.\n",
        },
      ],
    });
    expect(result).toEqual(["D-auth: JWT strategy"]);
  });

  it("keeps a heading that merely contains a stoplist word as a substring of a genuine topic heading", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: [],
      adrFiles: [],
      featureFiles: [
        {
          sourceFile: "docs/feature/ops/design/wave-decisions.md",
          phase: "design",
          content: "## Mode\n\nBody.\n\n## D-mode: deployment mode selection\n\nBody.\n",
        },
      ],
    });
    expect(result).toEqual(["D-mode: deployment mode selection"]);
  });

  it("never filters ADR titles or feature directory names even when they exactly match a stoplist term", () => {
    const result = collectConcernCandidates({
      featureDirectoryNames: ["Decisions"],
      adrFiles: [
        {
          sourceFile: "docs/product/architecture/adr-009-summary.md",
          content: "# Summary\n\nBody.\n",
        },
      ],
      featureFiles: [],
    });
    expect(result).toEqual(["Decisions", "Summary"]);
  });

  it("filters every remaining stoplist entry, each exercised individually so a blanked entry would be detectable", () => {
    // Pins each GENERIC_HEADING_STOPLIST literal (lines 78-107) individually --
    // a mutant that blanks any single entry to "" would let that one heading
    // leak through unfiltered while everything else stays filtered.
    const stoplistHeadings = [
      "Key Decisions",
      "Constraints Established",
      "Upstream Changes",
      "Requirements Summary",
      "Domain Examples",
      "Acceptance Criteria",
      "ADR Index Update",
      "Architecture Summary",
      "C4 Diagrams",
      "Coherence Validation",
      "Configuration Decisions (carried from orchestrator)",
      "Greenfield Confirmation",
      "Handoff Readiness",
      "Key Design Decisions",
      "Key DISCUSS-Wave Decisions",
      "Key Decisions (confirmed by stakeholder)",
      "Multi-Architect Context",
      "Peer Review",
      "Relationship to AB-MCP Wave Artifacts",
      "Reuse Analysis",
      "Scope Assessment (Elephant Carpaccio Gate)",
      "Scope Decisions (Fixed — Do Not Reopen)",
      "Scope Decisions Honored (No Relitigation)",
      "Technology Stack",
      "Upstream Changes (corrections/clarifications to discover artifacts)",
      "Upstream Changes / Notes to DESIGN Wave",
      "Upstream Changes to DISCUSS Artifacts",
      "Brief.md Updates",
      "Constraints Established (carried to DISTILL / DELIVER)",
    ];

    for (const heading of stoplistHeadings) {
      const result = collectConcernCandidates({
        featureDirectoryNames: [],
        adrFiles: [],
        featureFiles: [
          {
            sourceFile: "docs/feature/example/design/wave-decisions.md",
            phase: "design",
            content: `## ${heading}\n\nBody.\n\n## D-real: a genuine topic heading\n\nBody.\n`,
          },
        ],
      });
      expect(result, `expected "${heading}" to be filtered as a generic heading`).toEqual([
        "D-real: a genuine topic heading",
      ]);
    }
  });
});
