# Evolution Archive — tool-output-quality

## Feature Summary
Bundled regression-recovery round fixing 4 independent defects in the already-shipped lore-mcp MCP tools (`query_context`, `list_concerns`, `list_features`, `resolve_concern`), all found via live dogfooding immediately after `list-concerns` shipped: a critical 97,705-char unbounded response, generic noise in topic discovery, a tool blind to whether DELIVER actually happened, and a missed chaining opportunity between two tools.

## Delivered
2026-06-20

## Wave Trace
- DISCUSS: 4 user stories (US-TOQ-01 through 04), 4 independent thin slices, bundled into one round (validated as defensible by peer review — all 4 trace to the same `cross-repo-context-grounding` job, independently shippable). 3 open decisions resolved interactively: total-response cap not per-file, heading-text-only stoplist, COMMIT-entry-required deliver detection.
- DESIGN: ADR-007 (total-response truncation strategy). One peer-review gap closed (missing Reuse Analysis table for slice 01).
- DISTILL: 8 scenarios, Strategy C, no scaffold needed (all 4 tools already registered). 7 of 8 assertions genuinely RED.
- DELIVER: 4 roadmap steps, executed in priority order (query_context cap first, per explicit severity ranking).

## Major Mid-Implementation Finding
Step 01-01 (query_context cap) surfaced that the DESIGN-wave assumption — "a single result's snippet is already bounded by the existing per-file cap" — was **false**: `query_context` had zero per-file cap at all. `brief.md` alone (49,501 chars) was returned whole on every per-feature query, alongside all 7 ADRs, also uncapped. No total-response number could work well without first fixing this. The fix was extended mid-step (with user sign-off) to add:
1. A per-file cap (8000 chars, reusing the already-proven `capSnippetAtHeadingBoundary` from `resolve_concern`)
2. A total-response cap (60000 chars) that prioritizes a feature's OWN content over repo-wide ADR/`brief.md` content when truncating — discovered necessary after the first cap design (pure oldest-first) was found to drop a feature's own foundational decisions before dropping unrelated cross-cutting architecture content

This was caught by re-running the exact live dogfood case (`query_context` against this repo's own `ab-mcp` feature) at every iteration, not by the acceptance test suite alone — the acceptance fixtures were synthetic and didn't expose the brief.md/ADR scale problem. Full root-cause writeup: `docs/feature/tool-output-quality/distill/upstream-issues.md`.

A 5th fix (not originally scoped) was added during the post-merge gate: `classify-structure.ts` was excluding `deliver` from triggering a misleading "file could not be read" warning, since DELIVER produces `execution-log.json`, never `wave-decisions.md` — a side effect of slice 03 only surfaced once `deliver`-phase detection started actually working.

## Key Decisions
- Total-response cap layered with per-file cap (both needed; neither alone was sufficient)
- Truncation priority: feature-specific content before repo-wide ADR/brief.md content, oldest-first within each group
- `list_concerns` stoplist: heading-text only, case-insensitive exact match, never directory/ADR names
- `list_features` deliver detection: requires `execution-log.json` with ≥1 `COMMIT`-phase entry, not mere directory existence
- `resolve_concern`'s nudge: unconditional text, no check for whether `list_concerns` would itself be empty

## Quality Gates
- 520/520 tests passing
- Architecture constraints clean (dependency-cruiser)
- Mutation score: 87.92% project-wide; `concern-matcher.ts` 86.04% (initially 75.21% — below the 80% gate after this round's new code, closed with 17 added tests, no production changes), `format-response.ts` 87.65%
- DES integrity: 4/4 steps with complete traces
- Live dogfood confirmed all 4 KPIs:
  - KPI-TOQ-1: `list-concerns` feature's `query_context` response: 97,705 → 55,708 chars
  - KPI-TOQ-2: `list_concerns()` candidates: 96 → 78, generic headers gone
  - KPI-TOQ-3: `deliver` phase correctly shown for all 4 features with committed DELIVER waves (including this round itself, mid-delivery)
  - KPI-TOQ-4: `resolve_concern`'s nudge text confirmed present
