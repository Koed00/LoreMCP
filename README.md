# LoreMCP

A local, read-only MCP server that gives an AI coding agent live access to [nWave](https://github.com/nWave-ai/nWave)-structured documentation from a configured list of sibling repos.

**The problem**: AI agents working in a codebase start each session blind. They have no way to query prior architectural decisions, domain constraints, or feature-level context before they act — so they reinvent patterns, contradict last sprint's decisions, or miss domain rules any experienced team member would know.

**What LoreMCP does**: Exposes four MCP tools — `list_concerns`, `list_features`, `query_context`, and `resolve_concern` — that read wave-decisions, ADRs, and `CLAUDE.md` directly from your local filesystem and return them as structured JSON. No daemon, no sync, no remote calls. Point it at a folder, and your agent can ask "what topics are already decided?", "what decisions were made for feature X?", or "what does the platform use for auth?" before writing a single line.

---

## Installation

```bash
npx @koed00/lore-mcp
```

Or install globally:

```bash
npm install -g @koed00/lore-mcp
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
LORE_MCP_CONFIG=/absolute/path/to/lore-mcp.config.json npx @koed00/lore-mcp
```

---

## MCP Tools

### `list_concerns`

Scans all configured repos for candidate concern/topic strings (feature directory names, ADR titles, decision heading text) an agent can browse before calling `resolve_concern`. No arguments.

**Input**: none

**Output**:
```json
{
  "concerns": ["auth-flow", "rate-limiting", "Concern Matching Strategy"],
  "searched_repos": ["my-api", "shared-libs"]
}
```

Candidates are deduplicated across repos. Capped at 200 entries (a `warnings` entry is added if truncated). `warnings` is only present when non-empty. Never returns an error shape — an empty `concerns` array is a valid response when no configured repo has nWave structure.

---

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

### `resolve_concern`

Searches all configured repos for nWave artifacts mentioning a concern keyword, returning matches ranked by relevance tier, rejected alternatives, and partial-structure warnings. No `repo_name` required — scans everything.

**Input**: `concern` (string) — a plain-language topic, e.g. `"auth"`, `"data persistence"`, `"rate-limiting"`

**Output** (success):
```json
{
  "concern": "auth",
  "matches": [
    {
      "repo_name": "my-api",
      "source_file": "docs/feature/auth-flow/design/wave-decisions.md",
      "phase": "design",
      "snippet": "## D-auth: JWT strategy...",
      "relevance": "feature-level"
    },
    {
      "repo_name": "my-api",
      "source_file": "docs/product/architecture/ADR-0007-auth-strategy.md",
      "phase": "architecture",
      "snippet": "# ADR-0007: Auth Strategy\nStatus: Accepted\n...",
      "relevance": "architecture-level"
    }
  ],
  "rejected_paths": [
    {
      "repo_name": "my-api",
      "source_file": "docs/product/architecture/ADR-0007-auth-strategy.md",
      "snippet": "Rejected: OAuth2 — too complex for current scale.",
      "type": "rejected_alternative"
    }
  ],
  "retrieved_at": "live (no cache)"
}
```

Matches are ordered: `feature-level` first, then `architecture-level`, then `repo-conventions`. `rejected_paths` is always present (empty array if none found).

**Structured errors**:

| Error | When |
|-------|------|
| `INVALID_CONCERN` | concern is empty or contains no alphanumeric characters |
| `CONCERN_NOT_FOUND` | no file in any configured repo mentions the concern |

---

## Claude Code setup

Add to your Claude Code MCP config (`~/.claude/claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "lore-mcp": {
      "command": "npx",
      "args": ["@koed00/lore-mcp"],
      "env": {
        "LORE_MCP_CONFIG": "/absolute/path/to/lore-mcp.config.json"
      }
    }
  }
}
```

---

## Using LoreMCP while architecting

LoreMCP is most valuable in the DISCUSS and DESIGN phases of a wave-based workflow (e.g. [nWave](https://github.com/nWave-ai/nWave)) — before code is written, when an agent needs to know what's already been decided elsewhere. `resolve_concern` alone only helps if the agent already knows which keyword to ask about; start with `list_concerns` for a "browse before you query" pass across every configured repo:

1. **Browse broadly**: call `list_concerns()` with no arguments to see every candidate concern/topic string across *all* configured repos — feature directory names, ADR titles, decision heading text — without needing to know a repo name or a keyword in advance.
2. **Browse a known repo**: call `list_features(repo_name)` on a specific sibling repo you already know about to see what features/phases it has documented.
3. **Search broadly**: call `resolve_concern(concern)` for each topic that might be relevant to what you're about to design (e.g. `"auth"`, `"rate-limiting"`, `"caching"`) — it scans every configured repo, no `repo_name` needed, and surfaces both accepted decisions and rejected alternatives.
4. **Go deep**: once `resolve_concern`, `list_concerns`, or `list_features` points you to a specific repo + feature, call `query_context(repo_name, feature_id)` for that feature's full decision history across every wave, not just a keyword-matched snippet.

**Example prompt to an agent**: *"Before designing the rate-limiting strategy for this service, use lore-mcp's list_concerns to see what topics are already documented across sibling repos, then use resolve_concern to check whether any of them already decided how to do rate-limiting, and check for any rejected alternatives before proposing a new approach."*

---

## Enforcing LoreMCP usage across a team

A single developer remembering to prompt their agent is fragile — it doesn't survive onboarding, a busy week, or a different agent session. The reliable fix is to put the instruction where every agent session already looks: the repo's `CLAUDE.md`. Any team lead or devops manager can paste the block below into the project's `CLAUDE.md` once, and every developer's agent picks up the workflow automatically, with no per-prompt reminder needed.

```markdown
## Cross-Repo Context (LoreMCP)

This repo is part of a multi-repo platform. Before designing or architecting
any non-trivial feature, use the `lore-mcp` MCP tools to check what's already
been decided elsewhere — do not assume a clean slate:

1. Call `list_concerns()` to see what topics are already documented across
   all configured sibling repos.
2. Call `resolve_concern(concern)` for any topic that overlaps with what
   you're about to build, to find existing decisions AND rejected
   alternatives before proposing something new.
3. Call `query_context(repo_name, feature_id)` once you've found the
   relevant repo + feature, to read its full decision history.

Do this BEFORE writing an architecture doc, a design proposal, or
significant new code — not after. If `resolve_concern` surfaces a rejected
alternative that matches your plan, treat that as a strong signal to
reconsider, not just a data point to mention in passing.
```

This works because `CLAUDE.md` is read automatically at the start of every Claude Code session in the repo — the instruction reaches every agent invocation without relying on any individual developer's prompt. If your team uses [nWave](https://github.com/nWave-ai/nWave), this pairs naturally with the existing `## Development Paradigm` convention already documented there.

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
npm test          # vitest, 442 tests
npm run typecheck
npm run check:arch  # dependency-cruiser: core must not import shell
npm run test:mutation  # stryker, ≥80% kill rate gate
```

---

## Releasing

Publishing to npm is intentionally manual (no npm token in CI — see `.github/workflows/ci.yml`'s comment on this trade-off). Every release follows this sequence:

1. Merge the feature/fix PR(s) to `main`.
2. On `main`: bump the version (`npm version patch|minor|major --no-git-tag-version`), matching [semver](https://semver.org/) to the change — a new public MCP tool is `minor`, a bug/doc fix is `patch`.
3. Run the full gate locally: `npm run build && npm test && npm run check:arch`.
4. Commit the version bump (`chore: bump version to X.Y.Z`) and push to `main`.
5. Publish: `npm publish --access public` (requires OTP/2FA).
6. **Tag and release** — this is the step that's easy to forget, so it's spelled out here:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   gh release create vX.Y.Z --title "vX.Y.Z — <one-line summary>" --notes "<what changed, why, link to the PR>"
   ```

Every published npm version should have a matching git tag and GitHub Release — release notes are the changelog, written once, not reconstructed later from PR history.

---

## License

MIT
