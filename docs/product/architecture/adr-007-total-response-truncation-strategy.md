# ADR-007: Total-Response Truncation Strategy for query_context

## Status
Accepted (DESIGN wave, tool-output-quality feature, slice 01)

## Context

Live dogfooding immediately after `list-concerns` shipped surfaced a defect:
`query_context("lore-mcp", "list-concerns")` returns a 97,705-character response —
larger than the calling agent can usefully process in one call, with no warning. This
happens even though the EXISTING per-file truncation (`capSnippetAtHeadingBoundary`,
ADR-003, applied to each individual file's content during the per-file size-cap pass) is
already in effect — the bug is not that any ONE file is oversized, but that MANY
under-cap files, summed across a feature's accumulated wave history (multiple phases'
`wave-decisions.md` plus all repo ADRs plus `CLAUDE.md`), sum past a usable total size.

DISCUSS already resolved the product-level decision (binding, not re-litigated here):
the fix is a TOTAL-response cap, not a per-file one (D4 in
`docs/feature/tool-output-quality/discuss/wave-decisions.md`), truncating OLDEST wave
content first, with a truncation warning (US-TOQ-01 ACs 1-3).

DESIGN's open question is narrower: **where does the new total-response truncation
logic live, and what mechanism does it use** — specifically, whether it reuses the
existing `capSnippetAtHeadingBoundary` helper (applied to a concatenated blob of all
results) or operates at the granularity of the result array itself (dropping whole
oldest results until under budget).

Constraints carried forward from ADR-003/ADR-006 and CLAUDE.md:
- Pure function in `src/core/format-response.ts` (or `concern-matcher.ts`, if reused) —
  no fs, no network.
- Zero new runtime dependency.
- Solo-maintainer cognitive budget — one mechanism per problem shape, not two competing
  truncation philosophies in the same codebase doing similar-looking things differently.

## Decision

**Result-array-level truncation: drop whole oldest results until the cumulative
`snippet.length` of the kept (most-recent-first) subset fits within a new
`TOTAL_RESPONSE_MAX_CHARS` budget.** This is a NEW, separate pure function,
`capResultsToTotalBudget`, added to `src/core/format-response.ts` — it does NOT reuse or
extend `capSnippetAtHeadingBoundary` (the existing per-file truncation helper in
`concern-matcher.ts`).

1. `classified.filesToRead` / the resulting `QueryContextResultItem[]` is already
   ordered oldest-to-newest within a feature's phases, followed by ADRs, followed by
   CLAUDE.md (existing `classify-structure.ts` build order, unchanged).
2. Sum `snippet.length` across all results. If within budget, return unchanged
   (zero regression for normal-sized features, AC2).
3. If over budget, walk the array from the END (most recent) backward, accumulating
   length, and keep the maximal trailing subset that fits. Everything before that point
   is dropped WHOLE (never re-truncated mid-content — that already happened per-file,
   upstream, via the existing per-file cap).
4. Emit one new warning string when truncation occurs, composed into the existing
   `warnings` array alongside `classified.warnings` and TOCTOU warnings.

## Alternatives Considered

### A. Reuse `capSnippetAtHeadingBoundary` on a concatenated-then-truncated total string

Concatenate every result's snippet into one string, run the existing helper against the
concatenated total (which already knows how to cut at the last heading boundary before
a character cap), then re-split the truncated string back into per-file results.

- Pros: reuses an already-tested helper verbatim; on its face, zero new truncation
  logic — the "same shape as `resolve_concern`'s existing snippet-cap precedent" framing
  used in `slice-01-query-context-cap.md`'s Reference Class note.
- Cons: `capSnippetAtHeadingBoundary` solves a fundamentally different problem — WHERE
  to cut WITHIN one string. It has no notion of "this content came from N independent
  files in a specific oldest-to-newest order." Re-splitting a single truncated blob back
  into discrete `{sourceFile, phase, snippet}` results would require NEW byte-offset
  bookkeeping per original file that does not exist in the helper today — this is not
  free reuse, it is reuse-plus-new-glue-code of comparable size to Option B's
  straightforward array operation. Worse, concatenating heterogeneous files before
  truncating risks the cut landing MID-FILE in a way that orphans a later, smaller,
  more-recent file that would have fit entirely if evaluated independently — this
  directly undermines AC3 ("most recent wave's content is preserved over older waves"),
  since the concatenation order and the heading-boundary cut point are not guaranteed to
  align with file boundaries at all.
- Rejected: optimizes for surface-level code reuse at the cost of correctness for the
  binding AC that matters most (recency preservation). The "Reference Class" similarity
  noted in the slice document is real at the level of "both are size caps with
  warnings," but the underlying mechanism does not transfer cleanly — this ADR exists
  precisely to document why this superficially-attractive option was rejected, since a
  future maintainer reading only the slice doc could otherwise reasonably reach for it.

### B. Recommended: Result-array-level truncation, drop-oldest-whole (chosen)

- Pros: operates on the EXACT unit the AC is written in terms of — "oldest wave
  content" dropped, "most recent wave's content" preserved — phase/file granularity,
  not byte-offset-in-a-blob granularity. Zero ambiguity about where a cut lands relative
  to file boundaries (a dropped file is dropped whole, never mid-content, so no orphaned
  partial file can appear in the response). Trivially testable with table-driven
  fixtures: N results of known `snippet.length`, assert which trailing subset survives
  for a given budget — this is a pure array-summation algorithm, no string-parsing edge
  cases. Composes cleanly with the EXISTING per-file cap (ADR-003) as a second,
  independent pass with a different unit of work (whole results vs. characters within
  one file) — no interaction effects to reason about.
- Cons: does not literally reuse `capSnippetAtHeadingBoundary`'s code. Accepted: this is
  the correct outcome given the cons of Option A above — the two truncation problems
  (within-one-file cut point vs. across-many-files selection) are genuinely different
  problems, and forcing code reuse past where it naturally fits would be cargo-culting a
  precedent past its applicability boundary, the opposite of "simplest solution first."

## Consequences

### Positive
- AC1/AC3 satisfied by construction: dropping whole results from the oldest end of an
  already-ordered array guarantees the most recent wave's content survives, with no
  edge case where a heading-boundary cut could land inside the most-recent file and
  partially drop it.
- AC2 (zero regression for normal-sized features) is a single early-return check
  (`if total <= budget, return unchanged`) — no behavior change at all for the common
  case, matching every existing feature's history in this repo today.
- Zero new runtime dependency — plain array iteration and length summation.
- Clean separation of concerns: per-file truncation (ADR-003, `concern-matcher.ts`/
  per-file read path) and total-response truncation (this ADR, `format-response.ts`,
  result-array level) are two independent, non-interacting passes, each individually
  simple and testable, rather than one entangled mechanism trying to do both jobs.

### Negative
- Introduces a SECOND truncation philosophy in the codebase (array-level vs.
  string-level) rather than a single unified one. Accepted: the two truncation problems
  are genuinely different in shape (selecting among files vs. cutting within a file),
  and a unified mechanism would need to abstract over both shapes for no behavioral
  benefit — two simple, narrowly-scoped functions are easier for a solo maintainer to
  hold in their head than one falsely-general one.
- A feature whose single MOST RECENT result alone exceeds `TOTAL_RESPONSE_MAX_CHARS`
  would still produce an over-budget response (the algorithm keeps the maximal trailing
  subset that fits, which could be a single result already larger than the budget).
  Accepted as out of scope for this fix: the existing per-file cap (`SNIPPET_MAX_CHARS`,
  8000 chars) already bounds any single result's `snippet.length` to a value well below
  the new `TOTAL_RESPONSE_MAX_CHARS` (24000 chars, 3x the per-file cap) — this scenario
  cannot occur given the two caps' relative sizing, but is noted as a documented
  invariant dependency between the two constants for future maintainers who might change
  either value independently.

## Enforcement

`capResultsToTotalBudget` lives in `src/core/format-response.ts` alongside the existing
pure formatter functions. The same `dependency-cruiser` rule already enforces zero
`node:fs`/`node:child_process`/`node:net` imports for the whole `src/core/**` tree — no
new rule required, consistent with ADR-003/ADR-005/ADR-006's enforcement sections.
