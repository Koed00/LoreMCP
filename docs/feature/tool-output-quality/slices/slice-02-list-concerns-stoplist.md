# Slice 02: list_concerns heading-text stoplist

## Goal
Filter generic, convention-driven nWave section headers (e.g. "Decisions", "Summary", "Mode") out of `list_concerns`'s heading-text candidates, without touching directory-name or ADR-title candidates.

## IN scope
- Stoplist applied ONLY to `collectFeatureFileHeadingCandidates`-sourced candidates
- Stoplist content covers the generic headers observed in this repo's own dogfooding (Decisions, Summary, Key Decisions, Mode, Constraints Established, Upstream Changes, etc.)

## OUT scope
- Filtering directory names or ADR titles (explicitly confirmed out of scope with user)
- Any change to `resolve_concern`, `query_context`, or `list_features`

## Learning Hypothesis
**Disproves if it fails**: filtering doesn't meaningfully shrink the 96-candidate baseline on this repo's own docs.
**Confirms if it succeeds**: re-running `list_concerns()` against this repo's own docs returns noticeably fewer, higher-signal candidates.

## Acceptance Criteria
1. A heading-text candidate matching the stoplist is excluded from the response
2. A genuine decision-topic heading (e.g. "D-auth: JWT strategy") is NOT excluded
3. A feature directory or ADR title literally matching a stoplist term is NOT excluded (stoplist scope is heading-text only)

## Dependencies
None.

## Effort Estimate
≤1 day

## Reference Class
Same shape as `REJECTION_KEYWORDS` in `concern-matcher.ts` — a simple string-list filter, proven low-risk pattern already in this file.
