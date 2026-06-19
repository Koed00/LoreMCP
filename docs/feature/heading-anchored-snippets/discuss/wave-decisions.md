# DISCUSS Decisions — heading-anchored-snippets

## Key Decisions
- [D1] Feature type: Backend (no UI) — extends `resolve_concern`'s response shape only (see Decision 1)
- [D2] No walking skeleton — surgical extension to an already-working, already-merged pipeline (see Decision 2)
- [D3] JTBD skipped — job already validated in DIVERGE round, see `recommendation.md` and `docs/product/jobs.yaml`
- [D4] Multi-section match resolution: most keyword-dense section wins (resolved with user during DISCUSS, not deferred to DESIGN)
- [D5] Headingless files fall back to today's whole-file-up-to-cap behavior — explicit no-regression requirement

## Requirements Summary
- Primary need: narrow `resolve_concern` snippets to the heading-anchored section containing the match, instead of whole-file-up-to-8000-chars
- Walking skeleton scope: N/A (declined)
- Feature type: Backend

## Constraints Established
- Pure function only, in `src/core/concern-matcher.ts` — no new dependency
- Must reuse the truncation-warning mechanism already built for oversized content
- Must not regress headingless-file behavior

## Upstream Changes
- None — DIVERGE's `recommendation.md` job framing carried forward without revision.
