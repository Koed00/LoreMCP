# Slice 03: list_features deliver-phase detection

## Goal
`list_features` correctly includes `"deliver"` in a feature's `phases` array only when `execution-log.json` exists and has at least one COMMIT-phase entry — not merely when the `deliver/` directory exists.

## IN scope
- New detection logic alongside the existing `wave-decisions.md`-presence check in `discoverFeatures`
- Reads `execution-log.json` and checks for ≥1 entry with `p: "COMMIT"` (matching this project's own DES execution-log schema)

## OUT scope
- Any change to other phases' detection logic (design/discuss/distill remain wave-decisions.md-based, unchanged)
- Any change to `query_context`, `list_concerns`, or `resolve_concern`

## Learning Hypothesis
**Disproves if it fails**: `list_features` still can't distinguish a shipped feature from a never-started one after the fix.
**Confirms if it succeeds**: re-running `list_features("lore-mcp")` shows `"deliver"` in the phases array for `concern-based-querying`, `heading-anchored-snippets`, and `list-concerns` (all of which have real, completed execution logs).

## Acceptance Criteria
1. A feature with `execution-log.json` containing ≥1 COMMIT entry includes `"deliver"` in its phases array
2. A feature with `execution-log.json` containing zero COMMIT entries does NOT include `"deliver"`
3. A feature with no `deliver/` directory at all behaves identically to today (zero regression)

## Dependencies
None.

## Effort Estimate
≤1 day

## Reference Class
Same shape as the existing `wave-decisions.md`-presence check in `discoverFeatures` — same function, one more condition.
