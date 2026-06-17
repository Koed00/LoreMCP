# Outcome KPIs -- concern-based-querying

## Feature: concern-based-querying (Concern-Based Cross-Repo Querying)

### Objective

By the end of this feature's delivery, an AI coding agent working on a new feature in any configured repo can orient itself to the platform landscape — finding who owns a concern, what constraints apply, and what has been tried — using only a single `resolve_concern()` tool call, without knowing the repo or feature_id upfront.

### Outcome KPIs

| # | Who | Does What | By How Much | Baseline | Measured By | Type |
|---|-----|-----------|-------------|----------|-------------|------|
| KPI-CBQ-1 | AI coding agent given a concern topic (e.g., "auth", "data persistence") | Retrieves authoritative owner repo, binding decisions, and relevant ADRs via `resolve_concern()` alone — zero manual file navigation | >=80% task completion rate for representative concern questions answered via tool-call-only | 0% — no concern-based querying exists today; agents must already know repo+feature_id | Manual test session: N concern questions asked, M answered via resolve_concern only | Leading |
| KPI-CBQ-2 | AI coding agent reading a resolve_concern response | Correctly identifies when grounding is feature-level vs ADR-only — avoids presenting partial context as complete | 100% of partial-structure queries include a warning describing the gap (verified across 3 fixture completeness levels: full / ADR-only / CLAUDE.md-only) | 0% — no partial-structure warning for concern queries today | Automated test suite: 1 full-structure + 1 ADR-only + 1 CLAUDE.md-only fixture, assert warnings content per case | Leading |
| KPI-CBQ-3 | AI coding agent reading rejected_paths in a resolve_concern response | Avoids re-proposing alternatives already ruled out in nWave artifacts | 100% of rejection clauses in fixture nWave artifacts surfaced in rejected_paths when concern matches | 0% — no rejection surfacing today | Automated test suite: 1 test per rejection-pattern keyword × fixture file (6 patterns × 2 fixture files = 12 tests) | Leading |
| KPI-CBQ-4 | resolve_concern responses for all call outcomes (match, partial, no-match, invalid input) | Return structured JSON (matching defined response contracts) — never raw exceptions | 100% of call outcomes return one of the defined response shapes | 0% — capability does not exist | Automated test suite: 1 test per outcome (happy / partial / CONCERN_NOT_FOUND / INVALID_CONCERN / repo-skip) | Leading |
| KPI-CBQ-5 | Content edits to a configured repo's nWave docs | Reflected in the very next resolve_concern call for that concern | 0 staleness incidents — 100% of edits visible on next query, no server restart needed | N/A (same property as KPI-2 in ab-mcp outcome-kpis.md — resolve_concern inherits the live-read guarantee) | Property test: edit source doc → immediate re-query → diff check (same test pattern as US-05) | Guardrail |

### Metric Hierarchy

- **North Star**: KPI-CBQ-1 (task completion rate >=80% for concern questions answered via resolve_concern only) — direct test of whether concern-based querying solves the "I don't know which repo to look in" problem.
- **Leading Indicators**: KPI-CBQ-2 (partial-structure warnings), KPI-CBQ-3 (rejected paths surfaced), KPI-CBQ-4 (error path coverage) — each removes a failure mode that would otherwise drag down KPI-CBQ-1 in real use.
- **Guardrail Metrics**: KPI-CBQ-5 (zero staleness) — must not degrade. resolve_concern inherits ADR-004 (live reads, no cache); any future caching addition must re-verify this property before release.

### Measurement Plan

| KPI | Data Source | Collection Method | Frequency | Owner |
|-----|------------|-------------------|-----------|-------|
| KPI-CBQ-1 | Manual test session against real/mock multi-repo set (same setup as ab-mcp KPI-1 session) | Run N representative concern questions, log tool-call-only success/failure | Once per delivery slice, then ad hoc during dogfood use | Stakeholder (Maria Santos, solo maintainer) |
| KPI-CBQ-2 | Automated test suite (3 mock-repo completeness levels) | Assert warnings content per scenario | Continuous (CI, once CI exists); locally pre-commit | Stakeholder |
| KPI-CBQ-3 | Automated test suite (rejection-pattern fixture files) | Assert rejected_paths content per rejection keyword | Continuous | Stakeholder |
| KPI-CBQ-4 | Automated test suite | One test per outcome shape | Continuous | Stakeholder |
| KPI-CBQ-5 | Property test (same pattern as US-05 in ab-mcp) | Edit source doc, re-query, diff | Once at delivery, then regression-checked if architecture changes | Stakeholder |

### Hypothesis

We believe that a `resolve_concern(concern: string)` tool on the existing lore-mcp server, performing case-insensitive keyword matching across all configured repos' nWave artifacts (wave-decisions.md, ADRs, CLAUDE.md), returning matches ranked by relevance, rejected_paths from rejection clauses, and partial-structure warnings when no feature-level decisions exist, will allow an AI coding agent to orient itself to the platform landscape by concern — without knowing the repo or feature_id upfront.

We will know this is true when an agent answers >=80% of representative concern questions using only resolve_concern() calls (KPI-CBQ-1), 100% of partial-structure queries include appropriate warnings (KPI-CBQ-2), and zero staleness incidents occur (KPI-CBQ-5).

### Connection to ab-mcp KPIs

This feature extends the ab-mcp outcome KPI set (docs/feature/ab-mcp/discuss/outcome-kpis.md):

- KPI-CBQ-1 targets the same "task completion rate" measure as ab-mcp KPI-1, but for concern-based (no-prior-knowledge) queries. A successful resolve_concern result enables a subsequent query_context call — the two tools are complementary, not competing.
- KPI-CBQ-5 is a direct reapplication of ab-mcp KPI-2 (zero staleness). No separate baseline needed — the live-read property is inherited from the existing architecture (ADR-004).
- KPI-CBQ-4 mirrors ab-mcp KPI-4 (error path coverage), extending the error taxonomy with INVALID_CONCERN.
