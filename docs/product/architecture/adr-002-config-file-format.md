# ADR-002: Configuration File Format

## Status
Proposed (Recommendation pending stakeholder confirmation -- Propose-mode DESIGN output)

## Context

ab-mcp requires a configuration file holding a list of `{repo-name, doc-path}` entries (D-config/H4: 3 baseline entries, must scale to 10+ via appending entries only, no schema changes). The config is hand-edited by the solo maintainer (Maria) when adding/removing sibling repos.

## Decision

Use **JSON** for the configuration file (`ab-mcp.config.json`), parsed via Node's native `JSON.parse`, validated with a small hand-written type guard (escalate to `zod` only if validation logic grows beyond ~20 lines).

Example shape:
```json
{
  "repos": [
    { "repo-name": "ab-mcp", "doc-path": "/Users/maria/code/AB-MCP/docs" },
    { "repo-name": "nwave-cli", "doc-path": "/Users/maria/code/nwave-cli/docs" }
  ]
}
```

## Alternatives Considered

### YAML
- Pros: human-friendly, supports comments, common for config files
- Cons: requires an additional parser dependency (`yaml` or `js-yaml`); YAML's implicit type coercion (e.g., unquoted `no`/`yes`/`on`/`off` parsed as booleans, octal-like number coercion) is a known footgun for path-like strings; inconsistent with the JSON convention already used by Claude Code's own MCP server configuration files (`.mcp.json`), which this stakeholder already edits
- Rejected: extra dependency + type-coercion risk with no shape benefit, given the config is a flat list of 2-field objects

### TOML
- Pros: explicit typing, good for hand-edited configs, no coercion ambiguity
- Cons: requires an additional parser dependency; no meaningful ecosystem-fit advantage over JSON in the Node/MCP context; less familiar to the stakeholder than JSON (which they already use for MCP configs)
- Rejected: extra dependency for no benefit at this config shape's complexity

## Consequences

### Positive
- Zero additional runtime dependency for parsing (native `JSON.parse`)
- Matches the JSON convention already used in adjacent MCP tooling configs the stakeholder edits
- Flat list-of-objects shape trivially supports "append entry, no schema change" (D-config/H4)

### Negative
- No native comment support -- if the maintainer wants to annotate config entries (e.g., "temporarily disabled"), this must be documented via README convention or a future `"enabled": false` field (schema-compatible addition, not a redesign) rather than inline comments
