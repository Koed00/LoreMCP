# Journey: Cross-Repo Context Retrieval (Product SSOT Pointer)

## Source of Truth

This journey was authored during the DISCUSS wave for feature `ab-mcp`. The canonical, detailed artifact (ASCII flow, emotional arc, TUI mockups, error paths, shared artifacts) lives at:

- `docs/feature/ab-mcp/discuss/journey-cross-repo-context-retrieval-visual.md`
- `docs/feature/ab-mcp/discuss/journey-cross-repo-context-retrieval.yaml`
- `docs/feature/ab-mcp/discuss/journey-cross-repo-context-retrieval.feature`
- `docs/feature/ab-mcp/discuss/shared-artifacts-registry.md`

## Summary (for cross-feature discoverability)

**Actor**: AI coding agent (e.g., Claude Code) operating in Repo A (a new/different repo in a multi-repo nWave platform), on behalf of a developer dogfooding ab-mcp.

**Goal**: Retrieve relevant, current, source-attributed nWave documentation (wave-decisions/ADRs/CLAUDE.md) from sibling Repo B/C/D via `list_features()` and `query_context(repo_name, feature_id)`, without manual copy-paste and without staleness.

**Emotional Arc (agent confidence framing)**: Uncertain/Blocked -> Investigating (tool calls) -> Grounded/Confident (or Grounded-with-caveat on partial/error responses).

**Job Reference**: `docs/product/jobs.yaml` -- job id `cross-repo-context-grounding`.

As future features are added to this multi-repo platform's tooling, update this pointer file (or promote shared sub-journeys here) rather than duplicating the full mockups.

## Changelog

- 2026-06-11: Bootstrapped as pointer to ab-mcp's DISCUSS journey artifacts (first feature in this product).
