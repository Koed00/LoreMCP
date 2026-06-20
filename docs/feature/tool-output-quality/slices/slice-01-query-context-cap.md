# Slice 01: query_context total-response size cap

## Goal
Cap `query_context`'s aggregated response at a fixed total size, truncating lowest-priority results first, with a warning when truncated.

## IN scope
- Total-response cap (not per-file) applied after all files for a feature are collected
- Truncation priority: oldest wave first (most recent decisions preserved)
- Truncation warning added to the response when capping occurs

## OUT scope
- Any change to `resolve_concern`, `list_concerns`, or `list_features`
- Per-file truncation changes (already exist and are unaffected)

## Learning Hypothesis
**Disproves if it fails**: re-running `query_context` against this repo's own deepest-history feature still produces an oversized response after the fix.
**Confirms if it succeeds**: the same query that previously returned 97,705 characters now returns a response within the cap, with a truncation warning, and the most recent wave's content is still present.

## Acceptance Criteria
1. A feature whose combined wave-decisions content exceeds the cap returns a truncated response with a warning
2. A feature under the cap returns an unchanged, untruncated response (zero regression)
3. When truncated, the most recent wave's content is preserved over older waves

## Dependencies
None.

## Effort Estimate
≤1 day

## Reference Class
Same shape as `resolve_concern`'s existing snippet-cap precedent — proven low-risk pattern, applied at a different aggregation level (total response, not per-snippet).
