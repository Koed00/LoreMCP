# Shared Artifacts Registry -- ab-mcp

## Purpose

Tracks every `${variable}` appearing in journey TUI mockups / tool responses, its single source of truth, and consumers, per `nw-shared-artifact-tracking`.

## Registry

```yaml
shared_artifacts:
  repo_name:
    source_of_truth: "ab-mcp config file (list of {repo-name, doc-path} entries)"
    consumers:
      - "list_features(repo_name) request arg"
      - "list_features response.repo_name"
      - "query_context(repo_name, feature_id) request arg"
      - "query_context response.repo_name"
      - "all error responses (REPO_PATH_NOT_FOUND, NO_NWAVE_STRUCTURE, FEATURE_NOT_FOUND)"
    owner: "ab-mcp config / Feature 0 (walking skeleton)"
    integration_risk: "HIGH -- if repo_name in a query doesn't match a config entry, every downstream tool call fails. Must validate against config list before filesystem access."
    validation: "Both list_features and query_context resolve repo_name via the SAME config-lookup function; reject unknown repo_name with REPO_NOT_CONFIGURED-style error listing available_repos."

  doc_path:
    source_of_truth: "ab-mcp config file (list of {repo-name, doc-path} entries) -- paired with repo_name"
    consumers:
      - "list_features response.doc_path"
      - "query_context source_file construction (doc_path + nWave-relative path)"
      - "REPO_PATH_NOT_FOUND error.configured_path"
      - "NO_NWAVE_STRUCTURE error.configured_path"
    owner: "ab-mcp config / Feature 0 (walking skeleton)"
    integration_risk: "HIGH -- doc_path is the root for ALL filesystem reads. A typo or stale path silently returns REPO_PATH_NOT_FOUND, which is correct/safe, but must be tested for both list_features and query_context using the SAME path resolution."
    validation: "Path existence check happens once per query, live (no cache), shared by both tools via a common resolver."

  feature_id:
    source_of_truth: "Repo A agent's query input; validated against target repo's docs/feature/{feature_id}/ directory existing under doc_path"
    consumers:
      - "query_context(repo_name, feature_id) request arg"
      - "query_context response.feature_id"
      - "FEATURE_NOT_FOUND error.feature_id and error.available_features"
      - "list_features response.features[].feature_id (enumeration source for valid feature_ids)"
    owner: "target repo's docs/feature/ directory structure (read live)"
    integration_risk: "MEDIUM -- feature_id values returned by list_features() must be exactly the values accepted by query_context() for the same repo. Divergence breaks the discovery -> retrieval flow."
    validation: "Integration test: for each feature_id in list_features(repo).features, query_context(repo, feature_id) must NOT return FEATURE_NOT_FOUND."

  source_file:
    source_of_truth: "Filesystem path = doc_path + nWave-relative path (feature/{feature_id}/{phase}/wave-decisions.md or feature-delta.md, product/architecture/ADR-*.md, CLAUDE.md)"
    consumers:
      - "query_context response.results[].source_file (every snippet)"
      - "agent's source attribution when grounding a decision (journey step 4)"
    owner: "query_context retrieval logic / Feature 0 + later slices"
    integration_risk: "HIGH -- this is the anti-hallucination/anti-staleness mechanism (D-retrieval-risk, H2). Every snippet MUST carry a real, re-readable path. If source_file is wrong or relative-ambiguous, the agent cannot verify or re-read the source -- defeats the 'no staleness' value prop."
    validation: "source_file must be a path that, when read directly, reproduces the snippet content (round-trip test)."

  retrieved_at:
    source_of_truth: "Computed at query time by ab-mcp (live read marker, e.g., 'live (no cache)' or ISO timestamp of the read)"
    consumers:
      - "query_context response.retrieved_at"
    owner: "query_context retrieval logic"
    integration_risk: "MEDIUM -- exists primarily to make the 'no caching' guarantee observable/testable (H2). If a caching layer is introduced later, this field must reflect actual read time, not a cached value."
    validation: "H2 test: modify a source doc, re-query, confirm new content + new retrieved_at without manual sync step."

  warnings:
    source_of_truth: "Computed by query_context based on which nWave doc types were found vs. expected (full wave-decisions.md vs. ADRs-only vs. CLAUDE.md-only)"
    consumers:
      - "query_context response.warnings[] (partial-structure cases)"
      - "agent's caveat surfaced to developer (journey step 4)"
    owner: "query_context retrieval logic / D-retrieval-risk SPIKE"
    integration_risk: "MEDIUM -- this is the primary mechanism for handling D-retrieval-risk (partial nWave adoption). If warnings are inconsistent or missing, agents may present partial context as fully grounded (false confidence)."
    validation: "For each of the 3 mock repo completeness levels (full, ADRs-only, CLAUDE.md-only), confirm warnings array accurately reflects what's missing."
```

## Integration Validation Summary

| Check | Status |
|-------|--------|
| All `${variable}` in TUI mockups have documented source | YES (5 artifacts above) |
| repo_name/doc_path resolved via single config-backed resolver for both tools | Required -- flagged for DESIGN |
| feature_id consistency between list_features and query_context | Required -- integration test in walking skeleton |
| source_file round-trips to real readable content | Required -- core anti-staleness guarantee |
| warnings array reflects actual doc completeness | Required -- addresses D-retrieval-risk |

## CLI/MCP Vocabulary Consistency

- Tool names: `list_features`, `query_context` (verb_noun, consistent with MCP tool naming conventions)
- Error codes: `REPO_PATH_NOT_FOUND`, `NO_NWAVE_STRUCTURE`, `FEATURE_NOT_FOUND` -- SCREAMING_SNAKE_CASE, consistent
- All responses are structured JSON (no raw exceptions/stack traces) -- aligns with TUI/CLI error design pattern (what happened / why / what to do)
