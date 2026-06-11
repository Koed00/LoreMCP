# Prioritization: ab-mcp

## Release Priority

| Priority | Release | Target Outcome | KPI | Rationale |
|----------|---------|---------------|-----|-----------|
| 1 | Walking Skeleton (Slice 00) | End-to-end retrieval flow works against real docs | KPI-1 (task completion) | Validates core architecture (config -> fs read -> MCP response) before adding complexity. Riskiest assumption: does the basic plumbing work at all? |
| 2 | Multi-Repo Config (Slice 01) | Config scales to 3 repos, retrieval generalizes | KPI-3 (config scaling), KPI-1 | Directly tests H4 (3->10+ scaling) and proves O1 isn't a 1-repo special case |
| 3 | Error Paths (Slice 02) | Agent gets actionable errors, never silent failure | KPI-1, KPI-4 (zero hallucination on missing data) | H1 requires "zero manual file navigation" even when things go wrong -- error UX is part of the core value prop |
| 4 | Partial Structure (Slice 03) | Agent gets accurate partial context + caveats for incomplete nWave repos | KPI-5 (warning accuracy) | Addresses D-retrieval-risk, the flagged open feasibility question -- highest remaining uncertainty |
| 5 | No-Staleness Verification (Slice 04) | Live reads confirmed, zero staleness | KPI-2 (staleness incidents = 0) | Lowest new-build effort (verification of design choice already made in Slices 00-01); H2 risk mitigated by construction |

## Backlog Suggestions

| Story | Release | Priority | Outcome Link | Dependencies |
|-------|---------|----------|-------------|--------------|
| US-01 | Walking Skeleton | P1 | KPI-1 | None |
| US-02 | Release 1 | P2 | KPI-1, KPI-3 | US-01 |
| US-03 | Release 1 | P3 | KPI-1, KPI-4 | US-02 |
| US-04 | Release 2 | P4 | KPI-5 | US-02, US-03 |
| US-05 | Release 3 | P5 | KPI-2 | US-01 (or US-02) |

## Out of Scope (carried forward, not backlog items for this feature)

- O6: Ownership/boundary mapping (value prop 2) -- future iteration per D-scope
- D-bootstrap: CLAUDE.md auto-injection -- manual for MVP
- D-retrieval-risk SPIKE: candidate for DESIGN wave if Slice 03 reveals warnings are insufficient
