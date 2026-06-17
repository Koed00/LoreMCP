# ADR-005: Concern Matching Strategy

## Status
Accepted (DESIGN wave, concern-based-querying feature)

## Context

`resolve_concern(concern: string)` must scan all configured repos and return which files
"match" a concern topic. The agent supplying the concern (e.g., `"auth"`) has no upfront
knowledge of repo names or feature IDs. The matching strategy is the core algorithmic
decision for this tool.

The system already established (ADR-003, D-docquality REVISED) that relevance in
`query_context` is determined **structurally by path convention**, not by content-based
scoring. `resolve_concern` inverts that model: the caller supplies a topic, not a
repo+feature pair, so path-convention alone is insufficient — some content signal is
required to narrow to files that discuss the concern.

Constraints from the existing architecture:
- Matching logic must be a **pure function** in `src/core/` (no fs imports, no network —
  dependency-cruiser enforced, CLAUDE.md paradigm).
- ADR-004 (live reads, no cache) applies; no index may persist across calls.
- Solo maintainer, OSS; complexity must be holdable in one person's head.

## Decision

Use **case-insensitive keyword matching** against:
1. `docs/feature/{featureId}/` **directory names** — if the concern string appears anywhere
   in the directory name (substring match), the feature's nWave files are included as
   candidates regardless of body content.
2. **File content** of every nWave artifact already collected by the shell scan
   (wave-decisions.md / feature-delta.md per phase, ADR files, CLAUDE.md) — if the concern
   string appears anywhere in the file body (case-insensitive substring), the file is a match.

A match against a directory name is sufficient on its own; a match against file content is
sufficient on its own. Both can match the same file, which is fine — the file appears once.

Relevance tier is assigned by the matched file's structural path (same logic as
`classifyStructure`):
- `docs/feature/{featureId}/{phase}/wave-decisions.md` or `feature-delta.md` →
  `"feature-level"`
- `docs/product/architecture/*.md` → `"architecture-level"`
- `CLAUDE.md` → `"repo-conventions"`

Snippet: whole-file content, same size-cap/truncation rules as ADR-003 (8 000-character
default, truncate at last heading boundary before cap, add `warnings` entry).

## Alternatives Considered

### Semantic / Vector Search

Embed concern and document chunks into a vector space; return top-k by cosine similarity.

- Pros: handles synonyms and paraphrasing ("authorisation" matches "auth"); no dependency on
  exact vocabulary.
- Cons: requires an embedding model (local or remote). A local model (e.g., `ollama`) adds a
  runtime dependency and process-management concern that dwarfs the rest of the codebase.
  A remote model violates the "local only, no network" constraint (brief.md Section 3,
  user-stories.md System Constraints). Inconsistent results across machines (model version,
  quantisation) undermine reproducibility. Explicitly scoped out by the orchestrator
  configuration and D-CBQ-match.
- Rejected: network/model dependency, non-reproducibility, and explicit scope exclusion.

### Tag-Based Manifest (Explicit Concern Registry)

Authors annotate each nWave file with YAML frontmatter tags (e.g.,
`concerns: [auth, jwt, security]`). `resolve_concern` reads tags, not body content.

- Pros: zero ambiguity; no false positives from incidental keyword mentions; efficient (only
  read frontmatter).
- Cons: requires authors to maintain the tag manifest — a new human process the solo
  maintainer must sustain across all sibling repos. Any file without tags is invisible to
  `resolve_concern`. Tag vocabulary diverges across repos without a governance mechanism.
  Adds a new failure mode (tag missing → false negative) with no existing mitigation. Not
  consistent with the nWave convention that artifact content is the ground truth.
- Rejected: author-burden and false-negative risk not justified when keyword matching over
  curated small files is sufficient for MVP.

### Explicit Concern Manifest File (Registry Pattern)

A dedicated `lore-mcp.concerns.json` file maps concern keywords to `{repo, feature_id,
file}` triples, maintained by the developer.

- Pros: deterministic; fast; no scanning required at query time.
- Cons: same author-burden problem as tag-based approach, plus the manifest goes stale
  whenever a new wave artifact is added without updating the manifest. Introduces a new
  artifact type outside the nWave convention. The "stale manifest" failure mode is precisely
  what ADR-004 and the live-read architecture were designed to eliminate.
- Rejected: staleness risk directly contradicts the core value proposition (KPI-CBQ-5 /
  ADR-004).

### Heading-Anchored Section Extraction (Content Grep + Context Window)

Search file content for the concern keyword; return N surrounding lines or the enclosing
section (heading-to-heading).

- Pros: could reduce snippet noise for large files.
- Cons: reintroduces heading-based extraction heuristics that ADR-003 explicitly rejected.
  The "enclosing section" boundary requires a markdown parser; edge cases multiply (no
  heading found, nested headings, heading-less files). New failure mode outside the agreed
  error taxonomy. Significantly more test surface for KPI-CBQ-3/4.
- Rejected: same rationale as ADR-003; D-docquality REVISED's simplification principle
  applies here.

## Consequences

### Positive

- Zero new runtime dependency: `String.prototype.includes` + `toLowerCase()` are the entire
  implementation. Stays well within the solo-maintainer cognitive budget.
- Pure-function testable: the matching function takes a `ConcernScanInput` (concern string +
  pre-collected file contents + feature directory names) and returns `ConcernMatchResult[]`
  — no fs access, trivially table-driven in vitest.
- Consistent with existing conventions: path-convention-based structure classification
  (classify-structure.ts) remains the source of truth; keyword matching is layered on top,
  not replacing it. The `relevance` field reuses the same tier hierarchy established in
  D-CBQ-relevance / the existing `classifyStructure` logic.
- Handles the "directory name match but content doesn't mention concern" edge case (US-CBQ-01
  Domain Example 2) naturally: directory name is checked independently.

### Negative

- False positives: a file mentioning "auth" in passing (e.g., "we did NOT choose auth
  tokens") will appear in `matches`. Mitigated by: (a) nWave files are curated and small by
  convention (D-docquality REVISED), so "incidental mentions" are rare; (b) the agent
  reading results can apply its own judgement to snippet content.
- False negatives: a file discussing authentication without using the word "auth" will not
  match `resolve_concern("auth")`. Mitigated by: the agent can try synonyms; and nWave wave-
  decisions.md files tend to repeat the concern term in headers/decision labels (by
  convention). At MVP this is accepted (same philosophy as D-CBQ-match).
- No ranking within a relevance tier beyond config order: two "feature-level" matches from
  different repos are ordered by repo config order, not by keyword density or recency. Deemed
  acceptable at MVP — agents receive all matches and apply their own judgement.

## Enforcement

The matching logic (`matchConcern` function in `src/core/concern-matcher.ts`) must have
zero imports from `node:fs`, `node:fs/promises`, `node:child_process`, or `node:net` —
enforced by the existing `dependency-cruiser` rule set (`npm run check:arch`). No new rule
required.
