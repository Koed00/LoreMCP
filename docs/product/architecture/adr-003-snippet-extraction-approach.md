# ADR-003: Snippet Extraction / "Relevant Context" Approach

## Status
Proposed (Recommendation pending stakeholder confirmation -- Propose-mode DESIGN output)

## Context

`query_context(repo_name, feature_id)` must return "relevant" doc snippets. This is the crux of the D-retrieval-risk carry-forward question (discover/wave-decisions.md, discuss/wave-decisions.md): given MVP targets nWave-structured repos only (D-docquality REVISED), is path-convention-based retrieval sufficient, without heuristic content indexing?

User-stories.md examples (US-01, US-04) consistently show `snippet` containing substantial multi-line section content (e.g., "## Critical Reframe (Read First)\n\n**Original problem framing was incorrect...**"), suggesting whole-section/whole-file content, not single-line excerpts.

## Decision

Define "relevant" **structurally, via path convention only** (no content-based relevance scoring):
- A file at `docs/feature/{feature_id}/{phase}/wave-decisions.md` (or `feature-delta.md`) is, BY CONSTRUCTION, relevant to `feature_id` for that `phase`.
- Files under `docs/product/architecture/*.md` (ADRs) are repo-wide architecture context, included as supplementary/fallback results.
- `CLAUDE.md` at the repo root is repo-wide convention context, included as last-resort fallback.

For each structurally-relevant file, return the **WHOLE FILE CONTENT** as `snippet`, with one safety valve: if content exceeds a size cap (default 8000 characters), truncate at the nearest preceding markdown heading boundary and add a `warnings` entry noting truncation + that `source_file` has the full content.

No markdown-AST parsing, no heading-to-feature_id matching, no text search/grep-based relevance.

## Alternatives Considered

### Heading-based section extraction
Find a heading matching `feature_id` (or related terms) within a larger file and return only that section.
- Pros: could reduce noise in large files
- Cons: requires a markdown parser + a matching heuristic for "does this heading relate to feature_id" -- exactly the kind of heuristic content-indexing that D-docquality REVISED explicitly scoped OUT of MVP ("MVP retrieval is path-convention-based... without heuristic free-text indexing"). Introduces a new undefined failure mode (heading not found) outside the agreed 4-error taxonomy. Significantly increases test surface for KPI-4/5 (every heading-matching edge case becomes a new test dimension).
- Rejected: violates D-docquality REVISED's core simplification rationale; expands error taxonomy without stakeholder agreement

### Text search / grep for `feature_id` string with surrounding context lines
Search file content for literal occurrences of `feature_id` and return N lines of context around each match.
- Pros: lightweight, no markdown parsing
- Cons: `feature_id` (a slug like `auth-pagination`) may never appear verbatim in prose (decisions are written in natural language); brittle and would frequently return empty/misleading "relevant" sections despite the source file containing clearly relevant content (e.g., the "Critical Reframe" example in US-01 doesn't contain the literal string "ab-mcp" repeated near the relevant text in a grep-friendly way)
- Rejected: same heuristic-indexing concern as above, plus likely to produce FALSE NEGATIVES on exactly the curated nWave files this MVP targets

## Consequences

### Positive
- Zero markdown-parsing dependency; minimal code surface = minimal bugs = directly serves KPI-4/5 (most test cases are "given this directory structure, which files get selected and what's in warnings", not "given this file content, which section gets extracted")
- Matches the literal examples in user-stories.md/journey yaml (whole-section content shown as snippet)
- Relies entirely on the nWave convention that `wave-decisions.md`/`feature-delta.md`/ADRs are ALREADY curated and appropriately sized -- consistent with D-docquality REVISED's premise

### Negative
- For repos with unusually large `wave-decisions.md`/ADR/CLAUDE.md files, truncation may omit relevant later content -- mitigated by truncation warning + `source_file` always pointing to the full file for the agent to re-read directly
- If, during DELIVER/dogfooding, this proves insufficient (agents can't find relevant content despite structurally-correct retrieval), this is the SIGNAL the discuss/wave-decisions.md "Upstream Changes" section already anticipates -- escalate to the flagged SPIKE on signaling mechanisms (frontmatter freshness tags, confidence scores) rather than retrofitting heuristic extraction into this ADR's approach
