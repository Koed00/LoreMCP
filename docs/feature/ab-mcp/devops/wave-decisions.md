# DEVOPS Decisions -- ab-mcp

## Mode

Apex (nw-platform-architect) read DESIGN's `wave-decisions.md` and brief.md
Application Architecture section (npm package, single Node.js process, stdio
MCP transport, no caching, no external integrations) plus DISCUSS's
`outcome-kpis.md`. Given the architecture, most standard DEVOPS questions
(cloud target, container orchestration, deployment strategy, continuous
learning) collapse to "not applicable" -- confirmed with stakeholder via
AskUserQuestion (2026-06-11) rather than defaulted.

## Key Decisions

- [D1] **Deployment target = npm package only**: ab-mcp has no server/cloud
  component (per brief.md C4 diagrams) -- "deployment" is `npm publish` of a
  versioned package. (see: `platform-architecture.md`)
- [D2] **Container orchestration = none**: no long-running service exists.
  (see: `platform-architecture.md`)
- [D3] **CI/CD = GitHub Actions**: standard for OSS TS/npm, integrates with
  `npm publish`/`vitest`/`dependency-cruiser`. (see: `ci-cd-pipeline.md`)
- [D4] **Existing infrastructure = none (greenfield)**: confirmed -- no
  `src/`, no prior `docs/product/architecture/` (consistent with DESIGN's
  Greenfield Confirmation). (see: `platform-architecture.md`)
- [D5] **Deployment strategy = N/A (versioned release)**: blue-green/canary/
  rolling/recreate concepts don't map to a CLI/library artifact; each
  `npm publish` is an independent immutable semver release. (see:
  `platform-architecture.md`)
- [D6] **Continuous learning = not applicable**: single-stakeholder OSS, no
  live monitoring/alerting infra to build experimentation on top of. (see:
  `platform-architecture.md`)
- [D7] **Observability = structured stderr logs only**: stdout is reserved
  for the MCP JSON-RPC stream; one structured JSON line per tool call to
  stderr, schema designed to support KPI-1/4/5 manual verification during
  dogfooding. No metrics backend, no dashboards, no tracing, no alerting.
  (see: `observability-design.md`)
- [D8] **Git branching = GitHub Flow**: `main` always releasable, feature
  branches named `slice-NN-{name}` tracing to DISCUSS slice briefs, PR-gated
  CI. (see: `branching-strategy.md`)
- [D9] **Mutation testing = per-feature**, kill-rate gate >=80%, scoped to
  files modified per slice. Persisted to root `CLAUDE.md` under
  `## Mutation Testing Strategy`. (see: `ci-cd-pipeline.md`)

## Infrastructure Summary

- **Deployment**: npm package (`npx ab-mcp` / local dependency), no
  deployment target/orchestration/strategy beyond semver-tagged npm releases.
- **CI/CD**: GitHub Actions, GitHub Flow branching. Pipeline: install ->
  typecheck -> `dependency-cruiser` arch check -> `vitest` (unit+integration)
  -> per-feature mutation testing (>=80% kill rate, scoped to changed files)
  -> build -> (on tag) npm publish behind manual approval.
- **Observability**: structured JSON stderr logs (`tool`, `args`, `outcome`,
  `warnings`, `error_code`, `matched_files`, `duration_ms`); no
  metrics/tracing/alerting infrastructure.
- **Mutation testing**: per-feature, >=80% kill rate, written to CLAUDE.md.

## KPI Instrumentation

All 5 outcome KPIs (`discuss/outcome-kpis.md`) are mapped to either the
`vitest` test suite (KPI-2 through KPI-5, all CI-enforced) or a manual
session log read against the structured stderr output (KPI-1, once per
release slice). KPI-2 (zero staleness) is flagged as a **permanent guardrail
test** -- must remain in the suite even after slice-04 ships, so any future
caching addition fails CI. See `kpi-instrumentation.md` for the full mapping
table.

## Environment Inventory

`environments.yaml` reframes the standard "install environment" template
around the **filesystem states** the Doc-Tree Scanner / Content Extractor
must handle gracefully (clean, repo-not-configured, repo-path-not-found,
not-a-directory, permission-denied, the 3 partial-nWave completeness levels
from Slice 03, no-nwave-structure, the OQ-2 fallback case, live-edit/
no-staleness for Slice 04, and case-insensitive-fs for macOS). All 11
environments are read-only scenarios (ab-mcp never writes) -- teardown is
just deleting fixture directories. Every filesystem-state environment must be
exercised against the `DocTreeReader.probe()` contract (brief.md Section 9)
before being wired into the public tools.

## Constraints Established

- No metrics/tracing/alerting infrastructure is to be introduced for this
  feature -- if a future hosted/multi-user mode is proposed, observability
  design must be revisited (out of scope per DISCOVER `D-scope`).
- KPI-2's staleness property test is a permanent CI guardrail, not a
  one-time slice-04 check.
- `NPM_TOKEN` is the only CI secret; publish job requires manual approval
  gate (GitHub Environments protection or `workflow_dispatch`).
- Mutation testing tooling choice (e.g., StrykerJS) is deferred to DELIVER
  slice-00 setup -- only the per-feature/>=80% policy is binding from DEVOPS.

## Upstream Changes

None. DESIGN's architecture (single-process npm package, stdio transport, no
caching, no external integrations, functional-core/imperative-shell with
dependency-cruiser enforcement) required no changes -- DEVOPS decisions are
direct consequences of that architecture, not corrections to it.

## Peer Review

Self-review conducted (no separate reviewer agent dispatch, consistent with
prior waves' approach):

- **CI/CD correctness/completeness**: pipeline stages cover every binding
  constraint from DESIGN (architecture boundary check, no-cache guardrail via
  KPI-2 permanent test, all 4 error shapes tested per KPI-4). PASS.
- **Environment inventory coverage**: all 6 `DocTreeReader.probe()`
  fault-injection scenarios from brief.md Section 9 (path missing,
  not-a-directory, permission-denied, TOCTOU/live-edit, symlink-escape
  [documented as non-goal in DESIGN, intentionally not listed as a separate
  environment], case-insensitive-fs) map to an `environments.yaml` entry,
  plus all 4 structured-error / partial-result outcomes from Decision 5's
  precedence order. PASS.
- **Observability alignment with outcome KPIs**: every KPI in
  `discuss/outcome-kpis.md` has an explicit instrumentation mapping in
  `kpi-instrumentation.md`, with no new infrastructure proposed beyond what
  the architecture already implies (stderr, vitest). PASS.
- **Infrastructure security / deployment soundness**: zero secrets beyond
  `NPM_TOKEN` (matches DESIGN's "External integrations: NONE"); read-only
  architecture means no rollback/teardown complexity; manual approval gate on
  publish prevents accidental releases. PASS.

**Verdict: APPROVED.** No critical/high issues identified.

## Handoff Readiness

- `environments.yaml`: present, 11 target environments + coexistence matrix +
  platform coverage + deployment assumptions.
- CI/CD pipeline: documented (`ci-cd-pipeline.md`).
- Branching strategy: documented (`branching-strategy.md`), CLAUDE.md not
  modified for this (no project convention beyond what's in
  branching-strategy.md itself).
- Mutation testing strategy: documented and persisted to root `CLAUDE.md`
  (`## Mutation Testing Strategy`, per-feature, >=80%).
- Observability + KPI instrumentation: documented
  (`observability-design.md`, `kpi-instrumentation.md`).
- Peer review: APPROVED (self-review, 1 iteration, 0 issues).

**Status: READY for handoff to nw-acceptance-designer (DISTILL wave).**
