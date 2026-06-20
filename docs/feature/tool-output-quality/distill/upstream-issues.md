# Upstream Issues — tool-output-quality

## Issue 1: query_context has zero per-file cap — root cause is bigger than DESIGN assumed

**Found during**: DELIVER step 01-01 implementation, live dogfood verification against this repo's own `ab-mcp` feature, 2026-06-19.

**Original DESIGN assumption** (architecture-design.md Slice 01): the 97,705-char bug was caused by "many under-cap individual files summed together," so a TOTAL-response cap alone (confirmed with user: not per-file) would fix it. `TOTAL_RESPONSE_MAX_CHARS = 24000` was chosen as "3x the per-file `SNIPPET_MAX_CHARS` of 8000... a single result's snippet.length is already bounded well below this total budget by the existing per-file cap."

**Gap**: that last sentence's premise is false. `query_context` has **no per-file cap at all** — unlike `resolve_concern`, which applies `capSnippetAtHeadingBoundary` (8000-char cap) to every snippet it returns. `buildQueryContextResults` in `format-response.ts` passes file content straight through, uncapped, at any size.

**Evidence**: live dogfood against this repo's own `ab-mcp` feature (the project's own oldest, deepest feature) found:
- `docs/product/architecture/brief.md` alone: 49,501 chars, returned whole
- 7 ADR files: 2,436 to 10,108 chars each, all returned whole
- Total uncapped response across 15 results: 135,434 chars

At `TOTAL_RESPONSE_MAX_CHARS = 24000`, this crushed the response from 15 results down to 1, dropping the foundational "Critical Reframe" decision entirely — breaking the project's own walking-skeleton acceptance test. Raising the total cap alone cannot fix this: `query_context` includes ALL ADRs and the FULL `brief.md` on every single per-feature query (by design, from the original `ab-mcp` feature — architecture decisions are treated as always-relevant cross-cutting context, regardless of which feature is being queried), so as the product accumulates more ADRs and a growing `brief.md`, every feature query balloons regardless of the feature's own size.

**New assumption** (confirmed with user): add a per-file cap to `query_context`'s results, reusing the EXISTING `capSnippetAtHeadingBoundary` helper (already proven in `resolve_concern`, exported from `concern-matcher.ts` for reuse), applied BEFORE the total-response cap. This is the fix that actually addresses the root cause; the total-response cap remains necessary as a second layer (since even capped-per-file content from 15 results can still sum past a reasonable budget), but is no longer doing all the work alone.

## Resolution

- Export `capSnippetAtHeadingBoundary` from `concern-matcher.ts` (was module-private).
- `buildQueryContextResults` in `format-response.ts` applies it to every file's content (8000-char cap, same `SNIPPET_MAX_CHARS` constant already used by `resolve_concern`) before building the `results` array.
- `TOTAL_RESPONSE_MAX_CHARS` raised from 24000 to 60000 (chosen against the corrected, now per-file-capped baseline for `ab-mcp`) as the second-layer cap.
- Both truncation-warning sources (per-file and total-response) are surfaced in the response's `warnings` array.

This is an additive correction to architecture-design.md's Slice 01 contract, not a reversal of the binding "total cap, not per-file ALONE" DISCUSS decision — both mechanisms now apply together, layered, matching how `resolve_concern` already combines per-snippet and cross-repo concerns.
