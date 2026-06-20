# DISCUSS Decisions — tool-output-quality

## Key Decisions
- [D1] Feature type: Backend (no UI) — 4 independent fixes to existing MCP tool response content (see Decision 1)
- [D2] No walking skeleton — all 4 fixes extend already-shipped tools (see Decision 2)
- [D3] JTBD skipped — underlying job (`cross-repo-context-grounding`) is unchanged; this round fixes 4 defects found via live dogfooding, not a new job
- [D4] query_context's size cap is a TOTAL-response cap with truncation warning, NOT per-file — resolved with user: a per-file cap alone would not have prevented the 97,705-char bug, since it was caused by many under-cap files summed together
- [D5] list_concerns's stoplist applies ONLY to heading-text candidates, never directory names or ADR titles — resolved with user: directory/ADR names are human-chosen and inherently meaningful, heading text is convention-driven boilerplate
- [D6] list_features's deliver-phase detection requires execution-log.json with ≥1 COMMIT-phase entry, not mere directory existence — resolved with user: matches "shipped" semantics already used by this project's own DES execution-log schema
- [D7] resolve_concern's list_concerns nudge is unconditional text, not conditionally suppressed when list_concerns would also return empty — resolved with user: costs nothing, agent learns the fact for free on the next call
- [D8] Prioritization within this bundled round: query_context cap (01) first per explicit severity, then list_concerns noise (02), list_features deliver-blindness (03), resolve_concern nudge (04)

## Requirements Summary
- Primary need: fix 4 defects found via live dogfooding immediately after `list-concerns` shipped — query_context has no size cap, list_concerns is noisy, list_features can't see DELIVER, resolve_concern's error doesn't chain to list_concerns
- Walking skeleton scope: N/A (declined)
- Feature type: Backend

## Constraints Established
- All 4 fixes are pure-function changes in `src/core/`, except slice 03's shell-layer file read (`execution-log.json`) in `server.ts`
- No new npm dependency
- Zero regression to any of the 442 pre-existing tests

## Upstream Changes
- None — these are findings from live dogfooding the already-shipped `list-concerns` feature, not a revision of any prior wave's product decisions.
