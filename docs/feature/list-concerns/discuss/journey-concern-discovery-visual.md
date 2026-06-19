# Journey: Agent discovers available concern topics before querying

## Mental Model

An agent calling `resolve_concern` today must already know the right keyword. There's no way to check "what decision topics even exist across these repos" first. `list_concerns()` introduces that missing concept directly — parallel to how `list_features()` already exposes "the set of features" for a single repo, but scanning across ALL configured repos like `resolve_concern` does.

## Happy Path

| Step | Agent Action | Tool Behavior | Output | Emotional State |
|---|---|---|---|---|
| 1 | Calls `list_concerns()` (no arguments) | Scans every configured repo's nWave artifacts | — | Uncertain — doesn't know what to ask yet |
| 2 | — | Detects decision-topic signals: feature directory names, ADR titles/filenames, and heading text within wave-decisions.md/ADR files | Internal: raw candidate list per repo | — |
| 3 | — | Aggregates and deduplicates candidates across repos | Flat list of candidate concern strings | — |
| 4 | Reads the list | Returns `{ concerns: string[], searched_repos: string[] }` | Agent sees the landscape of decided topics | **Oriented** — knows what's actually decided somewhere |
| 5 | Picks a candidate, calls `resolve_concern(concern)` | (existing flow, unchanged) | Full match detail for that topic | **Confident** — picked a real keyword, not a guess |

## Emotional Arc

Uncertain (no starting point) → Oriented (sees the landscape) → Confident (picks a real topic) → proceeds into the existing, already-shipped `resolve_concern` flow. Strictly upward — this journey's entire purpose is removing the "guess a keyword blind" friction documented in README's "Using LoreMCP while architecting" section.

## Shared Artifacts Registry

| Artifact | Type | Single Source of Truth |
|---|---|---|
| `concerns` (output) | string[] | New aggregation logic in `src/core/` scanning the same heading/directory-name signals already used by `resolve_concern`'s matching and `heading-anchored-snippets`'s heading-detection |
| `concern` (input to the NEXT call) | string | One element from `list_concerns()`'s output, fed into `resolve_concern` — no new shared-artifact type, reuses the existing `concern` parameter shape |

No new variable type introduced — `list_concerns()`'s output becomes `resolve_concern()`'s input, closing the loop the README's 3-step workflow already documents.

## Error / Edge Paths

| Scenario | Behavior | Why |
|---|---|---|
| A configured repo has zero nWave structure (no features, no ADRs) | Excluded from that repo's contribution to the result, silently | Consistent with `resolve_concern`'s graceful per-repo skip pattern — not every configured repo needs nWave structure |
| ALL configured repos have zero nWave structure | Empty `concerns: []` with `searched_repos` listing what was checked — NOT a hard error | Consistent with `CONCERN_NOT_FOUND`'s "this may be undecided" philosophy — an empty landscape is informative, not exceptional |
| Large repo set produces hundreds of candidate topics | Capped at 200 entries (first 200 in repo-config order), with a truncation warning if more exist | Confirmed with user — same class of decision as the 8000-char snippet cap already established (ADR-003/ADR-005), predictable and simple |
| Same concern-like string appears as both a feature directory name AND an ADR title across different repos | Deduplicated to one entry in the output list | The agent only needs to know the TOPIC exists once, not how many times it surfaces structurally |

## Constraints for DESIGN

1. Must reuse the heading-detection logic already built for `heading-anchored-snippets` (`detectHeadingLines`/`HEADING_PATTERN` in `src/core/concern-matcher.ts`) rather than reinventing topic extraction — same Reuse Analysis discipline as every prior feature in this codebase.
2. Result capped at 200 candidate entries, first-200-in-config-order, with a truncation warning beyond that (confirmed with user during DISCUSS).
3. Pure function only, no new dependency — consistent with every prior `src/core/` addition in this project.
