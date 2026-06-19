# User Stories: list-concerns

## System Constraints (carried forward, unchanged)

- **Read-only, local-only, no-cache**: same as `resolve_concern` — scans content already read per-call, no new IO patterns.
- **Functional core / imperative shell**: aggregation logic is a pure function in `src/core/`.
- **No new npm dependency**: reuses `detectHeadingLines`/`HEADING_PATTERN` already shipped in `heading-anchored-snippets`.

---

## US-LC-01: Agent Browses Available Concern Topics Before Querying

### Job Traceability
Traces to `cross-repo-context-grounding` (jobs.yaml) — specifically the gap documented in README's "Using LoreMCP while architecting" section: `resolve_concern` only helps if the agent already knows which keyword to ask about.

### Problem
Maria (OSS maintainer, dogfooding lore-mcp via Claude Code) is about to design a new feature and wants to check what's already been decided — but she doesn't know in advance whether the relevant topic is called "auth," "authentication," "session management," or something else entirely. She has to guess keywords blind into `resolve_concern`, getting `CONCERN_NOT_FOUND` on near-misses.

### Who
- AI coding agent (Claude Code) | About to start DISCUSS or DESIGN on a new feature | Motivation: see the landscape of already-decided topics across sibling repos before guessing a keyword

### Solution
A new MCP tool `list_concerns()` (no arguments) that scans all configured repos and returns candidate concern strings drawn from feature directory names, ADR titles, and heading text — closing the "browse before you query" gap.

### Elevator Pitch
Before: The agent must already know the exact keyword to ask `resolve_concern` about, or it risks `CONCERN_NOT_FOUND` on a near-miss (e.g. asking "auth" when the repo calls it "session-management").
After: run `list_concerns()` → sees `{"concerns": ["auth-flow", "rate-limiting", "concern matching", "heading-anchored", ...], "searched_repos": ["lore-mcp"]}` — the actual landscape of decided topics, before guessing.
Decision enabled: The agent picks a real topic from the list and calls `resolve_concern(concern)` with confidence, instead of guessing and re-guessing keywords.

### Domain Examples

#### 1: Happy Path — Multiple repos, distinct topics
Two configured repos: `lore-mcp` (with `auth-flow`, `concern-based-querying`, `heading-anchored-snippets` feature dirs and `adr-005-concern-matching-strategy.md`) and `shared-libs` (with `rate-limiting` feature dir). `list_concerns()` returns a deduplicated list including all of these topic strings, with `searched_repos: ["lore-mcp", "shared-libs"]`.

#### 2: Edge Case — One repo has no nWave structure
`shared-libs` has no `docs/feature/` and no ADRs at all. `list_concerns()` still returns candidates from `lore-mcp` only, `searched_repos` lists both repos that were probed, and the response is not an error.

#### 3: Edge Case — Duplicate topic across repos
Both `lore-mcp` and `shared-libs` have a `rate-limiting` feature directory. `list_concerns()` returns `"rate-limiting"` exactly once.

### UAT Scenarios (BDD)
See `docs/feature/list-concerns/discuss/journey-concern-discovery.feature` — 5 scenarios covering: multi-repo candidate aggregation, silent repo exclusion, all-repos-empty case, deduplication, and the 200-entry cap with truncation warning.

### Acceptance Criteria
1. **Given** configured repos with feature directories and ADRs with distinct topic names, **when** `list_concerns()` is called via the MCP tool, **then** the response contains candidate concern strings drawn from those directory names and ADR titles, plus `searched_repos`.
2. **Given** one configured repo has nWave structure and another has none, **when** `list_concerns()` is called, **then** the response contains candidates only from the repo with structure, and is not an error.
3. **Given** no configured repo has any nWave structure, **when** `list_concerns()` is called, **then** the response contains an empty `concerns` array, lists `searched_repos`, and is not an error.
4. **Given** two repos both have a feature directory or ADR named after the same topic, **when** `list_concerns()` is called, **then** that topic appears exactly once in the response.
5. **Given** the configured repos collectively have more than 200 distinct topic-like names, **when** `list_concerns()` is called, **then** the response contains at most 200 entries and includes a truncation warning.
