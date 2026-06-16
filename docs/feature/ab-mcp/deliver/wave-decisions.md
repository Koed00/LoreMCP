
## Demo Evidence — 2026-06-16

Post-merge integration gate passed. All 158 acceptance + unit tests pass.

Elevator Pitch demo (`query_context(repo_name="ab-mcp", feature_id="ab-mcp")`):

```
exit_code: 0
repo_name: ab-mcp
feature_id: ab-mcp
retrieved_at: live (uncached) read at 2026-06-16T10:07...
results_count: 11
first_source_file: docs/feature/ab-mcp/design/wave-decisions.md
contains_Critical_Reframe: true
```

Stories demoed: US-01 (query_context dogfood), US-02 (multi-repo retrieval via acceptance suite), US-03 (structured errors via acceptance suite), US-04 (partial-structure via acceptance suite), US-05 (no-staleness via acceptance suite).
