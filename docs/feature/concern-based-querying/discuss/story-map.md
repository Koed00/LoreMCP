# Story Map: concern-based-querying

## User: AI coding agent (Claude Code), on behalf of Maria Santos
## Goal: Query by concern topic and receive authoritative cross-repo context — owner, binding decisions, ADRs, rejected alternatives — without knowing the repo or feature_id upfront

---

## Backbone

| Query by Concern | Cross-Repo Scan | Classify & Rank Results | Surface Rejected Paths | Handle Partial / No Match |
|-----------------|-----------------|------------------------|------------------------|--------------------------|
| resolve_concern(concern) input validation | Keyword-match concern across all configured repos' nWave artifacts | Rank: feature-level > architecture-level > CLAUDE.md | Detect "rejected" / "out of scope" text near concern in matched files | Return CONCERN_NOT_FOUND with searched_repos when nothing matches |
| INVALID_CONCERN error for empty input | Skip unreachable repos gracefully, add warnings | Produce matches[] with relevance field | Populate rejected_paths[] with type "rejected_alternative" | Return partial results + warnings when only ADRs/CLAUDE.md match |
| | Match concern against both file CONTENT and docs/feature/{feature_id}/ dir names | | | |

---

## Walking Skeleton

Note: this is a brownfield addition to an existing server — no server bootstrap needed. The walking skeleton is the minimum new capability that delivers end-to-end value.

**Walking Skeleton = US-CBQ-01**: `resolve_concern(concern="auth")` called against a single configured repo, returns at least one match with `source_file`, `snippet`, `relevance`, and `retrieved_at`. No rejected_paths, no cross-repo, no partial-structure handling — just the core keyword-match-and-return loop working end-to-end.

| Activity | Walking Skeleton Task |
|----------|-----------------------|
| Query by Concern | Accept concern string, validate non-empty |
| Cross-Repo Scan | Keyword-match concern in content of nWave artifacts in ONE configured repo |
| Classify & Rank Results | Return matches with relevance field (feature-level or architecture-level) |
| Surface Rejected Paths | (deferred — Release 1) |
| Handle Partial / No Match | Return CONCERN_NOT_FOUND when nothing matches (basic error shape) |

---

## Release 1: Cross-Repo + Rejected Paths (outcome: agent can trust the result is complete across all repos and sees what was ruled out)

Outcome KPI targeted: AI coding agent answers cross-repo concern questions using resolve_concern() alone, >=80% task completion rate (analogous to KPI-1 in outcome-kpis.md).

| Activity | Release 1 Tasks |
|----------|----------------|
| Cross-Repo Scan | Scan ALL configured repos (not just one); handle per-repo failures gracefully with warnings |
| Surface Rejected Paths | Detect rejection language in matched files; populate rejected_paths[] |

---

## Release 2: Partial-Structure Warnings + INVALID_CONCERN (outcome: agent accurately knows the confidence level of its grounding)

Outcome KPI targeted: 100% of partial-structure concern queries include warnings describing the gap (analogous to KPI-5).

| Activity | Release 2 Tasks |
|----------|----------------|
| Handle Partial / No Match | Partial results + warnings when only ADRs/CLAUDE.md match (no feature-level docs for concern) |
| Query by Concern | INVALID_CONCERN error for empty/whitespace concern string |

---

## Priority Rationale

Priority order: Walking Skeleton (US-CBQ-01) → Release 1 (US-CBQ-02, US-CBQ-03) → Release 2 (US-CBQ-04).

**Rationale:**

1. **Walking Skeleton first** (US-CBQ-01): De-risks the core plumbing — can the keyword-match approach find relevant content in nWave artifacts at all? This is the riskiest assumption (D-retrieval-risk pattern from ab-mcp DISCOVER). Single-repo scope removes multi-repo complexity so the signal is clean. Validates that concern→file→snippet is the right retrieval model before building more on top.

2. **Cross-repo scan second** (US-CBQ-02): The validated job is explicitly cross-repo — a single-repo result is not the full value prop. Must be done before Release 2 so that Release 2 warnings accurately reflect the cross-repo picture.

3. **Rejected paths third** (US-CBQ-03): Surfaces "roads not taken" — high value (agents currently have zero visibility into discarded alternatives) and low implementation risk (same scan, additional text-pattern detection). Bundled with Release 1 because it shares the scan infrastructure.

4. **Partial-structure warnings last** (US-CBQ-04): Lower urgency — the agent still gets useful context from ADR/CLAUDE.md results. The caveat (warnings) is good hygiene but not a blocker for the core use case. INVALID_CONCERN is similarly low-urgency (empty string edge case).

## Scope Assessment: PASS — 4 stories, 1 bounded context (lore-mcp server), estimated 3-4 days total
