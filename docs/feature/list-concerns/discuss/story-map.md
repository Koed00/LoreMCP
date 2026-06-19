# Story Map — list-concerns

## Backbone

Single activity: **Agent discovers candidate concern topics before querying** (new activity, but feeds directly into the existing "Agent resolves a concern" activity from `concern-based-querying`).

## Walking Skeleton

Not applicable — new tool added alongside 3 already-working tools in the same MCP server. Confirmed with user: No. Surgical addition, not a new e2e path; the server registration pattern, config loading, and per-repo probe loop are all already proven by `resolve_concern`.

## Slices

Single thin slice — no further decomposition needed.

| Slice | Goal | Learning Hypothesis | Est. |
|---|---|---|---|
| 01 | Add `list_concerns()` MCP tool: scan all configured repos, extract candidate topic strings from feature directory names + ADR titles + heading text, dedupe, cap at 200 | Disproves: "agents don't actually need a browse-before-you-query step" — if real dogfood usage shows agents still guess keywords instead of calling list_concerns() first, the premise behind this entire feature is wrong | ≤1 day |

Carpaccio taste tests applied:
- Ships 4+ new components? No — one new pure aggregation function plus one new tool registration, reusing existing heading-detection and per-repo scan machinery.
- Depends on a new abstraction? No — reuses `detectHeadingLines`/`HEADING_PATTERN` from `heading-anchored-snippets` and the existing per-repo probe/scan loop from `resolve_concern`.
- Has a learning hypothesis? Yes, above.
- Uses production data? Yes — this repo's own `docs/` is the dogfood fixture, same as every prior feature.
- Has a same-day dogfood moment? Yes — `list_concerns()` → `resolve_concern()` chain can be tested live via the MCP connection immediately after merge.

## Prioritization

Single slice, no ordering decision needed.
