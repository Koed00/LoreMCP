# Slice 01: Heading-anchored snippet extraction

## Goal
Replace whole-file-up-to-cap snippets in `resolve_concern` matches with the heading-anchored section that actually contains the concern keyword.

## IN scope
- New pure function in `src/core/concern-matcher.ts`: extracts the section from the nearest preceding heading to the next heading of equal-or-higher level
- Applied to all three match types: feature files, ADR files, CLAUDE.md
- Fallback to today's whole-file-up-to-cap behavior when the file has no markdown headings
- Multi-section-match resolution: most keyword-dense section wins
- Existing truncation-warning mechanism reused for sections that themselves exceed the cap

## OUT scope
- Synonym/alias expansion (backlog item #2)
- Match-strength field (backlog item #3)
- `list_concerns()` tool (backlog item #4)
- Decision supersession detection (backlog item #5)
- Any change to `query_context`'s snippet behavior (separate tool, not touched this slice — though architecture-design.md may note it as a future extension point)

## Learning Hypothesis
**Disproves if it fails**: "Agents don't actually benefit from narrower snippets — whole-file context turns out to be useful, not noise." If dogfood testing on this repo's own multi-section files (e.g., `wave-decisions.md`) shows no meaningful reduction in snippet size or no improvement in relevance-judging speed, this slice's premise is wrong.
**Confirms if it succeeds**: Re-running the original "concern matching" query that triggered this DIVERGE round returns a snippet scoped to the concern-matching-strategy section, not the full DESIGN wave-decisions.md.

## Acceptance Criteria
1. Snippet for a multi-section file contains only the matched section's content (not unrelated sections)
2. Headingless file (e.g., a CLAUDE.md with no `#`/`##` headings) falls back to whole-file-up-to-cap — no regression
3. Concern keyword appearing in a heading itself anchors extraction to start at that heading
4. Concern appearing in multiple sections of the same file: snippet is the most keyword-dense section
5. A matched section that itself exceeds the cap is truncated with a warning (existing mechanism, reused)

## Dependencies
None — extends existing `matchConcernInSnapshot` from `concern-based-querying`, already merged.

## Effort Estimate
≤1 day (single pure function + wiring + acceptance tests)

## Reference Class
Same shape as `detectRejectedPaths` (paragraph-granularity pure function added in `concern-based-querying` step 04-01) — proven low-risk pattern in this codebase.

## Pre-slice SPIKE
Not needed — markdown heading-boundary parsing is a well-understood problem (regex on `^#{1,6}\s`), low uncertainty.
