# DISCUSS Decisions — list-concerns

## Key Decisions
- [D1] Feature type: Backend (no UI) — new MCP tool, same category as `list_features`/`query_context`/`resolve_concern`
- [D2] No walking skeleton — surgical addition of a 4th tool to an already-working server, not a new e2e path
- [D3] JTBD skipped — job already validated in the 2026-06-19 DIVERGE round backlog (`docs/feature/heading-anchored-snippets/recommendation.md` item #4), and directly motivated by the gap documented in README's "Using LoreMCP while architecting" section
- [D4] Result capped at 200 entries (first-200-in-config-order), with truncation warning beyond that — resolved with user during DISCUSS, not deferred to DESIGN
- [D5] Structureless repos (no nWave artifacts) are silently excluded from contributing candidates, never causing the whole call to error — consistent with `resolve_concern`'s existing per-repo skip pattern

## Requirements Summary
- Primary need: let an agent browse candidate decision topics across all configured repos before guessing a `resolve_concern` keyword
- Walking skeleton scope: N/A (declined)
- Feature type: Backend

## Constraints Established
- Pure function only, in `src/core/` — no new dependency
- Must reuse `detectHeadingLines`/`HEADING_PATTERN` from `heading-anchored-snippets` rather than reinventing topic extraction
- Must reuse the existing per-repo probe/scan loop pattern already proven by `resolve_concern`

## Upstream Changes
- None — DIVERGE's backlog framing (item #4, `list_concerns()`, scored 3.35/5) carried forward without revision.
