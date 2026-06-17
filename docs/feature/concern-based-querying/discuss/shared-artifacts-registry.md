# Shared Artifacts Registry -- concern-based-querying

Tracks all data values that appear in multiple places across the journey or that are shared with existing lore-mcp tools. Every ${variable} in the journey schema and TUI mockups is documented here.

---

## Inherited Shared Artifacts (from ab-mcp feature)

These artifacts are defined in `docs/feature/ab-mcp/discuss/shared-artifacts-registry.md` (or equivalent). `resolve_concern` MUST use the same shapes — no new definitions.

| Artifact | Source of Truth | Owner | Consumers in This Feature | Integration Risk |
|----------|----------------|-------|--------------------------|-----------------|
| `repo_name` | `lore-mcp.config.json` (config list entries) | lore-mcp config loader | matches[].repo_name, searched_repos, warnings, CONCERN_NOT_FOUND body | HIGH — must exactly match config repo-name values; mismatch causes agent confusion about which repo owns a decision |
| `doc_path` | `lore-mcp.config.json` (config list entries) | lore-mcp config loader | scan root per repo (internal), REPO_PATH_NOT_FOUND error body | HIGH — same as query_context; probe reuses existing DocTreeReader probe logic |
| `source_file` | Live filesystem scan (absolute path, same format as query_context results) | DocTreeReader (shell) | matches[].source_file, rejected_paths[].source_file | HIGH — must be absolute path rooted in the repo's configured doc_path; inconsistency breaks agent citation |
| `snippet` | Live file read (full content, size-capped per ADR-003) | Content Extractor (shell → core) | matches[].snippet, rejected_paths[].snippet | MEDIUM — same truncation + warning rules as query_context; must not introduce different cap or truncation marker |
| `retrieved_at` | Runtime constant `"live (no cache)"` | Response Formatter (core) | Every resolve_concern response including error responses | HIGH — must appear on ALL responses (property tested in US-CBQ-01 and KPI-CBQ-5); omission breaks live-read guarantee |
| `warnings` | Classification logic (pure function in src/core/) | Response Formatter (core) | Partial-structure notices, repo-skip notices | MEDIUM — string array, same format as query_context warnings; consumers rely on array always being present (empty or populated) |

---

## New Shared Artifacts (introduced by this feature)

| Artifact | Source of Truth | Owner | Consumers | Integration Risk |
|----------|----------------|-------|-----------|-----------------|
| `concern` | Caller input (resolve_concern parameter) | MCP tool handler (shell) | Response envelope ("concern": "${concern}"), CONCERN_NOT_FOUND body, INVALID_CONCERN body, partial-structure warning text | MEDIUM — echoed in every response so the agent can confirm what was queried; must not be normalised/transformed before echoing |
| `relevance` | Classification logic (pure function: source_file path pattern → relevance tier) | src/core/ classifier | matches[].relevance | MEDIUM — determines response ranking (feature-level first); must be one of exactly: "feature-level", "architecture-level", "repo-conventions" |
| `matches` | Aggregated scan results (array) | Response Formatter (core) | Response body top-level field | LOW — new field, no existing consumer; empty array vs absent field: ALWAYS present as array (empty or populated), never absent |
| `rejected_paths` | Rejection-pattern detection results (array) | Rejection Detector (core, pure function) | Response body top-level field | LOW — new field; ALWAYS present as array (empty or populated), never absent |
| `searched_repos` | List of repos successfully scanned (not skipped) | Response Formatter (core) | CONCERN_NOT_FOUND error body | LOW — helps agent understand scan coverage; only populated in CONCERN_NOT_FOUND |

---

## Integration Validation Checklist

- [ ] `source_file` paths in matches and rejected_paths are absolute and match the format of query_context source_file paths (same DocTreeReader output)
- [ ] `retrieved_at` is present on EVERY response shape: full match, partial match (warnings), CONCERN_NOT_FOUND, INVALID_CONCERN
- [ ] `warnings` is always a string array (never null, never absent), consistent with query_context warnings contract
- [ ] `matches` and `rejected_paths` are always arrays (never null, never absent), even when empty
- [ ] `repo_name` values in response exactly match config repo-name values (case-sensitive)
- [ ] `relevance` field contains exactly one of: "feature-level", "architecture-level", "repo-conventions" — no other values
- [ ] `concern` is echoed in the response verbatim (trimmed of leading/trailing whitespace, but otherwise not modified)
