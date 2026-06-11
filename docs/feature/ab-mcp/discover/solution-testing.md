# Solution Testing -- ab-mcp

## Scope

Per `D-scope` (wave-decisions.md), solution testing covers ONLY value prop 1 (cross-repo context grounding). Ownership/boundary mapping (value prop 2) is out of scope.

## Hypotheses

### H1 -- Retrieval Without Manual Copy-Paste

```
We believe providing an MCP tool that retrieves relevant doc snippets from
configured external repos for an agent operating in the current repo
will achieve elimination of manual cd/grep/copy/paste workflows for
cross-repo context.

We will know this is TRUE when an agent in a mocked "current repo" can
answer a cross-repo question (e.g., "what does the backend's pagination
ADR say?") using only ab-mcp tool calls, with zero manual file navigation
by the human.

We will know this is FALSE when the agent still requires the human to
manually open/search the other repo's files to find the answer, or when
retrieved snippets are irrelevant/incomplete >20% of the time.
```

**Risk category**: Value + Usability
**Risk score**: Impact (3, MVP fails if wrong) x3 + Uncertainty (2, mixed -- single stakeholder evidence only) x2 + Ease (1, days to spike with mocked repos) x1 = **9 + 4 + 1 = 14** -> Test First

### H2 -- No Staleness (Live Reads)

```
We believe always reading configured doc paths live at query time (not
caching/copying into the current repo) will achieve zero staleness
between retrieved context and the source repo's actual current state.

We will know this is TRUE when a change made to a source repo's doc file
is reflected in ab-mcp's next query response without any manual sync step.

We will know this is FALSE when retrieved snippets reflect outdated
content after a source repo doc has changed.
```

**Risk category**: Value + Feasibility
**Risk score**: Impact (3) x3 + Uncertainty (1, low -- live filesystem reads are straightforward) x2 + Ease (1, days) x1 = **9 + 2 + 1 = 12** -> Test First

### H3 -- Works Across Varying Doc Maturity

```
We believe ab-mcp's retrieval mechanism, applied to both fully-structured
nWave repos (wave-decisions.md, ADRs, CLAUDE.md, feature-delta.md) and
loosely-structured repos (ADRs/manuals dumped in a folder), will achieve
relevant snippet retrieval in both cases without requiring per-repo
configuration of document structure.

We will know this is TRUE when queries against both a mocked
"full-nWave" repo and a mocked "loose folder" repo return relevant
snippets with comparable precision.

We will know this is FALSE when the loosely-structured repo returns
no/irrelevant results while the structured repo works, requiring
structure-specific configuration per repo.
```

**Risk category**: Feasibility
**Risk score**: Impact (2, significant rework if wrong but not solution-fatal) x3 + Uncertainty (2, mixed) x2 + Ease (1, days) x1 = **6 + 4 + 1 = 11** -> Test First

### H4 -- Config Scales 3 -> 10+ Repos Without Redesign

```
We believe a config schema expressed as a LIST of {repo-name, doc-path}
entries will achieve support for 3 repos at MVP launch and scale to
10+ repos later without schema changes.

We will know this is TRUE when adding a 4th, 5th... 10th repo entry
requires only appending to the list, with no code or schema changes.

We will know this is FALSE when adding repos beyond the initial set
requires schema migration or code changes.
```

**Risk category**: Feasibility
**Risk score**: Impact (2) x3 + Uncertainty (1, low -- list-based config is a well-understood pattern) x2 + Ease (1) x1 = **6 + 2 + 1 = 9** -> Test Soon

## Test Plan: Mocked Local Multi-Repo Structure

Per `D-validation`, no live multi-interview validation is planned for MVP. Instead:

1. Construct a local mock environment simulating the recalled scenario:
   - `mock-backend/docs/` -- full nWave structure (wave-decisions.md, ADRs/, CLAUDE.md, feature-delta.md)
   - `mock-frontend-a/docs/` -- loosely-structured (ADRs/ + manuals/ dumped, no consistent format)
   - `mock-frontend-b/docs/` -- minimal (single CLAUDE.md only)
2. Configure ab-mcp (a "current repo" / consumer) with a list of paths to the 3 mock repos' doc folders.
3. Run representative cross-repo queries (e.g., "what's the pagination convention?", "what does the auth/permission ADR say?") from the consumer repo's agent context.
4. Measure:
   - Task completion: did the agent retrieve a relevant snippet without manual file access? (target >80%)
   - Relevance: snippets returned are on-topic (qualitative assessment given single-stakeholder context)
   - Staleness: modify a mock-backend doc, re-query, confirm updated content returned without manual sync
   - Config scaling: add a 4th and 5th mock repo to the list, confirm no code changes required

## G3 Gate Evaluation: Solution -> Viability

| Criterion | Target | Result | Status |
|-----------|--------|--------|--------|
| Task completion | >80% | To be measured against mocked multi-repo structure (post-MVP-build validation step) | PENDING -- planned, not yet executed |
| Usability validated | Required | H1 designed to validate "no manual file navigation" -- test plan defined | PLANNED |
| Users tested | 5+ | Single-stakeholder OSS context; mocked structure substitutes for live users per D-validation | DEVIATION (documented) |
| Key assumptions validated | >80% proven | H1-H4 defined with risk scores; none yet executed | PENDING |

**Gate Decision**: CONDITIONAL PROCEED to Viability (Phase 4) for discovery/canvas purposes, with explicit condition that H1-H4 testing against the mocked multi-repo structure occurs during/before build (DESIGN/DELIVER waves) as an entry condition, not deferred indefinitely. This is a discovery-stage gate evaluated on solution DIRECTION (per task instructions: "solution direction tested via these conversations, MVP scope narrowed"), not on executed test results -- documented as a deviation requiring follow-through tracked in `wave-decisions.md`.

**Documented deviation**: Standard G3 requires >80% task completion from 5+ users tested. For this single-stakeholder OSS MVP, G3 is evaluated on solution-direction validation (hypotheses well-formed, test plan concrete, risks scored and prioritized) rather than executed empirical results. The mocked multi-repo test plan above is a binding pre-build/early-build activity for the DESIGN wave.
