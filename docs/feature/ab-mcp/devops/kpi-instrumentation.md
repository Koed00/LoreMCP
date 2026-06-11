# KPI Instrumentation -- ab-mcp (DEVOPS)

Source: `docs/feature/ab-mcp/discuss/outcome-kpis.md` (KPI-1 through KPI-5).
Each KPI's "Measured By" / "Collection Method" is mapped here to concrete
instrumentation, all of which is either (a) the structured stderr log from
`observability-design.md`, or (b) the `vitest` test suite -- no new
infrastructure is introduced.

| KPI | Outcome KPI Doc Says | Instrumentation |
|---|---|---|
| **KPI-1** (>=80% task completion via tool-calls-only) | "Manual test session log: N questions asked, M answered via tool-call-only" | Stderr log's `outcome`/`matched_files`/`error_code` fields give a per-call record during the manual session (per `discuss/outcome-kpis.md` Measurement Plan: stakeholder runs N representative cross-repo questions). The maintainer tallies M/N manually from the log -- no automated dashboard needed for a single measurement event per release slice. |
| **KPI-2** (0 staleness incidents) | "Property test (Slice 04): edit -> immediate re-query -> diff check" | Implemented as a `vitest` test in slice-04: write to a fixture doc file, call `query_context`, assert returned content matches the new bytes exactly. The stderr log's `matched_files` + `retrieved_at` (shared artifact) provide a manual cross-check during dogfooding but the property test is the authoritative measurement. |
| **KPI-3** (config scales 3->10+ repos, 0 schema changes) | "Append config entries 4 and 5, run test suite unchanged" | CI-run `vitest` config-validation tests parametrized over a fixture `ab-mcp.config.json` with 5 entries (slice-01 introduces 3; this test extends to 5 without code changes). No new instrumentation -- existing `npm run test` in `ci-cd-pipeline.md` covers it. |
| **KPI-4** (100% error conditions -> structured error shape) | "Test suite: one test per error condition x repo-completeness combination" | `vitest` test matrix: {REPO_NOT_CONFIGURED, REPO_PATH_NOT_FOUND, FEATURE_NOT_FOUND, NO_NWAVE_STRUCTURE} x {full/ADRs-only/CLAUDE.md-only/none fixture repos}. Stderr log `error_code` field lets the maintainer spot-check real invocations match one of the 4 codes during dogfooding. |
| **KPI-5** (100% partial-structure queries include accurate `warnings`) | "Test suite: 1 full + 1 ADRs-only + 1 CLAUDE.md-only repo, assert warnings content" | `vitest` test suite (slice-03 fixtures, the 3 mock-repo completeness levels referenced in `discuss/wave-decisions.md` Upstream Changes #2). Stderr log `warnings` array lets the maintainer verify warning text matches the actual gap during real dogfood queries. |

## Dashboard

No dashboard is built (per `observability-design.md` -- no metrics backend).
"Dashboard" for this feature is:

1. The `vitest` CI run summary (KPI-2 through KPI-5 -- pass/fail per release).
2. A manual session log (free-text notes + grep'd stderr lines) for KPI-1,
   recorded once per release slice per `discuss/outcome-kpis.md` Measurement
   Plan ("Once per release slice (00-04), then ad hoc during dogfood use").

## Guardrail Monitoring (KPI-2)

Per `discuss/outcome-kpis.md` Metric Hierarchy: KPI-2 (zero staleness) is a
**guardrail** -- "If a future caching layer is ever introduced, KPI-2 must be
re-verified before release." DEVOPS records this as a standing CI requirement:
the slice-04 property test for KPI-2 MUST remain in the `vitest` suite
permanently (not removed after slice-04 ships) so any future change that
introduces caching fails CI automatically.
