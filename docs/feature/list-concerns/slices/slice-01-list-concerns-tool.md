# Slice 01: list_concerns() MCP tool

## Goal
Add a new MCP tool that scans all configured repos and returns candidate concern/topic strings an agent can feed into `resolve_concern`, without requiring the agent to already know a keyword.

## IN scope
- New MCP tool `list_concerns()`, no input arguments
- Scans every configured repo (same per-repo probe/skip pattern as `resolve_concern`)
- Extracts candidate topics from: feature directory names, ADR filenames/titles, heading text within wave-decisions.md/ADR files (reusing `detectHeadingLines`/`HEADING_PATTERN` from `heading-anchored-snippets`)
- Deduplicates identical topic strings across repos
- Caps result at 200 entries (first 200 in repo-config order), with truncation warning beyond that
- Returns `searched_repos` (consistent with `resolve_concern`'s pattern)

## OUT scope
- Synonym/alias expansion (separate backlog item)
- Match-strength/confidence scoring on candidates
- Any change to `resolve_concern`, `query_context`, or `list_features` behavior

## Learning Hypothesis
**Disproves if it fails**: "Agents don't actually need a browse-before-you-query step" — if dogfood usage shows agents still guess `resolve_concern` keywords blind instead of calling `list_concerns()` first, this feature's premise is wrong.
**Confirms if it succeeds**: An agent can call `list_concerns()` against this repo's own docs, see real candidate topics (e.g. "concern matching", "rejected paths", "heading-anchored"), and use one as input to `resolve_concern` without prior knowledge of the codebase.

## Acceptance Criteria
1. `list_concerns()` returns candidate topics drawn from feature directory names and ADR titles across all configured repos
2. A repo with no nWave structure is silently excluded (not an error)
3. All repos lacking nWave structure → empty `concerns` array, not an error
4. Duplicate topic signals across repos are deduplicated to one entry
5. Result capped at 200 entries with a truncation warning when exceeded

## Dependencies
None — reuses `detectHeadingLines`/`HEADING_PATTERN` (already shipped in `heading-anchored-snippets`) and the existing per-repo probe/scan loop (already shipped in `concern-based-querying`).

## Effort Estimate
≤1 day

## Reference Class
Same shape as `resolve_concern`'s cross-repo scan handler — proven low-risk pattern in this codebase, now used a third time.

## Pre-slice SPIKE
Not needed — topic extraction reuses already-proven heading-detection logic; no new uncertainty.
