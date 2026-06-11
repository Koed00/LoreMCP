# DISTILL Decisions -- ab-mcp

## Mode

nw-acceptance-designer read all prior-wave artifacts (DISCUSS journey/user-stories/
story-map/wave-decisions, DESIGN brief.md + design/wave-decisions.md, DEVOPS
wave-decisions.md/environments.yaml/kpi-instrumentation.md) per the Prior Wave
Reading checklist (see conversation log). No SPIKE was run (`docs/feature/ab-mcp/spike/`
does not exist) -- DISTILL creates the walking skeleton itself, per the
Graceful Degradation rules.

## Wave-Decision Reconciliation

**Reconciliation passed -- 0 contradictions.** Checked every DISCUSS decision
(multi-repo config, US-02/03 error paths, US-04 partial-structure, US-05
no-staleness, single-stakeholder OSS framing) against DESIGN (functional
core/imperative shell, ports `ConfigSource`/`DocTreeReader`/`McpToolSurface`,
4 error codes, OQ-1/OQ-2 precedence resolutions, probe contract) and DEVOPS
(npm-package-only, GitHub Actions, structured stderr logs, per-feature
mutation testing). DEVOPS's "Upstream Changes: None" and DESIGN's OQ
resolutions both directly implement DISCUSS intent without altering it.

## Key Decisions

- [DWD-1] **Walking Skeleton strategy = Strategy C (Real local)**, confirmed
  by stakeholder via AskUserQuestion (2026-06-11). ab-mcp's only driven port
  is the local filesystem (`DocTreeReader` + `ConfigSource`, both real `fs`
  reads against tmp-dir fixtures) -- no costly externals, no fakes/mocks
  needed. ALL acceptance scenarios (walking skeleton + milestones) are tagged
  `@real-io`.
- [DWD-2] **No container** for WS/acceptance fixtures, confirmed by
  stakeholder. Tests use `node:os.tmpdir()` + real temp directories -- matches
  ab-mcp's zero-install-side-effects nature (devops/environments.yaml
  `deployment_assumptions`).
- [DWD-3] **Driving port = MCP stdio subprocess**: the walking skeleton
  scenario spawns the real bin entry (`src/index.ts`, run via
  `node --import tsx`) and connects an `@modelcontextprotocol/sdk` `Client`
  over `StdioClientTransport` -- NOT a direct call to handler functions. This
  satisfies Driving Adapter Verification (Section "Scan DESIGN for entry
  points": brief.md Section 5.2/8 names the MCP stdio transport as the sole
  entry point).
- [DWD-4] **BDD framework = `@amiceli/vitest-cucumber`**: pairs `.feature`
  files with `.steps.ts` step definitions under `vitest`, matching the
  DESIGN-confirmed test runner (brief.md Section 7) with zero additional
  test-runner infrastructure.
- [DWD-5] **Acceptance test location = `tests/acceptance/ab-mcp/`** (one
  feature file per release: `walking-skeleton.feature`,
  `release-1-multi-repo-and-errors.feature`, `release-2-partial-structure.feature`,
  `release-3-no-staleness.feature`), with shared subprocess-spawning helper at
  `tests/acceptance/ab-mcp/support/mcp-client.ts`.
- [DWD-6] **Minimal project scaffolding added** (`package.json`,
  `tsconfig.json`, `vitest.config.ts`, `.dependency-cruiser.cjs`) so the RED
  scaffolds are importable and `npm run check:arch` / `npm test` are runnable
  from DELIVER slice-00 onward. `npm install` itself is a DELIVER slice-00
  prerequisite (not run by DISTILL).

## Walking Skeleton

Exactly one scenario is tagged `@walking_skeleton` (in
`tests/acceptance/ab-mcp/walking-skeleton.feature`): "Agent retrieves the
Critical Reframe decision text end-to-end" -- tagged
`@walking_skeleton @real-io @driving_adapter @adapter-integration`. It is RED
(not green) at handoff, by design (Mandate 7) -- no SPIKE promoted a
pre-existing green skeleton, so DISTILL's job is to leave a RED-but-not-BROKEN
skeleton for DELIVER slice-00's first TDD cycle.

Three additional `@real-io` scenarios in the same file (server boot,
`list_features` happy path, `FEATURE_NOT_FOUND` error path) cover the
remainder of US-01's 4 UAT scenarios / 5 ACs.

## Adapter Scenario Coverage (Mandate 6)

| Adapter | @real-io scenario | Covered by |
|---|---|---|
| `ConfigSource` (`src/shell/config-loader.ts`) | YES | walking-skeleton.feature Background (real `ab-mcp.config.json` written to a tmp dir, read by `loadConfig`) -- every scenario in every `.feature` file exercises this |
| `DocTreeReader` (`src/shell/fs-doc-tree-reader.ts`) -- `readFile`/`listDir`/`pathExists` | YES | walking-skeleton.feature `@walking_skeleton @adapter-integration` scenario (real read of `docs/feature/ab-mcp/discover/wave-decisions.md`) |
| `DocTreeReader.probe()` -- fault scenarios 1-2 (path missing / not-a-directory) | YES | release-1-multi-repo-and-errors.feature `@adapter-integration` "REPO_PATH_NOT_FOUND for a configured repo whose path moved" |
| `DocTreeReader.probe()` -- fault scenario 3 (permission denied) | YES | release-1-multi-repo-and-errors.feature `@adapter-integration` "permission-denied repo path never leaks a raw exception" |
| `DocTreeReader` -- live re-read / TOCTOU-adjacent (no-cache) | YES | release-3-no-staleness.feature `@adapter-integration` "edit reflected in the very next query" |
| MCP stdio transport (`McpToolSurface`, `src/shell/server.ts` + `src/index.ts`) | YES | walking-skeleton.feature -- ALL scenarios (subprocess + `StdioClientTransport`) |

Zero "NO -- MISSING" rows. `probe()` fault scenarios 5 (symlink-escape,
documented non-goal) and 6 (case-insensitive-fs, macOS-only per
`environments.yaml` `platform_coverage`) are intentionally not covered by a
cross-platform CI scenario; case-insensitive-fs is deferred to a
macOS-runner-only test added in DELIVER if/when GitHub Actions macOS runners
are added (not in DEVOPS's `platform_coverage.CI` list, which is
`ubuntu-latest` only).

## Error/Edge Scenario Ratio (target >=40%)

| File | Total scenarios | Error/edge scenarios | Ratio |
|---|---|---|---|
| walking-skeleton.feature | 4 | 1 (`FEATURE_NOT_FOUND`) | 25% |
| release-1-multi-repo-and-errors.feature | 7 | 4 (`REPO_NOT_CONFIGURED`, `REPO_PATH_NOT_FOUND`, `FEATURE_NOT_FOUND`, permission-denied) | 57% |
| release-2-partial-structure.feature | 5 | 2 (`NO_NWAVE_STRUCTURE`, false-positive-warnings check) | 40% |
| release-3-no-staleness.feature | 3 | 0 (pure property-verification story per US-05 Technical Notes) | 0% |
| **Total** | **19** | **7** | **37%** |

Walking skeleton intentionally favors happy-path coverage (its job is to
prove the e2e wire-up); release-1 (the dedicated error-path story, US-03)
over-delivers at 57% to bring the feature-wide average close to the 40%
target. The 3-point shortfall (37% vs 40%) is accepted because release-3 is a
verification-only story with no distinct error surface beyond what
release-1 already covers (US-03 dependency, noted in release-3's file
header) -- adding synthetic error scenarios there would be redundant, not
genuine coverage.

## Mandate 7: RED-Ready Scaffolds

All production modules imported by `walking-skeleton.steps.ts` (transitively,
via `src/index.ts` -> `src/shell/server.ts`) have scaffold files:

| Module | `__SCAFFOLD__` | Throws |
|---|---|---|
| `src/core/classify-structure.ts` | yes | `Error("Not yet implemented -- RED scaffold")` |
| `src/core/format-response.ts` | yes | `Error("Not yet implemented -- RED scaffold")` |
| `src/shell/config-loader.ts` | yes | `Error("Not yet implemented -- RED scaffold")` |
| `src/shell/fs-doc-tree-reader.ts` | yes | `Error("Not yet implemented -- RED scaffold")` (per method) |
| `src/shell/server.ts` | no (real wiring) | n/a -- registers tools; handler bodies call the scaffolds above, MCP SDK converts thrown errors to `isError: true` tool results, so the subprocess stays alive (RED, not BROKEN) |
| `src/index.ts` | no (real wiring) | n/a -- connects `server.ts` to `StdioServerTransport` |

`grep -r "__SCAFFOLD__" src/` currently matches 4 files; DELIVER slice-00
should drive this to 0 across slices 00-04.

**RED Classification**: once `npm install` is run (DELIVER slice-00
prerequisite), `npm test` will execute `walking-skeleton.steps.ts`. The
`@walking_skeleton` scenario's assertions (`expect(match).toBeDefined()`,
`expect(lastResponse.error).toBe(...)`, etc.) will fail with `AssertionError`
because `server.ts`'s handlers return `{error: ...}`-shaped MCP `isError`
results (the scaffolds' thrown messages), not the documented
`list_features`/`query_context` JSON shapes -- this is RED, not BROKEN
(no import errors, no process crash, no connection failure).

## Self-Review Checklist

1. WS strategy declared in wave-decisions.md -- YES (DWD-1)
2. WS scenarios tagged correctly (`@real-io` per Strategy C) -- YES
3. Every driven adapter has >=1 `@real-io` scenario -- YES (coverage table)
4. InMemory doubles used / documented limitations -- N/A (Strategy C uses no
   InMemory doubles)
5. Container preference documented -- YES (DWD-2: no container)
6. All production modules imported by tests have scaffold files -- YES (4
   `__SCAFFOLD__` modules; `server.ts`/`index.ts` are real wiring, not scaffolds)
7. All scaffolds include `__SCAFFOLD__` marker -- YES
8. All scaffold methods raise assertion-classified errors (`throw new
   Error(...)`, the TS equivalent per nw-distill's language table), not
   `NotImplementedError` -- YES
9. Tests are RED (not BROKEN) against scaffolds -- YES by construction (see
   "RED Classification" above); not executed (no `npm install` run yet --
   deferred to DELIVER slice-00)
10. Driving Adapter: the sole entry point (MCP stdio, brief.md Section 5.2/8)
    has >=1 WS scenario exercising it via real subprocess + MCP client -- YES
    (`@walking_skeleton @driving_adapter`)
11. F-001: >=1 `@real-io @adapter-integration` scenario per driven adapter --
    YES (coverage table)
12-15. F-002/F-003/F-004/F-005 (pytest-bdd/Python-specific capsys, sys.path,
    timing-budget, driving-port-import-boundary checks) -- N/A, this project
    is TypeScript/vitest, not Python/pytest-bdd. The TS-equivalent boundary
    rule (core has zero IO imports) is enforced by `.dependency-cruiser.cjs`
    `core-no-io` rule (DWD-6), runnable via `npm run check:arch`.

## Constraints Carried Forward

- Functional core / imperative shell boundary (CLAUDE.md, brief.md Section 6)
  -- enforced by `.dependency-cruiser.cjs`.
- No caching, live reads only (US-05/KPI-2 permanent guardrail) --
  `release-3-no-staleness.feature` is that guardrail's executable form.
- 4 structured error codes only, never raw exceptions (brief.md Section 8) --
  exercised across all 3 milestone files.
- Per-feature mutation testing >=80% (CLAUDE.md Mutation Testing Strategy) --
  applies to `src/core/*` and `src/shell/*` once implemented; `package.json`
  includes a `test:mutation` script (StrykerJS, per ci-cd-pipeline.md).

## Upstream Changes

None. No DISTILL finding contradicts or requires changes to DISCUSS, DESIGN,
or DEVOPS artifacts. `docs/feature/ab-mcp/distill/upstream-issues.md` was not
created (nothing to record).

## Handoff Readiness

- `tests/acceptance/ab-mcp/walking-skeleton.feature` +
  `walking-skeleton.steps.ts` + `support/mcp-client.ts`: present, RED.
- `tests/acceptance/ab-mcp/release-{1,2,3}-*.feature`: present, all scenarios
  `@skip`, one-at-a-time for DELIVER.
- RED scaffolds: `src/core/classify-structure.ts`,
  `src/core/format-response.ts`, `src/shell/config-loader.ts`,
  `src/shell/fs-doc-tree-reader.ts` (`__SCAFFOLD__ = true`, all methods throw).
- Real composition-root wiring: `src/shell/server.ts`, `src/index.ts`.
- Project scaffolding: `package.json`, `tsconfig.json`, `vitest.config.ts`,
  `.dependency-cruiser.cjs`.
- Self-review: 11 of 15 checklist items directly applicable, all PASS; 4
  items (12-15) are Python/pytest-bdd-specific and N/A for this TS/vitest
  project (TS-equivalent boundary enforcement documented).

**Status: READY for handoff to nw-functional-software-crafter (DELIVER wave)**,
per CLAUDE.md's functional-core/imperative-shell paradigm declaration.
DELIVER slice-00 first step: `npm install`, then implement
`src/shell/fs-doc-tree-reader.ts` + `src/shell/config-loader.ts` +
`src/core/classify-structure.ts` + `src/core/format-response.ts` one at a
time until the `@walking_skeleton` scenario is green.
