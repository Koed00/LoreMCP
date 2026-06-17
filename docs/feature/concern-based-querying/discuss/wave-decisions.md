# Wave Decisions -- DISCUSS (concern-based-querying)

## Summary

DISCUSS produced journey artifacts (visual + YAML), a story map, 4 LeanUX user stories (US-CBQ-01 through US-CBQ-04), outcome KPIs, and a DoR validation — all grounded in the validated job story from `docs/product/jobs.yaml` (cross-repo-context-grounding) and the existing architecture from `docs/product/architecture/brief.md`. JTBD was skipped per stakeholder direction; every story traces N:1 to the single validated job statement.

---

## Configuration Decisions (Carried From Orchestrator)

- Feature type: backend (new MCP tool added to existing lore-mcp server)
- Walking skeleton: NO (brownfield — existing server with two tools); US-CBQ-01 is a functional-slice walking skeleton for the new tool only
- UX research depth: lightweight, single persona ("agent confidence/correctness" framing, consistent with ab-mcp DISCUSS)
- JTBD: skipped, job statement carried forward verbatim from `docs/product/jobs.yaml`
- Interactive: low — artifacts written directly from validated problem statement + dogfooding evidence

---

## Scope Decisions (Fixed — Do Not Reopen)

All inherited from the orchestrator configuration and existing architecture decisions:

- **IN scope**: `resolve_concern(concern: string)` new MCP tool; cross-repo scan across all configured repos; concern-to-feature mapping (keyword-based); rejected-alternative surfacing (text-pattern detection)
- **OUT of scope**: writing to any repo; semantic/vector search; real-time indexing or caching; UI or dashboard; CLAUDE.md auto-injection; ownership/boundary mapping (O6, deferred in ab-mcp DISCUSS)

---

## Key DISCUSS-Wave Decisions

### D-CBQ-tool: New tool name and signature

**Decision**: `resolve_concern(concern: string)` — single string parameter, plain-language topic.

**Rationale**: Matches the validated job ("query by concern, not by repo+feature_id"). Single parameter minimises friction. No `repo_name` parameter — the whole point is that the caller does not know which repo owns the concern. Tool name uses verb_noun pattern consistent with `list_features` / `query_context` (see coherence section).

**Alternatives considered**: `search_concern`, `find_concern`, `query_by_concern` — all longer or ambiguous. `resolve_concern` is chosen because "resolve" implies authoritative answer + tracing to source, consistent with the "grounded decision" outcome.

### D-CBQ-match: Keyword matching strategy

**Decision**: Case-insensitive keyword match in file CONTENT and `docs/feature/{feature_id}/` directory names. No semantic/vector search.

**Rationale**: Consistent with D-docquality REVISED from ab-mcp DISCOVER — that decision explicitly rejected heuristic/semantic matching in favour of convention-based retrieval. Keyword matching is the simplest extension of path-convention-based retrieval: "does this file (already retrieved by convention) contain the concern word?" This keeps the core logic a pure function with no external dependencies.

**Alternatives considered**: Semantic/vector search (confirmed out of scope by orchestrator configuration and consistent with existing architecture decisions). Heading-matched extraction (rejected — same rationale as ADR-003: reintroduces heuristic indexing that D-docquality REVISED scoped out).

### D-CBQ-relevance: Relevance ranking

**Decision**: Three relevance levels, ranked descending: `"feature-level"` (wave-decisions.md / feature-delta.md) > `"architecture-level"` (ADRs under `docs/product/architecture/`) > `"repo-conventions"` (CLAUDE.md). Feature-level matches appear first in the matches array; within the same level, repos appear in config order.

**Rationale**: Matches the completeness hierarchy already established in ab-mcp's structure classification (US-04, architecture brief Decision 4/5). Feature-level decisions are more specific and more recent than ADRs; ADRs are more formal than CLAUDE.md conventions. Consistent ranking reduces cognitive load for the agent parsing results.

### D-CBQ-rejected: Rejected-paths detection

**Decision**: Heuristic text pattern matching — detect rejection keywords ("Rejected:", "out of scope", "Won't Have", "Not built", "Alternative considered and dismissed", "deferred") case-insensitively near the matched concern keyword. Paragraph-proximity definition is a DESIGN-wave detail.

**Rationale**: nWave artifacts already contain rejection language by convention (wave-decisions.md decisions follow "Rejected: X" format; ADRs have "## Rejected Alternatives" sections). Pattern matching is sufficient for MVP — the goal is to surface obvious rejections, not to exhaustively parse every nuance. Heuristic is preferable to no surfacing at all.

**Risk**: False positives (flagging text as a rejection when it isn't) or false negatives (missing non-standard rejection wording) are possible. Acceptable at MVP — same philosophy as the concern match itself. DESIGN wave to refine the keyword list and proximity rules.

### D-CBQ-errors: New error code

**Decision**: `INVALID_CONCERN` added to the error taxonomy for empty/whitespace concern input. SCREAMING_SNAKE_CASE, consistent with existing error codes.

**Alternatives considered**: Returning CONCERN_NOT_FOUND for empty input — rejected because it would be indistinguishable from "genuinely not found", making the agent unable to diagnose a variable-substitution bug.

---

## Scope Assessment (Elephant Carpaccio Gate)

- 4 user stories, 1 bounded context (lore-mcp server; sibling repos are read-only filesystem inputs, same as existing tools)
- Walking skeleton (US-CBQ-01) requires 0 external integration points beyond existing lore-mcp config
- Estimated total effort: 3.5-4.5 days (4 slices, 0.5-1.5 days each)
- No oversized signals triggered (not >10 stories, not >3 bounded contexts, <2 weeks total, single coherent outcome)

**Result: PASS — right-sized, no split required.**

---

## Coherence Validation

- **MCP vocabulary consistent**: `resolve_concern` follows verb_noun pattern; response field names (`matches`, `rejected_paths`, `warnings`, `retrieved_at`, `source_file`, `relevance`) are either existing shared artifacts (source_file, retrieved_at, warnings) or new names consistent with existing conventions
- **Emotional arc coherent**: Uncertain/Blocked → Curious/Engaged → Confident (or Grounded-with-caveat) — mirrors ab-mcp's agent-confidence framing with no jarring transitions; even CONCERN_NOT_FOUND ends in "Informed" (agent knows concern is undecided), not "Frustrated"
- **Shared artifacts**: `source_file`, `retrieved_at`, `warnings`, `repo_name` all have single sources of truth and are reused from existing `query_context` contracts — no new shared artifact shapes invented (see shared-artifacts-registry.md)
- **Horizontal integration**: US-CBQ-01 (walking skeleton) → US-CBQ-02 (cross-repo) → US-CBQ-03 (rejected paths) → US-CBQ-04 (partial warnings + validation) — each story adds capability without modifying the previous story's AC or response shapes

---

## Relationship to ab-mcp Wave Artifacts

- This feature's `resolve_concern` tool is additive — it does NOT modify `list_features` or `query_context` (existing tools, existing behaviour, existing response shapes unchanged)
- The functional-core/imperative-shell boundary (CLAUDE.md, architecture brief Section 6) applies to all new code: concern classification, relevance ranking, rejected-path detection, and partial-structure warning logic are pure functions in `src/core/`; filesystem scanning lives exclusively in `src/shell/`
- ADR-004 (no-cache, live reads) applies to `resolve_concern` identically — no new caching discussion needed
- Error response shapes follow the same pattern as existing structured errors; `INVALID_CONCERN` is a new code, DESIGN wave to add to the error taxonomy table in the architecture brief

---

## Upstream Changes / Notes to DESIGN Wave

1. **New error code**: `INVALID_CONCERN` must be added to the structured error taxonomy (architecture brief Section 8). Response shape: `{error: "INVALID_CONCERN", concern: string, message: string, retrieved_at: string}`.

2. **Rejection keyword list**: The 6 rejection keywords in D-CBQ-rejected are the minimum. DESIGN should confirm or extend. Paragraph-proximity rules (how close must the keyword be to the matched concern word?) are a DESIGN detail — the AC only requires the 6 patterns are detected; proximity is not specified.

3. **Relevance ranking and sort order**: Within the same relevance level, repos appear in config order (deterministic). If DESIGN prefers alphabetical or score-based ranking within a level, that is a DESIGN-wave choice — the AC only requires feature-level before architecture-level.

4. **searched_repos in CONCERN_NOT_FOUND**: Lists only repos that were SUCCESSFULLY scanned (not skipped/broken ones). Skipped repos appear in `warnings`. This is a DESIGN-wave implementation detail if the crafter sees a different UX; the AC as written specifies this behaviour.

---

## Handoff Readiness

DoR: 4/4 stories PASSED (9/9 items each) — see `dor-validation.md`.
Peer review: APPROVED (self-review with nw-po-review-dimensions applied, 0 iterations of remediation needed).

**Status: READY for handoff to solution-architect (DESIGN wave).**
