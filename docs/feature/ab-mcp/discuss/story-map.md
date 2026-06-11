# Story Map: ab-mcp -- Cross-Repo Context Retrieval

## User: AI coding agent (e.g., Claude Code) operating in a new/different repo, on behalf of a developer dogfooding ab-mcp (single-stakeholder OSS, see problem-validation.md)

## Goal: Retrieve relevant, current, source-attributed nWave documentation (wave-decisions/ADRs/CLAUDE.md) from configured sibling repos, without manual copy-paste, without staleness.

## Job Reference

Traces to `docs/feature/ab-mcp/discover/problem-validation.md` Job-to-be-Done:
"When working in Repo A and needing to understand a decision/convention from Repo B/C/D, retrieve relevant doc snippets directly into current agent context, so I can make informed decisions without manual cross-repo file-hunting or stale copies."

## Backbone

| Configure ab-mcp | Discover repo's features | Retrieve feature context | Handle partial/missing structure | Ground decision with attribution |
|---|---|---|---|---|
| Define list of {repo-name, doc-path} entries | list_features(repo_name) scans docs/feature/*/ | query_context(repo_name, feature_id) returns wave-decisions + ADR snippets | Return partial results + warnings when ADRs-only or CLAUDE.md-only | Agent cites source_file in its reasoning/output |
| Validate config entries on server start | Report has_architecture_adrs / has_claude_md flags | Live filesystem read, no cache (retrieved_at marker) | NO_NWAVE_STRUCTURE error when zero nWave artifacts found | Agent surfaces caveat when warnings present |
| Scale config 3 -> 10+ repos, no schema change | REPO_PATH_NOT_FOUND error w/ available_repos | FEATURE_NOT_FOUND error w/ available_features | -- | -- |

---

### Walking Skeleton (Feature 0)

Minimum end-to-end slice -- one task per activity:

1. **Configure**: ab-mcp boots with config containing exactly ONE repo entry `{repo-name: "ab-mcp", doc-path: ".../AB-MCP/docs"}` (dogfood: ab-mcp queries its own docs).
2. **Discover**: `list_features("ab-mcp")` scans `docs/feature/*/` and returns `["ab-mcp"]` (this very feature).
3. **Retrieve**: `query_context("ab-mcp", "ab-mcp")` reads `docs/feature/ab-mcp/discover/wave-decisions.md` (real file, exists today) and returns its content with `source_file` attribution.
4. **Partial/missing handling**: not in skeleton -- deferred to Release 1 (skeleton assumes full structure present, since `docs/feature/ab-mcp/discover/wave-decisions.md` exists).
5. **Ground decision**: agent (in this very DISCUSS session, or a follow-up session) demonstrates citing the returned `source_file` in its output.

This proves: config loads, filesystem read works, MCP tool contract works end-to-end, source attribution works -- against REAL ab-mcp docs (production data, per DISCOVER's "tool is its own first user" framing).

---

### Release 1: Multi-Repo Retrieval Works (targets H1, H4)

Outcome target: agent can retrieve context from 3 configured repos (not just 1), proving the config list shape scales and retrieval generalizes beyond the dogfood repo.

- Config supports list of 3 repo entries (mock or real sibling repos)
- `list_features` works per-repo, returns correct feature_ids for each
- `query_context` works per-repo, returns correct wave-decisions.md + ADR content
- `REPO_PATH_NOT_FOUND` and `FEATURE_NOT_FOUND` error paths implemented
- Add a 4th/5th repo entry -- confirm zero code changes (H4)

### Release 2: Partial nWave Structure Handling (targets D-retrieval-risk, H3 narrowed)

Outcome target: agent receives accurate, non-misleading context (with warnings) even when a configured repo has incomplete nWave adoption.

- `query_context` returns ADR-only results + warning when no wave-decisions.md/feature-delta.md exists for the feature_id
- `query_context` returns CLAUDE.md-only results + warning when neither feature docs nor ADRs exist
- `NO_NWAVE_STRUCTURE` error when a configured repo has none of the three artifact types at all
- `list_features` reports `has_architecture_adrs` / `has_claude_md` flags accurately

### Release 3: Live-Read / No-Staleness Verification (targets H2)

Outcome target: agent always sees current content, never a stale cached copy.

- `retrieved_at` marker present on every `query_context` response
- Modify a source repo's doc file, re-query -> updated content returned with no manual sync step
- (No caching layer introduced -- this release is primarily a verification/property-test slice, may piggyback on Release 1 implementation)

---

## Priority Rationale

1. **Walking Skeleton first** (Feature 0): de-risks the entire MCP server + filesystem + config plumbing using REAL data (ab-mcp's own docs/feature/ab-mcp/), per DISCOVER's dogfooding framing. Smallest possible proof the architecture works end-to-end.

2. **Release 1 (multi-repo) second**: directly validates H1 (no manual copy-paste, agent can answer cross-repo question via tool calls only) and H4 (config scales without redesign) -- both flagged "Test First"/"Test Soon" in solution-testing.md. This is the core value proposition (O1, O2, score 17 each).

3. **Release 2 (partial structure) third**: addresses D-retrieval-risk, the explicitly flagged open feasibility question. Cannot be skipped, but logically depends on Release 1's retrieval mechanism existing first -- you need working retrieval before you can test it against degraded inputs.

4. **Release 3 (no-staleness verification) fourth**: H2's risk score (12) is high, but the live-read approach (D-retrieval-risk Solution Idea D, "always read live, no caching") is the SIMPLEST implementation choice -- if Release 1 is built without a caching layer (the default/recommended path), H2 is largely satisfied by construction. This release is mostly verification/property tests, not new build, so it is lower urgency despite H2's risk score.

5. O6 (ownership/boundary mapping) and CLAUDE.md auto-injection (D-bootstrap) are explicitly OUT OF SCOPE per D-scope/D-bootstrap -- not represented anywhere in this map.

## Scope Assessment: PASS -- 4 stories (Feature 0 + 3 release slices), 1 bounded context (ab-mcp MCP server itself; "sibling repos" are read-only filesystem inputs, not separate contexts ab-mcp must integrate with via APIs), estimated 4-6 days total (~1-1.5 days per slice)
