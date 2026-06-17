# Definition of Ready Validation -- concern-based-querying

Validated against the 9-item DoR checklist. All stories must pass all items before handoff to DESIGN wave.

---

## US-CBQ-01: Walking Skeleton — Agent Resolves a Concern Against a Single Repo

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear, domain language | PASS | "Before designing, an agent doesn't know which repo or feature_id to look in" — domain language, user pain in context |
| User/persona identified with specific characteristics | PASS | "AI coding agent (Claude Code), operating in any configured repo, about to design a feature, no upfront knowledge of repo/feature_id" |
| 3+ domain examples with real data | PASS | (1) Maria resolves "auth" in nwave-cli; (2) directory-name match for "logging" without body text match; (3) CONCERN_NOT_FOUND for "graphql-federation" |
| UAT scenarios in Given/When/Then (3-7) | PASS | 4 scenarios: full match, dir-name match, CONCERN_NOT_FOUND, tool registration |
| AC derived from UAT | PASS | 7 AC items, each traceable to a UAT scenario |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 4 scenarios; estimated 1-1.5 days (new tool registration + single-repo keyword match core function) |
| Technical notes: constraints/dependencies | PASS | Depends on existing lore-mcp server; keyword match is pure function in src/core/; relevance ranking extends existing classification logic |
| Dependencies resolved or tracked | PASS | Depends on US-01 through US-05 (delivered — lore-mcp v0.1.7 published); no external dependencies |
| Outcome KPIs defined with measurable targets | PASS | KPI-CBQ-1 (>=80% task completion), KPI-CBQ-4 (100% error path coverage), KPI-CBQ-5 (0 staleness) |

### DoR Status: PASSED

---

## US-CBQ-02: Cross-Repo Scan — All Configured Repos Searched, Failures Handled Gracefully

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear, domain language | PASS | "A single-repo scan might miss the definitive decision living in a different repo" — clear false-negative risk in domain language |
| User/persona identified with specific characteristics | PASS | "AI coding agent in Repo A with a multi-repo lore-mcp config (3+ entries)" |
| 3+ domain examples with real data | PASS | (1) "data persistence" matched in nwave-cli and nwave-skills; (2) billing-service broken path — partial scan with warning; (3) all repos unreachable — CONCERN_NOT_FOUND |
| UAT scenarios in Given/When/Then (3-7) | PASS | 4 scenarios: multi-repo aggregation, graceful skip, all-repos-unreachable, no cross-contamination |
| AC derived from UAT | PASS | 6 AC items, each traceable to a UAT scenario |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 4 scenarios; estimated 1 day (extend single-repo scan to loop N repos; per-repo failure downgrade from error to warning) |
| Technical notes: constraints/dependencies | PASS | Depends on US-CBQ-01; per-repo failure handling reuses existing REPO_PATH_NOT_FOUND probe logic from architecture brief Section 9 |
| Dependencies resolved or tracked | PASS | Depends on US-CBQ-01 (this feature's walking skeleton) |
| Outcome KPIs defined with measurable targets | PASS | KPI-CBQ-1 (>=80% multi-repo task completion), KPI-CBQ-4 (100% error path coverage) |

### DoR Status: PASSED

---

## US-CBQ-03: Rejected Paths — Surfaces "Roads Not Taken" from nWave Artifacts

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear, domain language | PASS | "Agents re-propose solutions already tried and rejected — dismissed alternatives buried in wave-decisions.md and ADRs, never surfaced proactively" |
| User/persona identified with specific characteristics | PASS | "AI coding agent about to propose an implementation approach for a concern it just queried" |
| 3+ domain examples with real data | PASS | (1) OAuth2 rejection in ADR-0007 surfaced for "auth"; (2) "out of scope: caching" in wave-decisions.md surfaced for "caching"; (3) no rejection language — rejected_paths is [] not absent |
| UAT scenarios in Given/When/Then (3-7) | PASS | 4 scenarios: ADR rejection, wave-decisions out-of-scope, empty rejected_paths, file in both matches and rejected_paths |
| AC derived from UAT | PASS | 5 AC items, each traceable to a UAT scenario |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 4 scenarios; estimated 1-1.5 days (rejection pattern detection is a pure function; paragraph extraction adds modest complexity) |
| Technical notes: constraints/dependencies | PASS | Depends on US-CBQ-02; heuristic text matching (not semantic); rejection detection is pure function in src/core/ |
| Dependencies resolved or tracked | PASS | Depends on US-CBQ-02 (cross-repo scan provides the scanned content to inspect) |
| Outcome KPIs defined with measurable targets | PASS | KPI-CBQ-3 (100% of rejection clauses in fixture files surfaced) |

### DoR Status: PASSED

---

## US-CBQ-04: Partial-Structure Warnings + Input Validation

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear, domain language | PASS | "Agent reads ADR-only results and presents them as complete grounding, missing the caveat that no feature-level decisions were found" — clear confidence-miscalibration pain |
| User/persona identified with specific characteristics | PASS | "AI coding agent receiving a resolve_concern response with only architecture-level content" |
| 3+ domain examples with real data | PASS | (1) "rate-limiting" — only ADR-0003 matched, warning added; (2) "auth" — wave-decisions.md AND ADR matched, no warning; (3) empty string — INVALID_CONCERN error |
| UAT scenarios in Given/When/Then (3-7) | PASS | 4 scenarios: partial warning, no warning when feature-level present, INVALID_CONCERN for empty, INVALID_CONCERN for whitespace |
| AC derived from UAT | PASS | 6 AC items, each traceable to a UAT scenario |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 4 scenarios; estimated 0.5 days (partial-structure check is a trivial pure function on the matches array; INVALID_CONCERN is a guard at tool-entry point) |
| Technical notes: constraints/dependencies | PASS | Depends on US-CBQ-02 (needs aggregated matches to evaluate relevance); INVALID_CONCERN is a new error code, DESIGN wave to add to error taxonomy documentation |
| Dependencies resolved or tracked | PASS | Depends on US-CBQ-02 |
| Outcome KPIs defined with measurable targets | PASS | KPI-CBQ-2 (100% of partial-structure queries include warning) |

### DoR Status: PASSED

---

## Feature-Level DoR Summary

| Story | DoR Status | Scenarios | Estimated Effort |
|-------|-----------|-----------|-----------------|
| US-CBQ-01 | PASSED | 4 | 1-1.5 days |
| US-CBQ-02 | PASSED | 4 | 1 day |
| US-CBQ-03 | PASSED | 4 | 1-1.5 days |
| US-CBQ-04 | PASSED | 4 | 0.5 days |
| **Total** | **4/4 PASSED** | **16** | **3.5-4.5 days** |

Scope assessment: 4 stories, 1 bounded context (lore-mcp server), 3.5-4.5 days total. Within right-sized bounds. No split required.

---

## Anti-Pattern Check

| Anti-Pattern | Present? | Evidence |
|---|---|---|
| Implement-X titles | No | All stories start from user pain ("agent doesn't know where to look", "agents re-propose rejected alternatives") |
| Generic data (user123, test@test.com) | No | Real persona (Maria Santos), real concern strings ("auth", "rate-limiting", "graphql-federation"), real repo names (nwave-cli, billing-service) |
| Technical AC ("Use JWT") | No | All AC are observable response-shape assertions (response contains matches, rejected_paths field present, warnings contains text) |
| Technical scenario titles | No | Titles describe business outcomes: "Agent resolves concern", "Rejected alternative surfaced", "Partial-structure warning when no feature-level matches exist" |
| Oversized stories | No | All stories 3-4 scenarios, 0.5-1.5 days estimated |
| Abstract requirements | No | 3+ concrete domain examples with real data per story |

---

## Peer Review

Applying `nw-po-review-dimensions` across all 4 stories:

**Dimension 0 (Elevator Pitch, BLOCKING):**
All 4 stories have Before/After/Decision-enabled subsections. "After" lines reference the real MCP tool call `resolve_concern(concern="...")` with concrete JSON response body shapes (not internal state or "tests pass"). "Decision enabled" lines name real agent decisions (e.g., "decides NOT to propose OAuth2 because it sees it was explicitly rejected, with rationale"). PASS — not blocked.

**Dimension 1 (Confirmation Bias):**
No technology choices prescribed (keyword matching strategy, paragraph proximity rules, rejection keyword list — all left to DESIGN). Happy-path bias: US-CBQ-03 and US-CBQ-04 are dedicated to non-happy-path results (rejected paths, partial structure, invalid input). Error scenarios present across all stories (CONCERN_NOT_FOUND, INVALID_CONCERN, repo-skip). PASS.

**Dimension 2 (Completeness):**
Error scenarios present per story. NFRs in System Constraints (read-only, no cache, functional core/imperative shell, structured errors). Stakeholder: single-actor OSS (Maria/agent), consistent with ab-mcp DISCOVER precedent. PASS.

**Dimension 3 (Clarity/Measurability):**
No vague qualitative terms. All AC are concrete response-shape assertions. Matching strategy ("case-insensitive keyword match") is specific. Relevance ranking is explicit (feature-level > architecture-level > repo-conventions). PASS.

**Dimension 4 (Testability):**
Every AC is an automatable assertion against JSON response shape or content. Pure-function core means error/match classification is testable with in-memory fixtures (zero fs mocking). PASS.

**Dimension 5 (Priority Validation):**
Q1 (largest bottleneck) = YES, walking skeleton de-risks the core keyword-match approach before building multi-repo complexity on top.
Q2 (alternatives considered) = ADEQUATE — keyword-match-only scope was explicitly decided (semantic/vector search is out of scope, per ab-mcp DISCOVER and existing architecture decisions).
Q3 (constraint prioritization) = CORRECT — nWave-structured-only scope inherited from ab-mcp; keyword-only matching avoids reintroducing heuristic indexing rejected in D-docquality REVISED.
Q4 (data-justified) = JUSTIFIED — decision traces to the dogfooding problem statement and the validated job story in jobs.yaml.

**Overall Review Verdict: APPROVED**

Critical issues: 0
High issues: 0

**Status: READY for handoff to solution-architect (DESIGN wave).**
