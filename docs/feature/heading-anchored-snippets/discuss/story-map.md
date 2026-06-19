# Story Map — heading-anchored-snippets

## Backbone

Single activity: **Agent receives a heading-anchored snippet from `resolve_concern`** (extends the existing "Agent resolves a concern" activity from `concern-based-querying`; no new activity needed).

## Walking Skeleton

Not applicable — this is a brownfield, surgical change to one existing function's output shape. The end-to-end path (`resolve_concern` → matches → response) already exists and is green. Decision confirmed with user: No.

## Slices

This feature is already a single thin slice — no further decomposition needed. Elephant Carpaccio taste tests applied:

- Ships 4+ new components? No — one new pure function (`extractHeadingAnchoredSnippet`) replacing the snippet-building line inside `matchConcernInSnapshot`.
- Depends on a new abstraction? No — reuses paragraph-splitting precedent from `detectRejectedPaths`.
- Has a learning hypothesis? Yes — see below.
- Uses production data? Yes — this repo's own `docs/` is the dogfood fixture (as with prior features).
- Has a same-day dogfood moment? Yes — `resolve_concern` is already wired into this session's MCP connection; testing the change means re-running the same live query that surfaced the original pain.

| Slice | Goal | Learning Hypothesis | Est. |
|---|---|---|---|
| 01 | Replace whole-file snippet with heading-anchored section extraction | Disproves: "agents don't actually need narrower snippets" — if real dogfood queries don't show shorter, more relevant output, the hypothesis behind this entire feature is wrong | ≤1 day |

## Prioritization

Single slice, no ordering decision needed. Highest-leverage and only slice — ship it, dogfood immediately via `resolve_concern`, confirm against the original "concern matching" query that triggered this round.
