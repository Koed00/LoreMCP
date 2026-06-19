# Evolution Archive — list-concerns

## Feature Summary
Adds a 4th MCP tool, `list_concerns()` (no arguments), to lore-mcp. Scans all configured repos and returns candidate decision-topic strings (feature directory names, ADR titles, decision heading text) an agent can browse before guessing a `resolve_concern` keyword. Closes the "browse before you query" gap documented in README's "Using LoreMCP while architecting" section — originally identified as DIVERGE backlog item #4 during the `heading-anchored-snippets` round.

## Delivered
2026-06-19

## Wave Trace
- DIVERGE: backlog item #4 (`docs/feature/heading-anchored-snippets/recommendation.md`), scored 3.35/5, promoted to a scoped feature on user request
- DISCUSS: US-LC-01, 5 acceptance criteria, single thin slice, no walking skeleton (4th tool added to an already-working server). 200-entry cap explicitly resolved with user during DISCUSS, not deferred.
- DESIGN: extends `src/core/concern-matcher.ts` (Option A of 3 considered) with `collectConcernCandidates`/`extractFirstHeadingText`, reusing existing heading-detection machinery. No new ADR needed (ADR-005/ADR-006 already cover the philosophy). README update explicitly flagged in the Changes Per File table per user's instruction.
- DISTILL: 5 scenarios, Strategy C (real local), port-to-port via MCP stdio. Required a RED-scaffold step (NOT_IMPLEMENTED stub tool registration) since, unlike prior features, this tool didn't exist at all before — peer-reviewed and confirmed as the correct Mandate 7 interpretation for a brand-new tool.
- DELIVER: 2 roadmap steps (01-01 implementation, 01-02 README update — both explicitly required by the user as part of this feature's delivery, not deferred).

## Key Decisions
- Topic sources: feature directory names (verbatim), ADR titles (first-heading text, filename-fallback if headingless), feature-file heading text. CLAUDE.md explicitly excluded (repo-conventions, not decision-topic content).
- Dedup is exact-string-match across ALL repos combined, applied once at the server.ts call site — `collectConcernCandidates` itself does no dedup/cap (per-repo only).
- 200-entry cap applied to the deduped list, repo-config order preserved.
- `list_concerns()` never returns an error shape — empty `concerns: []` is always a valid success response, even when no configured repo has nWave structure.

## Quality Gates
- 442/442 tests passing
- Architecture constraints clean (dependency-cruiser)
- TypeScript strict mode clean
- Mutation score: 88.02% project-wide; `concern-matcher.ts` 81.67% (initially 78.78% — below the 80% gate after this feature's new code, closed with 33 added tests, no production changes), `format-response.ts` 100% (up from 82.95%)
- DES integrity: 2/2 steps with complete traces
- Live dogfood confirmed: `list_concerns()` against this repo's own docs returned 96 candidates including all 4 feature directories and real ADR titles (KPI-LC-1); chaining a result into `resolve_concern()` found the exact source ADR end-to-end (KPI-LC-5)
- README field-name bug caught and fixed during the post-merge gate (`searchedRepos` → `searched_repos`, verified against live tool output) — plus stale "three tools"/test-count language closed
