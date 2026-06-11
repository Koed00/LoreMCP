# Lean Canvas -- ab-mcp (MVP)

## 1. Problem (Top 3, Phase 1 Validated)

1. Agents/developers working in one repo cannot easily access relevant documentation/decisions from sibling repos in a multi-repo platform -- requires manual cd/grep/copy-paste.
2. Manually-copied context (e.g., pasted CLAUDE.md sections) goes stale as source repos evolve, becoming actively misleading rather than merely absent.
3. Documentation maturity varies widely across repos in a platform (full nWave structure vs. loosely-organized ADR/manual dumps), so any cross-repo solution must work without assuming uniform structure.

## 2. Customer Segments (by JTBD)

- **Primary (MVP)**: OSS project maintainers / solo or small-team developers working across multiple related repos (e.g., a platform with backend + multiple frontend repos) who use AI coding agents and need those agents grounded in cross-repo context.
- JTBD: "When working in Repo A, retrieve relevant doc context from Repo B/C/D without manual copy-paste, kept current."
- Future segment (post-MVP, value prop 2): Teams needing ownership/boundary resolution across repos -- not targeted for MVP.

## 3. Unique Value Proposition (UVP)

> "Give your AI coding agent live, accurate context from your other repos' docs -- no copy-paste, no staleness."

Single clear message focused on value prop 1 (context grounding) only, per D-scope.

## 4. Solution (Top 3 Features for Top Problems)

1. **Configured repo list**: List-based config of {repo-name, doc-path} entries pointing to other repos' docs folders, scalable from 3 to 10+ without redesign (addresses Problem 1).
2. **Live retrieval MCP tools**: MCP tool(s) that query/search/fetch relevant doc snippets from configured repos at query time, reading live (no caching/copying) (addresses Problems 1 and 2).
3. **Structure-tolerant parsing**: Retrieval works against both full-nWave-structured docs and loosely-organized ADR/manual dumps without per-repo structure configuration (addresses Problem 3).

## 5. Channels

- Primary: GitHub repo (OSS), distributed as an MCP server package (e.g., npm/pip-installable MCP server) configured in agent tooling (Claude Code, etc.)
- Validation status: Not yet validated -- channel is the stakeholder's own existing distribution pattern for nWave tooling (assumed analog to other nWave OSS tools). To be validated during DELIVER/post-launch.

## 6. Revenue Streams

- MVP: None -- OSS, free, no monetization planned at MVP stage. Out of scope for viability gate at this stage (OSS project, not a commercial venture).

## 7. Cost Structure

- Development time (solo/small-team OSS maintainer effort)
- No infrastructure cost anticipated for MVP (local filesystem-based MCP server, no hosted service)
- Maintenance cost: keeping pace with MCP protocol changes and nWave doc convention evolution

## 8. Key Metrics

- Task completion rate for cross-repo retrieval queries against mocked multi-repo structure (target >80%, per H1)
- Staleness incidents: zero, by design (live reads, per H2)
- Config scalability: repos added to config (3 -> 10+) without schema/code changes (per H4)
- Relevance of retrieved snippets across varying doc maturity (per H3, qualitative initially)

## 9. Unfair Advantage

- Purpose-built for the nWave documentation convention family (wave-decisions.md, ADRs, CLAUDE.md, feature-delta.md), giving it structural advantage when source repos follow nWave conventions, while remaining tolerant of non-nWave repos -- a dual-mode capability not common in generic cross-repo search tools.
- Stakeholder's direct lived experience of the multi-repo pain (backend + 3 frontends + Cerbos + WorkOS) provides concrete grounding for design decisions, even though formal validation sample is small.

---

## 4 Big Risks Assessment (G4)

| Risk | Question | Status | Evidence/Plan |
|------|----------|--------|---------------|
| Value | Will users want this? | YELLOW | Single-stakeholder recalled evidence strongly positive (weekly+ frequency, real cost from staleness); not yet validated across 5+ independent users. Acceptable for OSS MVP per D-validation; broader validation planned post-launch via usage/adoption signals. |
| Usability | Can users use this? | YELLOW | H1 hypothesis defined, test plan against mocked multi-repo structure not yet executed. Must execute before/during build per G3 conditional proceed. |
| Feasibility | Can we build this? | GREEN | Live filesystem reads (H2), list-based config (H4), and structure-tolerant parsing (H3) are all well-understood technical patterns; no novel technical risk identified. MCP protocol is established. |
| Viability | Does this work as a (OSS) project? | GREEN | No revenue model required for OSS MVP; cost structure is maintainer time only; no infrastructure cost. Viable as a free OSS tool serving the maintainer's own validated need (dogfooding). |

## G4 Gate Evaluation: Viability -> Build/Handoff

| Criterion | Target | Result | Status |
|-----------|--------|--------|--------|
| Lean Canvas complete | Required | All 9 blocks completed above | PASS |
| All 4 risks acceptable (green/yellow) | Required | Value=Yellow, Usability=Yellow, Feasibility=Green, Viability=Green -- all acceptable, none red | PASS |
| Channel validated | 1+ viable | Channel identified (OSS/MCP package) but not empirically validated -- documented as deferred to post-launch | CONDITIONAL PASS (documented) |
| Unit economics | LTV > 3x CAC | N/A -- no revenue model (OSS MVP); not applicable | N/A (documented) |
| Stakeholder sign-off | Required | Single stakeholder is the decision-maker for this OSS project; sign-off implicit in scoping decisions (Q5/Q6) | PASS (single-stakeholder context) |

**Gate Decision**: PROCEED to handoff, with two follow-through conditions carried into wave-decisions.md:
1. Execute H1-H4 mocked multi-repo testing during DESIGN/early DELIVER (Yellow risks must move to Green before broad release).
2. Treat broader user validation (5+ independent users) as a post-MVP activity, not a blocker for this single-stakeholder OSS MVP.
