# Architecture Design -- concern-based-querying

## Feature: resolve_concern(concern: string)

This document is the primary handoff artifact for the software-crafter (DELIVER wave).
It lists every file to touch, what changes, and what the new pure-function contracts
look like — without specifying internal implementation.

---

## Changes Per File

| File | Change type | What changes |
|------|-------------|--------------|
| `src/core/concern-matcher.ts` | **NEW** | New module. All concern-matching and rejected-path-detection pure functions. See section below for types and function contracts. |
| `src/core/format-response.ts` | **Extend** | Add new types: `ConcernMatch`, `RejectedPath`, `ResolveConcernResponse`, `ConcernNotFoundError`, `InvalidConcernError`. Add new formatter functions: `formatInvalidConcern`, `formatConcernNotFound`, `formatResolveConcernResponse`. Add `InvalidConcernError` and `ConcernNotFoundError` to the `StructuredError` union. |
| `src/shell/server.ts` | **Extend** | Register new MCP tool `resolve_concern` (alongside existing tools). Import new types/functions from `concern-matcher.ts` and `format-response.ts`. Add handler following established pattern: validate input → load config → iterate all repos → probe + snapshot + match → aggregate → format → return. No changes to existing `list_features` or `query_context` handlers. |
| `src/shell/fs-doc-tree-reader.ts` | **No change** | Reused as-is. `DocTreeReader` interface covers all operations needed by the new handler. |
| `src/core/classify-structure.ts` | **No change** | Reused as-is. `TreeSnapshot` type is the shared input structure for concern scanning. Relevance-tier logic is NOT extracted into a shared helper (the concern-matcher derives tier from file path directly — simpler than importing classify-structure for a string mapping). |

---

## New File: `src/core/concern-matcher.ts`

### Responsibility

Pure functions that take a concern string and pre-collected file content (no fs access)
and return: which files match the concern, their relevance tier, and which paragraphs
contain rejection language.

### Types

```
ConcernScanInput {
  concern: string                          // already validated non-empty, trimmed
  repoName: string
  docPath: string
  // Pre-collected content maps from TreeSnapshot + shell reads:
  featureFiles: Array<{
    sourceFile: string                     // repo-root-relative path
    phase: string
    content: string
  }>
  adrFiles: Array<{
    sourceFile: string
    content: string
  }>
  claudeMdFile: { sourceFile: string; content: string } | null
  // Feature directory names (for directory-name matching, US-CBQ-01 DE-2)
  featureDirectoryNames: string[]
}

ConcernMatch {
  repoName: string
  sourceFile: string
  phase: string
  snippet: string                          // whole file content, size-capped
  relevance: "feature-level" | "architecture-level" | "repo-conventions"
}

RejectedPath {
  repoName: string
  sourceFile: string
  snippet: string                          // rejection paragraph, capped at 1500 chars
  type: "rejected_alternative"
}

ConcernScanResult {
  matches: ConcernMatch[]
  rejectedPaths: RejectedPath[]
  truncationWarnings: string[]             // from snippet size-capping
}
```

### Function Contracts (inputs → outputs, no implementation)

`validateConcern(concern: string): { valid: true } | { valid: false; reason: string }`
- Returns `{ valid: false }` if concern is empty after trimming, or contains no
  alphanumeric character (`/[a-zA-Z0-9]/` test).
- Returns `{ valid: true }` otherwise.
- Pure. No side effects.

`matchConcernInSnapshot(input: ConcernScanInput): ConcernScanResult`
- For each file in `featureFiles`: if the file's content contains `concern` (case-
  insensitive substring) OR the file's directory path contains a `featureDirectoryNames`
  entry that itself contains `concern` (case-insensitive), include as a `ConcernMatch`
  with `relevance: "feature-level"`.
- For each file in `adrFiles`: if content contains `concern` (case-insensitive), include
  as `ConcernMatch` with `relevance: "architecture-level"`.
- If `claudeMdFile` is non-null and its content contains `concern` (case-insensitive),
  include as `ConcernMatch` with `relevance: "repo-conventions"`.
- Snippet per match: full file content, truncated at 8 000 characters (heading-aligned).
  Truncation produces a `truncationWarnings` entry.
- Additionally, for EVERY file that is a `ConcernMatch`, run rejection detection (see
  `detectRejectedPaths`). A file can appear in BOTH `matches` and `rejectedPaths` with
  different snippet content.
- Within `matches`, ordering: feature-level entries first, then architecture-level, then
  repo-conventions. Within the same tier, preserve the order files were supplied in
  `ConcernScanInput` (caller supplies them in config order, which is deterministic).
- Returns `{ matches, rejectedPaths, truncationWarnings }`.
- Pure. No side effects.

`detectRejectedPaths(sourceFile: string, repoName: string, phase: string, content: string, concern: string): RejectedPath[]`
- Splits content into paragraphs (contiguous blocks of non-blank lines separated by one
  or more blank lines).
- For each paragraph: if it contains `concern` (case-insensitive) AND contains at least
  one rejection keyword (case-insensitive, see list in ADR-005 / D-CBQ-D2), create a
  `RejectedPath` entry with that paragraph as `snippet` (capped at 1 500 characters).
- Returns zero or more `RejectedPath` entries for the file.
- Pure. No side effects.

---

## Extended: `src/core/format-response.ts`

### New Types

```
InvalidConcernError {
  error: "INVALID_CONCERN"
  concern: string
  message: string
  retrievedAt: string
}

ConcernNotFoundError {
  error: "CONCERN_NOT_FOUND"
  concern: string
  message: string
  searchedRepos: string[]           // repos where probe succeeded
  warnings?: string[]               // skipped-repo notices
  retrievedAt: string
}

ResolveConcernResponse {
  concern: string
  matches: ConcernMatch[]
  rejectedPaths: RejectedPath[]
  warnings?: string[]
  retrievedAt: string
}
```

`StructuredError` union gains `InvalidConcernError | ConcernNotFoundError`.

### New Formatter Functions

`formatInvalidConcern(concern: string): InvalidConcernError`
- Constructs the `INVALID_CONCERN` error shape with a helpful message referencing the
  concern value and explaining the requirement (non-empty, at least one alphanumeric char).
- `retrievedAt`: ISO timestamp or `"live (no cache)"` (consistent with existing pattern).

`formatConcernNotFound(concern: string, searchedRepos: string[], skipWarnings: string[]): ConcernNotFoundError`
- Constructs the `CONCERN_NOT_FOUND` error. `searchedRepos` = repos that were
  successfully probed. `warnings` = skip notices for repos that failed probe.

`formatResolveConcernResponse(concern: string, allMatches: ConcernMatch[], allRejectedPaths: RejectedPath[], warnings: string[]): ResolveConcernResponse`
- Constructs the success response. Appends partial-structure warning to `warnings` if
  no entry in `allMatches` has `relevance: "feature-level"` (US-CBQ-04 AC 1).
- `warnings` omitted from output if empty (consistent with existing pattern).
- `rejectedPaths` always present (as `[]` if empty) — never omitted.

---

## Extended: `src/shell/server.ts`

### New Tool Registration

```
server.registerTool(
  "resolve_concern",
  {
    description: "Search all configured repos for nWave artifacts mentioning concern,
      returning matches (with relevance tier), rejected alternatives, and partial-
      structure warnings. No repo_name required.",
    inputSchema: { concern: z.string() },
  },
  async ({ concern }) => { ... }
)
```

### Handler Logic (sequential steps — crafter owns implementation)

1. Validate concern via `validateConcern(concern)`. If invalid, return
   `toToolResult(formatInvalidConcern(concern))` immediately (no config load, no fs access).
2. Load config via `loadConfig(options.configPath)`. On error, return
   `toToolResult({ error: "CONFIG_ERROR", message: ... })`.
3. For each `entry` in `repos` (in config order):
   a. `probe(entry.docPath)`. On failure, add skip warning; continue to next entry.
   b. `buildTreeSnapshot(reader, entry)` (existing helper).
   c. Read all files from the snapshot (feature files, ADR files, CLAUDE.md) using
      `reader.readFile`. Collect as `ConcernScanInput`.
   d. Call `matchConcernInSnapshot(input)`. Accumulate `matches`, `rejectedPaths`,
      `truncationWarnings`, and record `entry.repoName` as successfully scanned.
4. Build aggregated `warnings` = skip warnings + truncation warnings from all repos.
   Add partial-structure warning via `formatResolveConcernResponse` (it handles that check).
5. If `matches.length === 0`: return
   `toToolResult(formatConcernNotFound(concern, searchedRepos, skipWarnings))`.
6. Otherwise: return
   `toToolResult(formatResolveConcernResponse(concern, matches, rejectedPaths, warnings))`.

Note: `toSnakeCaseKeys` is applied via `toToolResult(...)` automatically, as with all
existing tool responses. No special handling needed.

---

## File Reading Strategy for resolve_concern

`resolve_concern` must read ALL nWave files in a repo to perform keyword matching, whereas
`query_context` reads only structurally-selected files. In the shell handler, for each
probed repo the crafter should:

1. Re-use `buildTreeSnapshot(reader, entry)` to enumerate all file paths (as `TreeSnapshot`).
2. Read every file listed in `snapshot.adrFiles` and `snapshot.claudeMdPath` via
   `reader.readFile` (resolving relative paths against `repoRoot = path.dirname(entry.docPath)`).
3. For features, enumerate all phase files:
   - For each `featureId` and `phases` in `snapshot.features`, check for
     `wave-decisions.md` and `feature-delta.md` in each phase directory via `reader.readFile`.
4. TOCTOU failures (file listed but unreadable) are silently skipped for concern scanning
   (same pattern as `readClassifiedFiles`). They do NOT add warnings (concern scanning is
   best-effort; the absence of one file does not invalidate the scan).

The `featureDirectoryNames` field in `ConcernScanInput` = `Object.keys(snapshot.features)`.

---

## Response Contracts (MCP JSON — snake_case via toSnakeCaseKeys)

### Success
```json
{
  "concern": "auth",
  "matches": [
    {
      "repo_name": "nwave-cli",
      "source_file": "docs/feature/auth-flow/design/wave-decisions.md",
      "phase": "design",
      "snippet": "## D-auth: JWT strategy...",
      "relevance": "feature-level"
    }
  ],
  "rejected_paths": [
    {
      "repo_name": "nwave-cli",
      "source_file": "docs/product/architecture/ADR-0007-auth-strategy.md",
      "snippet": "## Rejected: OAuth2\nRationale: too complex...",
      "type": "rejected_alternative"
    }
  ],
  "warnings": [],
  "retrieved_at": "live (no cache)"
}
```

### CONCERN_NOT_FOUND
```json
{
  "error": "CONCERN_NOT_FOUND",
  "concern": "graphql-federation",
  "message": "No matches found for 'graphql-federation' in any configured repo. This concern may be undecided.",
  "searched_repos": ["ab-mcp"],
  "warnings": [],
  "retrieved_at": "live (no cache)"
}
```

### INVALID_CONCERN
```json
{
  "error": "INVALID_CONCERN",
  "concern": "",
  "message": "concern must be a non-empty string containing at least one alphanumeric character. Provide a plain-language topic (e.g., 'auth', 'data persistence', 'rate-limiting').",
  "retrieved_at": "live (no cache)"
}
```

---

## Test Fixture Guidance (for DISTILL / acceptance-designer)

The following fixture repo structures are needed to cover all UAT scenarios:

| Fixture | Contents | Exercises |
|---------|----------|-----------|
| `single-repo-auth` | `docs/feature/auth-flow/design/wave-decisions.md` (contains "auth"), `docs/product/architecture/ADR-0007-auth-strategy.md` (contains "auth" + "Rejected: OAuth2") | US-CBQ-01 DE-1, UAT scenario 1; US-CBQ-03 UAT scenario 1 |
| `dir-name-match` | `docs/feature/logging/discuss/wave-decisions.md` (body contains "structured output", NOT "logging") | US-CBQ-01 DE-2 (directory name match) |
| `no-match` | No files mention "graphql-federation" | US-CBQ-01 DE-3, CONCERN_NOT_FOUND |
| `multi-repo-persistence` | Two repos: one with feature-level "data persistence", one with ADR "data persistence"; one repo with broken doc_path | US-CBQ-02 all scenarios |
| `rejection-out-of-scope` | `docs/feature/ab-mcp/discuss/wave-decisions.md` (contains "Out of scope: caching/invalidation layer") | US-CBQ-03 DE-2 |
| `adr-only` | Only ADR mentions "rate-limiting", no wave-decisions.md matches | US-CBQ-04 partial-structure warning |
| `empty-concern` | Any valid config | US-CBQ-04 INVALID_CONCERN |

---

## Earned Trust: Probe Contract Extension

The existing `DocTreeReader.probe()` contract (brief.md Section 9) covers all scenarios
needed by `resolve_concern` — per-repo probe before scanning is already specified. No new
probe scenarios are introduced. The behavioral gold test (`fs-doc-tree-reader.probe.test.ts`)
requires no additions.

The `matchConcernInSnapshot` and `detectRejectedPaths` functions are pure; their "probe"
is the test suite itself (no substrate dependency to lie). The meta-test
(`probe-contract.test.ts`) already ensures probe tests exist; it requires no changes.
