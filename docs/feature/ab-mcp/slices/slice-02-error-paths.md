# Slice 02: Error Paths -- Missing Repo, Missing Feature

## Learning Hypothesis

"Structured, actionable error responses (REPO_PATH_NOT_FOUND, FEATURE_NOT_FOUND) let the calling agent recover or report clearly to the developer, without manual file navigation -- proving H1's 'zero manual file navigation' requirement holds even on the error paths, not just the happy path."

## Scope

- `REPO_PATH_NOT_FOUND`: configured doc-path doesn't exist on disk -> structured error with `configured_path` + `available_repos`
- `FEATURE_NOT_FOUND`: feature_id not present in target repo's `docs/feature/` -> structured error with `available_features`
- Both errors are JSON objects, never raw exceptions/stack traces (per CLI/TUI error design pattern: what happened / why / what to do)

## Production Data

Use the 3-repo config from Slice 01. For REPO_PATH_NOT_FOUND, add a 4th config entry pointing at a path that doesn't exist (real test of the validation, not mocked). For FEATURE_NOT_FOUND, query a real feature_id that doesn't exist in one of the 3 repos.

## Effort Estimate

0.5-1 day

## Demo

Call `list_features("nonexistent-repo")` (configured but path missing) -> REPO_PATH_NOT_FOUND with available_repos listing the other 3. Call `query_context("ab-mcp", "does-not-exist")` -> FEATURE_NOT_FOUND with available_features = real feature_ids from ab-mcp's docs/feature/.

## Maps to User Story

US-03 (Error Paths: Missing Repo / Missing Feature) in user-stories.md
