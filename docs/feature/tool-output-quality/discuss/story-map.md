# Story Map — tool-output-quality

## Backbone

Single activity: **Agent receives reliable, signal-dense responses from all 4 LoreMCP tools** (regression-recovery activity — fixes 4 defects found via live dogfooding immediately after `list-concerns` shipped, not a new capability).

## Walking Skeleton

Not applicable — all 4 fixes extend already-working, already-shipped tools. Confirmed with user: No.

## Slices

4 independent thin slices — each touches a different tool/file, independently testable, no shared abstraction between them. Carpaccio taste test: "ships 4+ new components" does NOT apply here, since these are 4 fixes to 4 EXISTING components, not 4 new ones.

| Slice | Goal | Learning Hypothesis | Est. |
|---|---|---|---|
| 01 | `query_context` total-response size cap with truncation warning | Disproves: "query_context's lack of a cap was a one-off, not a real defect" — if re-running it against this repo's own deepest-history feature still produces an oversized response after the fix, the cap logic is wrong, not just missing | ≤1 day |
| 02 | `list_concerns` heading-text stoplist | Disproves: "the noise was tolerable" — if filtering the known generic headers doesn't meaningfully shrink the candidate list on this repo's own 96-candidate baseline, the stoplist is too narrow | ≤1 day |
| 03 | `list_features` deliver-phase detection via execution-log.json | Disproves: "deliver-phase blindness doesn't matter in practice" — if `list_features` still can't distinguish a shipped feature from a never-started one after the fix, the detection rule is wrong | ≤1 day |
| 04 | `resolve_concern`'s `CONCERN_NOT_FOUND` nudges toward `list_concerns` | Disproves: "an agent would have found list_concerns anyway" — low-risk, smallest slice, ships last since it's the lowest-severity finding | ≤1 day |

All 4 slices use this repo's own `docs/` as production-data dogfood fixtures, consistent with every prior feature.

## Prioritization

Confirmed with user: **query_context cap first** (highest severity — provably broken at 97K chars today), then in the originally-reported priority order: list_concerns noise (02) → list_features deliver-blindness (03) → resolve_concern nudge (04). Each slice ships and is dogfooded independently before the next starts.
