# Slice 04: resolve_concern's CONCERN_NOT_FOUND nudges toward list_concerns

## Goal
`CONCERN_NOT_FOUND`'s message text mentions `list_concerns()` as a next step, since the two tools were explicitly designed to chain together.

## IN scope
- Edit `formatConcernNotFound`'s message string to mention `list_concerns()`

## OUT scope
- Any conditional logic checking whether `list_concerns()` would itself return empty (confirmed acceptable: unconditional nudge, costs nothing)
- Any change to the error shape/fields

## Learning Hypothesis
**Disproves if it fails**: this turns out not to matter in practice (lowest-severity finding, shipped last to validate it's worth the slice at all).
**Confirms if it succeeds**: `resolve_concern("rate-limiting")` (a concern absent from this repo) now returns a message mentioning `list_concerns`.

## Acceptance Criteria
1. `CONCERN_NOT_FOUND`'s message mentions `list_concerns`

## Dependencies
None.

## Effort Estimate
≤1 day (smallest slice in this round — likely <1 hour)

## Reference Class
Single string edit in `formatConcernNotFound` — no new logic.
