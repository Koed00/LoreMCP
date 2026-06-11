# Opportunity Solution Tree -- ab-mcp

## Desired Outcome

Minimize the time and risk for an agent working in one repo to ground its context using accurate, current documentation from other repos in the same multi-repo platform -- without manual copy-paste and without staleness.

## Opportunities (Mapped from Interview Insights)

Scoring uses the Opportunity Algorithm: **Score = Importance + Max(0, Importance - Satisfaction)**, both 1-10, derived from the single-stakeholder evidence (Q3-Q6). Given single-stakeholder input, scores reflect the stakeholder's stated importance and satisfaction with current alternatives, to be re-validated with broader sampling post-MVP.

| # | Opportunity | Importance | Satisfaction (current) | Score | Priority |
|---|------------|-----------|------------------------|-------|----------|
| O1 | Retrieve relevant doc snippets from other configured repos on demand (cross-repo context grounding) | 9 | 1 | 9 + 8 = **17** | Pursue (Top) |
| O2 | Avoid staleness from manually-copied CLAUDE.md/notes between repos | 9 | 1 | 9 + 8 = **17** | Pursue (Top) |
| O3 | Reduce discovery cost of finding the "right" doc/ADR within another repo | 7 | 2 | 7 + 5 = **12** | Pursue |
| O4 | Scale config to reference 3 -> 10+ repos without redesign | 6 | 3 | 6 + 3 = **9** | Pursue |
| O5 | Handle varying doc maturity across repos (full nWave vs. loose ADR dumps) | 7 | 2 | 7 + 5 = **12** | Pursue |
| O6 | Resolve ownership/boundary mapping (which repo owns which concern) | 8 | 2 | 8 + 6 = **14** | Evaluate (Deferred -- future upgrade per D-scope) |
| O7 | Auto-sync/notify when source repo docs change | 5 | 1 | 5 + 4 = **9** | Backlog |

## Top Opportunities Selected for MVP (Top 2-3, all score >8)

1. **O1 -- Cross-repo doc snippet retrieval** (score 17): Core MVP capability. Directly maps to validated value prop 1 (context grounding).
2. **O2 -- Eliminate staleness from copy-paste** (score 17): The negative outcome that made the current alternative actively harmful. MVP must retrieve live/current docs, not cached copies.
3. **O5 -- Handle varying doc maturity** (score 12, tied with O3): Without this, MVP only works for "ideal" nWave repos, excluding the loosely-structured frontend repo scenario explicitly described in evidence.

O3 (discovery cost / relevance) is treated as a quality dimension of O1's solution rather than a separate solution track -- folded into O1's solution design (retrieval must be relevance-aware, not just "dump entire folder").

O4 (config scalability) is a non-functional constraint applied to O1's solution design (see D-config in wave-decisions.md), not a standalone opportunity requiring its own solution idea.

## OST Structure

```
Desired Outcome: Agent grounds context using accurate, current cross-repo docs
  |
  +-- O1: Cross-repo doc snippet retrieval (score 17) -- TOP
  |     +-- Solution Idea A: MCP tool that lists configured repo doc-paths and exposes a "query/search" tool returning relevant snippets
  |     +-- Solution Idea B: MCP tool that exposes a "list docs" + "fetch doc" pair (browse then retrieve)
  |     +-- Solution Idea C: Hybrid -- semantic search across configured repos' docs, returning ranked snippets with source attribution
  |
  +-- O2: Eliminate staleness (score 17) -- TOP
  |     +-- Solution Idea D: Always read live from configured filesystem paths (no caching/copying) at query time
  |     +-- Solution Idea E: Cache with mtime-based invalidation, refresh on each query
  |
  +-- O5: Handle varying doc maturity (score 12) -- TOP
  |     +-- Solution Idea F: Structured parser for full nWave docs (wave-decisions.md, ADRs, CLAUDE.md, feature-delta.md) + generic fallback for loosely-structured folders
  |     +-- Solution Idea G: Treat all docs as flat searchable text corpus regardless of structure (structure-agnostic, lowest complexity)
  |
  +-- O6: Ownership/boundary mapping (score 14) -- DEFERRED (future upgrade, out of MVP scope per D-scope)
        +-- (Solution ideas not generated for MVP -- revisit post-MVP)
```

## Solution Diversity Check

For O1, three genuinely different solution architectures were generated (list+fetch browsing vs. query/search vs. semantic ranked retrieval) rather than minor variations -- satisfies "seek real diversity" principle. For O2, two different staleness-avoidance strategies (always-live read vs. cache+invalidation) represent a real architectural trade-off (simplicity vs. performance) to be tested in Solution Testing.

## G2 Gate Evaluation: Opportunity -> Solution

| Criterion | Target | Result | Status |
|-----------|--------|--------|--------|
| Opportunities identified | 5+ distinct | 7 distinct opportunities mapped | PASS |
| Top 2-3 scores | >8 | O1=17, O2=17, O5=12 (all >8) | PASS |
| Job step coverage | 80%+ | Locate, Prepare, Confirm, Monitor steps covered (4/5 mapped job steps; "Define" partially covered by O3 folded into O1) | PASS (approx. 80%) |
| Stakeholder/team alignment | Confirmed | Single-stakeholder OSS context -- stakeholder is the decision-maker; alignment confirmed via Q5/Q6 explicit scoping decisions | PASS (with single-stakeholder caveat) |

**Gate Decision**: PROCEED to Solution Testing, scoped to O1 + O2 + O5 (value prop 1 / context grounding only). O6 (ownership mapping, value prop 2) explicitly deferred per D-scope.
