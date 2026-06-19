# Evolution Archive — heading-anchored-snippets

## Feature Summary
Extends `resolve_concern` (from `concern-based-querying`) to narrow returned snippets to the heading-anchored section containing a match, instead of returning whole-file content up to the 8000-char cap. Originated from a DIVERGE round that surfaced this as the highest-impact next improvement after live dogfooding `resolve_concern`.

## Delivered
2026-06-19

## Wave Trace
- DIVERGE: identified via JTBD + brainstorming + taste evaluation (5 options scored, 1 filtered by DVF). `docs/feature/heading-anchored-snippets/recommendation.md`.
- DISCUSS: US-HAS-01, 5 acceptance criteria, single thin slice (no walking skeleton — extends an already-green pipeline). Multi-section resolution rule ("most keyword-dense section wins among non-ancestor candidates") resolved interactively with user.
- DESIGN: ADR-006 — regex-based heading detection + line-array slicing, no markdown-AST dependency. `extractHeadingAnchoredSnippet(content, concern): string | null` contract.
- DISTILL: 5 scenarios (later 6 after the regression fix), Strategy C (real local), port-to-port via MCP stdio. Peer-reviewed, approved.
- DELIVER: 2 roadmap steps (01-01 initial implementation, 01-02 ancestor-exclusion bug fix found via live dogfooding).

## Key Decisions
- D-CBQ inherited constraints carried forward unchanged (no cache, no new dependency, pure function)
- Heading-boundary parsing: regex + line-array slicing (ADR-006), not markdown-AST
- Multi-section density resolution excludes pure structural ancestors (zero own-text match) from competing against their descendants; an ancestor with a genuine own-text match remains density-eligible (confirmed against ADR-005's own dogfood behavior)

## Bug Found and Fixed During DELIVER
Live dogfood check (KPI-HAS-4) caught a real defect before merge: a document's top-level H1 title section always won the density comparison over its own subsections, because its occurrence count summed every nested match. This defeated the feature's purpose for the most common nWave file shape (`# Title` + multiple `## D-xxx:` subsections) — including this repo's own files. Fixed via `excludeStructuralAncestors`, with a regression scenario added to the acceptance suite. Full root-cause analysis: `docs/feature/heading-anchored-snippets/distill/upstream-issues.md`.

## Secondary Finding: Mutation Testing Config Gap
Discovered during DELIVER's mutation-testing phase that `stryker.config.mjs` never included `concern-matcher.ts` in its mutate scope — a stale gap dating back to that file's creation in `concern-based-querying`. Fixed the config and backfilled test coverage for both the pre-existing and new logic to restore the project's per-feature ≥80% mutation gate (final: concern-matcher.ts 80.08%, project-wide 85.75%).

## Quality Gates
- 369/369 tests passing
- Architecture constraints clean (dependency-cruiser)
- TypeScript strict mode (noUncheckedIndexedAccess) clean
- Mutation score: 85.75% project-wide, 80.08% on the modified file (threshold: 80%)
- DES integrity: 2/2 steps with complete traces
- Live dogfood (KPI-HAS-4) confirmed: `resolve_concern(concern: "concern matching")` snippet narrowed from 7696 to 1124 chars on this repo's own wave-decisions.md
