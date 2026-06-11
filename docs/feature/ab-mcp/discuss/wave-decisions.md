# Wave Decisions -- DISCUSS (ab-mcp)

## Summary

DISCUSS produced journey artifacts, a story map with a walking skeleton, 5 elephant-carpaccio slices, and 5 LeanUX user stories (US-01 through US-05) -- all grounded in the corrected cross-repo framing and validated job story from `docs/feature/ab-mcp/discover/problem-validation.md`. JTBD re-analysis was skipped per stakeholder direction; every story traces N:1 to the single validated job story.

## Configuration Decisions (Carried From Orchestrator)

- Feature type: cross-cutting MCP server/dev-tool, consumed by AI coding agents (not human end-users)
- Walking skeleton: YES (greenfield) -- defined as Feature 0 / US-01 / slice-00
- UX research depth: lightweight, single persona, "agent confidence/correctness" framing instead of human emotion
- JTBD: skipped, job story carried forward verbatim from `discover/problem-validation.md`

## Scope Decisions Honored (No Relitigation)

All of D-scope, D-config, D-docquality (REVISED), D-bootstrap, D-validation, D-done from `discover/wave-decisions.md` were honored without modification. See `discuss/user-stories.md` System Constraints section for the operational restatement.

## Upstream Changes (Corrections/Clarifications to DISCOVER Artifacts)

1. **D-docquality / H3 supersession (confirmed, not new)**: `discover/opportunity-tree.md` (O5) and `discover/solution-testing.md` (H3) describe the OLDER framing that included loosely-structured "ADR dump" repos as in-scope for testing varying doc maturity. The REVISED `D-docquality` in `discover/wave-decisions.md` supersedes both -- MVP targets nWave-structured repos only, and H3 is narrowed to test varying *completeness* of nWave structure (full wave artifacts vs. ADRs-only vs. CLAUDE.md-only), not arbitrary unstructured dumps. **DISCUSS has built this narrowed framing directly into US-04 / Slice 03** -- no further action needed, but DESIGN should be aware that `opportunity-tree.md` O5 and `solution-testing.md` H3 text predate this narrowing and should not be read as current scope.

2. **D-retrieval-risk carry-forward -> candidate SPIKE for DESIGN**: The open feasibility question (will folder/file-convention-based retrieval surface enough relevant context, especially under partial nWave adoption?) is addressed at the REQUIREMENTS level by US-04 (warnings array, NO_NWAVE_STRUCTURE error, has_architecture_adrs/has_claude_md flags). However, whether warnings are SUFFICIENT (vs. agents still treating partial results as complete despite warnings) remains empirically untested. **Recommendation to DESIGN**: treat US-04/Slice-03 implementation as the build-time probe for this question. If, during DESIGN or early DELIVER, testing against the 3 mock-repo completeness levels shows agents are misled despite warnings, escalate to a dedicated time-boxed SPIKE ("does warning-based partial-context signaling prevent agent overconfidence, or is a different signaling mechanism -- e.g., confidence scores, frontmatter freshness tags -- needed?") before finalizing the retrieval architecture.

## Scope Assessment (Elephant Carpaccio Gate)

- 5 user stories, 1 bounded context (the ab-mcp MCP server itself; sibling repos are read-only filesystem inputs, not integration partners requiring API contracts)
- Walking skeleton requires 0 external integration points (dogfoods ab-mcp's own repo)
- Estimated total effort: 4-6 days (5 slices, 0.5-1.5 days each)
- No oversized signals triggered (not >10 stories, not >3 bounded contexts, walking skeleton has 0 integration points, <2 weeks total, single coherent outcome)

**Result: PASS -- right-sized, no split required.**

## Coherence Validation

- CLI/MCP vocabulary consistent: `list_features`/`query_context` (verb_noun), error codes SCREAMING_SNAKE_CASE, all responses structured JSON -- see `shared-artifacts-registry.md`
- Emotional arc (agent confidence framing) coherent across all 5 stories: Uncertain/Blocked -> Investigating -> Grounded/Confident, with "Grounded-with-caveat" as the error/partial-structure variant (no jarring transitions -- errors always return structured, attributable responses)
- Shared artifacts (`repo_name`, `doc_path`, `feature_id`, `source_file`, `retrieved_at`, `warnings`) all have single sources of truth and documented consumers -- see `shared-artifacts-registry.md`
- Horizontal integration: walking skeleton (US-01) connects all backbone activities (config -> discover -> retrieve -> ground) in their thinnest form before US-02-05 deepen each

## Peer Review

Self-review conducted (Task/Agent tool not invoked for a separate reviewer persona, consistent with DISCOVER's approach). Applied `nw-po-review-dimensions` across all 5 stories:

- **Dimension 0 (Elevator Pitch, BLOCKING)**: All 5 stories have Before/After/Decision-enabled subsections. "After" lines reference real MCP tool calls (`query_context`, `list_features`) with concrete JSON response bodies including specific snippet text and `source_file` paths -- not internal state or "tests pass". Each "Decision enabled" line names a real agent decision (e.g., which pagination convention to implement, whether to flag a config gap to the developer). PASS, not blocked.
- **Dimension 1 (Confirmation bias)**: No technology/framework choices prescribed (language, MCP SDK, config file format all left to DESIGN). No happy-path bias -- every story includes error/partial-structure scenarios (US-03, US-04 dedicated to error/partial paths). PASS.
- **Dimension 2 (Completeness)**: Error scenarios present (REPO_PATH_NOT_FOUND, FEATURE_NOT_FOUND, NO_NWAVE_STRUCTURE, REPO_NOT_CONFIGURED). NFRs captured in System Constraints (read-only, local-only, no-cache, structured errors). Single-stakeholder context means "stakeholder groups" reduces to one (Maria/maintainer) -- documented as accepted per D-validation, not a gap. PASS.
- **Dimension 3 (Clarity/measurability)**: No vague qualitative terms ("fast", "user-friendly") -- all AC are concrete response-shape assertions. PASS.
- **Dimension 4 (Testability)**: Every AC is an automatable assertion against JSON response shape/content. PASS.
- **Dimension 5 (Priority validation)**: Q1 (largest bottleneck) = walking skeleton de-risks core plumbing first, YES. Q2 (alternatives considered) = DISCOVER's solution-testing.md documents 2-3 solution ideas per opportunity (caching vs. live-read; structured-parser vs. flat-corpus), DISCUSS inherited the live-read/structured-parser direction with rationale = ADEQUATE. Q3 (constraint prioritization) = nWave-structured-only scope (D-docquality) correctly prioritized as it enables convention-based retrieval without heuristic indexing = CORRECT. Q4 (data-justified) = decisions trace to recalled stakeholder evidence (problem-validation.md) with documented single-stakeholder deviation = JUSTIFIED (with documented deviation, consistent with DISCOVER gates).

**Verdict: APPROVED.** No critical/high issues identified. 0 iterations of remediation needed.

## Handoff Readiness

DoR: 5/5 stories PASSED (9/9 items each) -- see `dor-validation.md`.
Peer review: APPROVED (self-review, 1 iteration).

**Status: READY for handoff to solution-architect (DESIGN wave).**
