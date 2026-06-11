# Slice 01: Multi-Repo Config Scales to 3 Repos

## Learning Hypothesis

"A list-based config of {repo-name, doc-path} entries can hold 3 repos and both `list_features` and `query_context` resolve correctly per-repo, with zero schema changes needed -- proving D-config/H4's scalability claim at the floor of its range (3 repos)."

## Scope

- Extend config to 3 entries (e.g., ab-mcp itself + 2 mock/sibling repos with real nWave docs -- could be 2 other local nWave-built repos the stakeholder maintains, or 2 mock repos created for this slice)
- `list_features(repo_name)` resolves the correct doc_path per repo_name from config
- `query_context(repo_name, feature_id)` resolves correct doc_path and returns correct repo's content
- Repo-name validation: unknown repo_name returns structured error listing available_repos from config

## Production Data

Prefer real sibling nWave repos if the stakeholder has 2+ available locally; otherwise construct 2 minimal-but-real nWave doc trees (real wave-decisions.md content, not lorem ipsum).

## Effort Estimate

1 day

## Demo

Configure 3 repos. Call `list_features` for each -> correct, distinct feature lists per repo. Call `query_context` for a feature in repo 2 -> correct content from repo 2, not repo 1 or 3. Call with an unconfigured repo_name -> structured error with available_repos = the 3 configured names.

## Maps to User Story

US-02 (Multi-Repo Retrieval) in user-stories.md
