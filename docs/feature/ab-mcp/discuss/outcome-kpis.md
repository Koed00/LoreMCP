# Outcome KPIs -- ab-mcp

## Feature: ab-mcp (Cross-Repo Context Retrieval, MVP)

### Objective

By the end of MVP build, an AI coding agent working in any configured repo can answer cross-repo "what's the convention/decision for X" questions using only ab-mcp tool calls -- live, attributed, and without manual file navigation -- proving the core retrieval value proposition (O1, O2) is real and the config scales (H4).

### Outcome KPIs

| # | Who | Does What | By How Much | Baseline | Measured By | Type |
|---|-----|-----------|-------------|----------|-------------|------|
| 1 | AI coding agent in Repo A, given a cross-repo question against the mocked/real multi-repo test set | Answers the question using only `list_features`/`query_context` tool calls, with zero manual file navigation by the human | >=80% task completion rate (per H1 target) | 0% (capability does not exist; today = 0% via tool calls, 100% via manual cd/grep) | Manual test session log: N questions asked, M answered via tool-call-only | Leading |
| 2 | A configured source repo's doc file | Reflects an edit in the very next `query_context` call | 0 staleness incidents -- 100% of edits visible on next query, 0 manual sync steps | N/A (current workaround: manually-copied notes go stale within the same quarter) | Property test (Slice 04): edit -> immediate re-query -> diff check | Leading |
| 3 | ab-mcp config | Supports adding repos beyond the initial 3 | 0 code/schema changes required to add repos 4 through 10 | 3 repos configured at MVP (Slice 01) | Manual test: append config entries 4 and 5, run test suite unchanged (per H4) | Leading (secondary) |
| 4 | `query_context` responses for unconfigured/missing repos or feature_ids | Return structured errors (REPO_PATH_NOT_FOUND, FEATURE_NOT_FOUND, NO_NWAVE_STRUCTURE) instead of exceptions or empty/silent results | 100% of error conditions return one of the 3 defined structured error shapes | 0% (capability does not exist) | Test suite: one test per error condition x repo-completeness combination | Leading |
| 5 | `query_context` responses for repos with partial nWave structure (ADRs-only, CLAUDE.md-only) | Include an accurate `warnings` array describing what's missing | 100% of partial-structure queries include a warning matching the actual gap (verified across the 3 mock-repo completeness levels in Slice 03) | 0% (capability does not exist) | Test suite: 1 full-structure + 1 ADRs-only + 1 CLAUDE.md-only repo, assert warnings content | Leading |

### Metric Hierarchy

- **North Star**: KPI-1 (task completion rate >=80% for cross-repo questions answered via tool-call-only) -- this is the direct test of H1 and the core "does this solve the problem" signal.
- **Leading Indicators**: KPI-3 (config scaling), KPI-4 (error path coverage), KPI-5 (warning accuracy) -- each removes a specific failure mode that would otherwise drag down KPI-1 in real use.
- **Guardrail Metrics**: KPI-2 (zero staleness) -- must not degrade. If a future caching layer is ever introduced, KPI-2 must be re-verified before release; staleness was the explicit "worse than no memory" failure mode in DISCOVER evidence.

### Measurement Plan

| KPI | Data Source | Collection Method | Frequency | Owner |
|-----|------------|-------------------|-----------|-------|
| KPI-1 | Manual test session against real/mock multi-repo set (per solution-testing.md test plan) | Run N representative cross-repo questions, log tool-call-only success/failure | Once per release slice (00-04), then ad hoc during dogfood use | Stakeholder (solo maintainer) |
| KPI-2 | Property test (Slice 04) | Edit source doc, re-query, diff | Once at Slice 04, then regression-checked if architecture changes | Stakeholder |
| KPI-3 | Config file + test suite | Append repo entries, run existing tests unchanged | Once at Slice 01, re-verify before any 1.0 release | Stakeholder |
| KPI-4 | Automated test suite | One test per error condition | Continuous (CI, once CI exists) | Stakeholder |
| KPI-5 | Automated test suite (3 mock-repo completeness levels) | Assert warnings content per scenario | Continuous (CI, once CI exists) | Stakeholder |

### Hypothesis

We believe that a local, read-only MCP server exposing `list_features()` and `query_context(repo_name, feature_id)` against a list-based config of `{repo-name, doc-path}` entries, reading nWave-structured docs (wave-decisions.md/feature-delta.md, ADRs, CLAUDE.md) live with no caching, for an AI coding agent working in a different repo, will achieve cross-repo context grounding without manual copy-paste and without staleness.

We will know this is true when an agent answers >=80% of representative cross-repo questions using only ab-mcp tool calls (KPI-1), zero staleness incidents occur (KPI-2), and the config scales from 3 to 10+ repos with zero code changes (KPI-3).
