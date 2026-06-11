# Slice 00: Walking Skeleton -- ab-mcp Reads Its Own Docs

## Learning Hypothesis

"A minimal MCP server with a 1-entry config can boot, scan a real repo's `docs/feature/*/` structure, and return real `wave-decisions.md` content with source attribution -- proving the core architecture (config -> filesystem read -> MCP tool response) works before adding multi-repo complexity."

## Scope (Elephant Carpaccio: thinnest end-to-end slice)

- ab-mcp config = list with exactly ONE entry: `{repo-name: "ab-mcp", doc-path: "/Users/ilansteemers/Projects/AB-MCP/docs"}`
- `list_features("ab-mcp")` scans `docs/feature/*/` and returns `["ab-mcp"]`
- `query_context("ab-mcp", "ab-mcp")` reads `docs/feature/ab-mcp/discover/wave-decisions.md` (this real, existing file) and returns its content + `source_file` attribution
- No multi-repo support, no error handling beyond basic "file exists" check, no partial-structure handling

## Production Data

Uses ab-mcp's OWN `docs/feature/ab-mcp/discover/wave-decisions.md` -- a real nWave artifact already on disk, not a fabricated fixture. Per DISCOVER's "tool is its own first user" framing.

## Effort Estimate

1-1.5 days

## Demo

Run ab-mcp locally, configure it pointing at AB-MCP's own docs/, call `list_features("ab-mcp")` -> see `["ab-mcp"]`. Call `query_context("ab-mcp", "ab-mcp")` -> see the actual "Critical Reframe" text from wave-decisions.md returned with `source_file: ".../docs/feature/ab-mcp/discover/wave-decisions.md"`.

## Maps to User Story

US-01 (Feature 0: Walking Skeleton) in user-stories.md
