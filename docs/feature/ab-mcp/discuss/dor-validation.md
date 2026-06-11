# Definition of Ready Validation -- ab-mcp

## Story: US-01 (Walking Skeleton)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear, domain language | PASS | "A developer using Claude Code in the AB-MCP repo... has zero programmatic access to docs/feature/ab-mcp/discover/wave-decisions.md, even though that file exists right there on disk." |
| User/persona identified | PASS | AI coding agent (Claude Code) operating inside AB-MCP repo itself, dogfooding context (Maria Santos as the human developer) |
| 3+ domain examples with real data | PASS | 3 examples using real file paths (`docs/feature/ab-mcp/discover/wave-decisions.md`), real section names ("Critical Reframe") |
| UAT in Given/When/Then (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 5 AC items, each traceable to a scenario |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 1-1.5 days estimated (slice-00), 4 scenarios |
| Technical notes: constraints/dependencies | PASS | Config format/phase enumeration noted as DESIGN decisions; explicit non-goals listed |
| Dependencies resolved or tracked | PASS | No dependencies (first story) |
| Outcome KPIs defined with measurable targets | PASS | 100% of 4 scenarios pass, baseline 0% |

### DoR Status: PASSED

---

## Story: US-02 (Multi-Repo Retrieval)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear, domain language | PASS | "With only a 1-entry config, ab-mcp can only answer questions about itself -- the actual cross-repo pain... is not yet addressed." |
| User/persona identified | PASS | AI coding agent in Repo A with multi-repo config; Maria Santos as maintainer |
| 3+ domain examples with real data | PASS | Uses repo names "ab-mcp", "nwave-cli", "nwave-skills" -- real sibling repos in stakeholder's environment, not user123-style placeholders |
| UAT in Given/When/Then (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 5 AC items |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 1 day estimated (slice-01), 4 scenarios |
| Technical notes: constraints/dependencies | PASS | Depends on US-01; H4 scaling note; preference for real sibling repos |
| Dependencies resolved or tracked | PASS | Depends on US-01 (sequenced first in story map) |
| Outcome KPIs defined with measurable targets | PASS | KPI-1 >=80% task completion across 3 repos |

### DoR Status: PASSED

---

## Story: US-03 (Error Paths)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear, domain language | PASS | "Maria's ab-mcp config can drift from reality... an agent might ask about a feature_id that simply doesn't exist." |
| User/persona identified | PASS | AI coding agent with a stale multi-repo config entry; Maria as maintainer |
| 3+ domain examples with real data | PASS | "billing-service" moved-path example, "loggin"/"logging" typo example, permission-denied example |
| UAT in Given/When/Then (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 4 AC items |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 0.5-1 day estimated (slice-02), 4 scenarios |
| Technical notes: constraints/dependencies | PASS | Depends on US-02; "did-you-mean" explicitly out of AC scope; error taxonomy noted as DESIGN decision |
| Dependencies resolved or tracked | PASS | Depends on US-02 |
| Outcome KPIs defined with measurable targets | PASS | 100% of 4 error scenarios pass, 0% raw exceptions |

### DoR Status: PASSED

---

## Story: US-04 (Partial nWave Structure)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear, domain language | PASS | "Not all of Maria's repos have fully adopted nWave conventions yet... agent could proceed with incomplete grounding and present it as complete." |
| User/persona identified | PASS | AI coding agent querying repos with varying nWave completeness ("cerbos", "frontend-mobile", "legacy-payments") |
| 3+ domain examples with real data | PASS | ADRs-only (cerbos/ADR-0012), CLAUDE.md-only (frontend-mobile), zero-structure (legacy-payments) |
| UAT in Given/When/Then (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 5 AC items |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 1 day estimated (slice-03), 4 scenarios |
| Technical notes: constraints/dependencies | PASS | Depends on US-02, US-03; explicitly flagged as D-retrieval-risk SPIKE probe with escalation path |
| Dependencies resolved or tracked | PASS | Depends on US-02, US-03 |
| Outcome KPIs defined with measurable targets | PASS | KPI-5: 100% of partial-structure queries include accurate warnings |

### DoR Status: PASSED

---

## Story: US-05 (No-Staleness Verification)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear, domain language | PASS | "If ab-mcp itself introduced any caching, it would silently recreate this exact failure mode [staleness]." |
| User/persona identified | PASS | AI coding agent querying a sibling repo edited mid-session; Maria as the editor |
| 3+ domain examples with real data | PASS | "D-log-format" logging convention example, multi-query example, retrieved_at marker example |
| UAT in Given/When/Then (3-7) | PASS | 3 scenarios |
| AC derived from UAT | PASS | 4 AC items |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 0.5 day estimated (slice-04), 3 scenarios -- smallest story, mostly verification |
| Technical notes: constraints/dependencies | PASS | Depends on US-01 minimum; regression-guard framing for future caching |
| Dependencies resolved or tracked | PASS | Depends on US-01 |
| Outcome KPIs defined with measurable targets | PASS | KPI-2: 0 staleness incidents, 100% edits visible on next query |

### DoR Status: PASSED

---

## Overall DoR Summary

| Story | Status |
|-------|--------|
| US-01 Walking Skeleton | PASSED |
| US-02 Multi-Repo Retrieval | PASSED |
| US-03 Error Paths | PASSED |
| US-04 Partial nWave Structure | PASSED |
| US-05 No-Staleness Verification | PASSED |

**All 5 stories PASSED DoR (9/9 items each).** Proceeding to peer review.
