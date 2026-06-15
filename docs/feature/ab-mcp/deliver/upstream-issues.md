# DELIVER Upstream Issues — ab-mcp

## Issue 1: walking-skeleton.feature scenario 4 contradicts brief.md Decision 5 / OQ-2

**Discovered**: Step 01-05 (server.ts composition root wiring), GREEN phase.

**Source documents**:
- `tests/acceptance/ab-mcp/walking-skeleton.feature` (DISTILL artifact), Scenario
  "Agent receives a clear error for a feature that does not exist yet"
- `docs/product/architecture/brief.md` Decision 5 / OQ-2 (DESIGN artifact,
  stakeholder-confirmed)

**Contradiction**:

The walking-skeleton scenario calls `query_context(repo="ab-mcp",
feature="nonexistent-feature")` against this repo's own `docs/` (the dogfood
fixture shared by the whole walking skeleton) and expects outcome
`FEATURE_NOT_FOUND`.

Brief.md Decision 5 / OQ-2 (RESOLVED, CONFIRMED) states: if
`docs/feature/{feature_id}/` does not exist but the repo has ADRs and/or
`CLAUDE.md`, the response is `PARTIAL` (with warnings), **never**
`FEATURE_NOT_FOUND`. This repo has both `docs/product/architecture/*.md` and
`CLAUDE.md`, so per OQ-2 the scenario is structurally unsatisfiable as written
-- `classifyStructure` (implemented step 01-03, with unit tests covering this
exact OQ-2 rule) correctly returns `PARTIAL`, and `query_context` returns a
successful (non-error) response with `lastResponse.error === undefined`.

**Resolution (user-confirmed 2026-06-15)**: Drop scenario 4 from
`walking-skeleton.feature` entirely. `FEATURE_NOT_FOUND` is already covered
with a proper non-fallback fixture by
`tests/acceptance/ab-mcp/release-1-multi-repo-and-errors.feature` (per
DISTILL's adapter/error coverage table -- release-1 is the dedicated
error-path story at 57% error-ratio). Walking-skeleton.feature reduces to 3
scenarios (walking skeleton + server boot/tool listing + list_features happy
path), all GREEN, removing the contradiction without losing coverage.

**Action**: re-run step 01-05 GREEN phase after removing scenario 4 and its
now-unused step definitions from `tests/acceptance/ab-mcp/walking-skeleton.steps.ts`.
