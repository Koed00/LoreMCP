# LoreMCP

A local, read-only MCP server that gives an AI coding agent live access to [nWave](https://github.com/Koed00)-structured documentation from a configured list of sibling repos.

**The problem**: AI agents working in a codebase start each session blind. They have no way to query prior architectural decisions, domain constraints, or feature-level context before they act — so they reinvent patterns, contradict last sprint's decisions, or miss domain rules any experienced team member would know.

**What LoreMCP does**: Exposes two MCP tools — `list_features` and `query_context` — that read wave-decisions, ADRs, and `CLAUDE.md` directly from your local filesystem and return them as structured JSON. No daemon, no sync, no remote calls. Point it at a folder, and your agent can ask "what decisions were made for feature X?" before writing a single line.

---

## Installation

```bash
npx lore-mcp
```

Or install globally:

```bash
npm install -g lore-mcp
```

---

## Configuration

Create a `lore-mcp.config.json` anywhere on disk:

```json
[
  { "repo-name": "my-api",      "doc-path": "/Users/you/code/my-api/docs" },
  { "repo-name": "shared-libs", "doc-path": "/Users/you/code/shared-libs/docs" },
  { "repo-name": "lore-mcp",    "doc-path": "/Users/you/code/LoreMCP/docs" }
]
```

Each entry maps a logical name to the `docs/` directory of a sibling repo. The server expects nWave document structure under that path:

```
docs/
  feature/{feature_id}/{phase}/wave-decisions.md   ← feature-level decisions
  product/architecture/*.md                         ← ADRs
CLAUDE.md                                           ← repo root crafter guidance
```

Point the server at your config via the `LORE_MCP_CONFIG` environment variable (defaults to `lore-mcp.config.json` in the working directory):

```bash
LORE_MCP_CONFIG=/path/to/lore-mcp.config.json npx lore-mcp
```

---

## MCP Tools

### `list_features`

Enumerates `docs/feature/*/` and phase subdirectories for a configured repo.

**Input**: `repo_name` (string)

**Output** (success):
```json
{
  "repo_name": "my-api",
  "doc_path": "/Users/you/code/my-api/docs",
  "features": [
    { "feature_id": "auth", "phases": ["discover", "design", "deliver"] },
    { "feature_id": "payments", "phases": ["discover"] }
  ],
  "has_architecture_adrs": true,
  "has_claude_md": true
}
```

---

### `query_context`

Returns live-read snippets from wave-decisions, ADRs, and/or `CLAUDE.md` for a given repo and feature.

**Input**: `repo_name` (string), `feature_id` (string)

**Output** (full structure):
```json
{
  "repo_name": "my-api",
  "feature_id": "auth",
  "results": [
    {
      "source_file": "docs/feature/auth/design/wave-decisions.md",
      "phase": "design",
      "snippet": "# Auth Decisions\n\nD-auth-1: Use JWT with RS256..."
    },
    {
      "source_file": "docs/product/architecture/adr-001-auth-strategy.md",
      "phase": "architecture",
      "snippet": "# ADR-001: Auth Strategy\nStatus: Accepted\n..."
    }
  ],
  "retrieved_at": "live (uncached) read at 2026-06-16T10:07:33.412Z"
}
```

**Partial structure** (feature dir absent but ADRs/CLAUDE.md exist — returns best available context with a warning):
```json
{
  "repo_name": "my-api",
  "feature_id": "nonexistent-feature",
  "results": [{ "source_file": "docs/product/architecture/adr-001.md", ... }],
  "warnings": ["Repo has architecture ADRs but no feature-level wave-decisions.md for the requested feature."],
  "retrieved_at": "live (uncached) read at ..."
}
```

**Structured errors** (never raw exceptions):

| Error | When |
|-------|------|
| `REPO_NOT_CONFIGURED` | `repo_name` not in config |
| `REPO_PATH_NOT_FOUND` | configured `doc-path` doesn't exist or isn't readable |
| `FEATURE_NOT_FOUND` | feature dir absent and no ADRs/CLAUDE.md to fall back on |
| `NO_NWAVE_STRUCTURE` | repo has no nWave artifacts at all |

---

## Claude Code setup

Add to your Claude Code MCP config (`~/.claude/claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "lore-mcp": {
      "command": "npx",
      "args": ["lore-mcp"],
      "env": {
        "LORE_MCP_CONFIG": "/absolute/path/to/lore-mcp.config.json"
      }
    }
  }
}
```

---

## Design principles

- **Live reads, no cache** — every tool call reads from disk fresh. Edits to your docs are visible on the very next query, no server restart needed (ADR-004).
- **Structured errors only** — all failure modes return one of four documented JSON shapes. Raw exceptions never reach the agent.
- **Functional core / imperative shell** — pure classification and formatting logic (`src/core/`) is fully tested with in-memory fixtures; only `src/shell/` touches the filesystem and MCP transport.
- **Read-only** — LoreMCP never writes to any repo. It is a read lens, not a write path.

---

## Development

```bash
npm install
npm test          # vitest, 158 tests
npm run typecheck
npm run check:arch  # dependency-cruiser: core must not import shell
npm run test:mutation  # stryker, ≥80% kill rate gate
```

---

## License

MIT
