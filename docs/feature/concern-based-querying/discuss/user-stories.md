<!-- markdownlint-disable MD024 -->
# User Stories: concern-based-querying

## System Constraints

- **Read-only**: resolve_concern MUST NOT write/modify any file in any configured repo. All operations are filesystem reads.
- **Local only**: resolve_concern runs within the existing lore-mcp local MCP server; no network calls, no hosted service.
- **No caching**: resolve_concern reads the filesystem live on every call (ADR-004, no-cache property). retrieved_at must appear on every response.
- **Keyword matching only (MVP)**: concern matching is case-insensitive keyword search in file content and directory names. No semantic/vector search (confirmed out of scope).
- **nWave-structured repos only**: same constraint as query_context — repos without nWave structure return per-repo warnings and are skipped, not error-aborting the full scan.
- **Structured errors only**: all failure conditions return JSON error objects with error, message, and recovery-relevant fields — never raw exceptions.
- **Functional core / imperative shell**: concern classification, ranking, and rejected-path detection are pure functions in src/core/. Filesystem access lives exclusively in src/shell/ (CLAUDE.md development paradigm).
- **Extends existing server**: resolve_concern is a new tool registered alongside list_features and query_context. No changes to existing tools' behaviour or response shapes.

---

## US-CBQ-01: Walking Skeleton — Agent Resolves a Concern Against a Single Repo

### Problem

Maria Santos (OSS maintainer) is using Claude Code to design a new feature in a sibling repo and asks "what does our platform use for auth?". Today, the agent has to know which repo and which feature_id contains auth decisions before it can call query_context — a chicken-and-egg problem when working on a new feature. There is no way to ask "what owns auth?" without already knowing the answer.

### Who

- AI coding agent (Claude Code) | Operating in any repo, about to design a feature | Motivation: find the authoritative auth convention without knowing in advance which repo or feature_id to look in

### Solution

A new MCP tool `resolve_concern(concern: string)` that keyword-matches the concern string in nWave artifact content across configured repos, returning matches with source_file, phase, snippet, and relevance — proving the core keyword-match-and-return loop works end-to-end against a single repo.

### Elevator Pitch

Before: The agent must already know `repo_name="nwave-cli"` and `feature_id="auth-flow"` to retrieve auth decisions. Before designing, it has neither, and query_context cannot help.
After: run `resolve_concern(concern="auth")` → sees `{"concern": "auth", "matches": [{"repo_name": "nwave-cli", "source_file": ".../auth-flow/design/wave-decisions.md", "phase": "design", "snippet": "## D-auth: JWT strategy...", "relevance": "feature-level"}], "warnings": [], "retrieved_at": "live (no cache)"}`.
Decision enabled: The agent decides to follow the JWT auth convention from nwave-cli's design wave decisions, citing the source_file and snippet as justification — grounded in live content, not training data.

### Domain Examples

#### 1: Happy Path — Agent resolves "auth" concern in nwave-cli
Maria is adding a new service that needs authentication. Claude Code calls `resolve_concern(concern="auth")`. lore-mcp scans nwave-cli's docs (the only configured repo for this story) and finds `docs/feature/auth-flow/design/wave-decisions.md` containing "auth" and `docs/product/architecture/ADR-0007-auth-strategy.md`. Returns both as matches — the wave-decisions.md result with `relevance: "feature-level"` ranked first.

#### 2: Edge Case — Concern matches a feature directory name but not its content
Claude Code calls `resolve_concern(concern="logging")`. nwave-cli has `docs/feature/logging/` but the wave-decisions.md inside only discusses "structured output format" without using the word "logging" in the body. Directory name match still surfaces the feature; snippet shows the content. Relevance is "feature-level" (matched by directory name).

#### 3: Error/Boundary — No match found in the single configured repo
Claude Code calls `resolve_concern(concern="graphql-federation")`. The single configured repo (ab-mcp) has no documents mentioning "graphql-federation". Response: `{"error": "CONCERN_NOT_FOUND", "concern": "graphql-federation", "message": "No matches found for 'graphql-federation' in any configured repo. This concern may be undecided.", "searched_repos": ["ab-mcp"], "retrieved_at": "live (no cache)"}`.

### UAT Scenarios (BDD)

#### Scenario: Agent resolves concern with feature-level and architecture-level matches
```gherkin
Given ab-mcp is configured with one repo: {repo-name: "nwave-cli", doc-path: "<nwave-cli>/docs"}
And "nwave-cli" has docs/feature/auth-flow/design/wave-decisions.md containing the word "auth"
And "nwave-cli" has docs/product/architecture/ADR-0007-auth-strategy.md containing the word "auth"
When the agent calls resolve_concern(concern="auth")
Then the response contains matches with at least 2 results
And one match has relevance "feature-level" with source_file ending in "wave-decisions.md"
And one match has relevance "architecture-level" with source_file ending in ".md" under "architecture/"
And "retrieved_at" is present indicating a live read
```

#### Scenario: Agent resolves concern matched by feature directory name
```gherkin
Given ab-mcp is configured with {repo-name: "nwave-cli", doc-path: "<nwave-cli>/docs"}
And "nwave-cli" has a docs/feature/logging/ directory
And the wave-decisions.md inside uses "structured output" but not the word "logging"
When the agent calls resolve_concern(concern="logging")
Then the response contains at least one match with source_file under "logging/"
And "retrieved_at" is present
```

#### Scenario: CONCERN_NOT_FOUND when no repo content matches
```gherkin
Given ab-mcp is configured with {repo-name: "ab-mcp", doc-path: "<ab-mcp>/docs"}
And no file in any configured repo contains "graphql-federation" or has a feature dir named "graphql-federation"
When the agent calls resolve_concern(concern="graphql-federation")
Then the response is an error "CONCERN_NOT_FOUND"
And searched_repos contains "ab-mcp"
And "retrieved_at" is present
```

#### Scenario: resolve_concern is available as a registered MCP tool
```gherkin
Given lore-mcp is running with its existing config
When the agent lists available MCP tools
Then resolve_concern appears alongside list_features and query_context
And resolve_concern accepts a concern parameter of type string
```

### Acceptance Criteria

- [ ] `resolve_concern(concern)` is registered as a new MCP tool on the existing lore-mcp server, alongside list_features and query_context
- [ ] Keyword match is case-insensitive and searches both file CONTENT and docs/feature/{feature_id}/ directory names
- [ ] Matches array includes `repo_name`, `source_file`, `phase`, `snippet`, and `relevance` (one of: "feature-level", "architecture-level", "repo-conventions") per match
- [ ] `retrieved_at` is present on every response, including CONCERN_NOT_FOUND
- [ ] `CONCERN_NOT_FOUND` response includes `searched_repos` listing all repos that were scanned
- [ ] Feature-level matches (from wave-decisions.md/feature-delta.md) appear before architecture-level matches (ADRs) in the matches array
- [ ] resolve_concern does not affect the behaviour or response shape of list_features or query_context

### Outcome KPIs

- **Who**: AI coding agent about to design a feature, needing cross-concern orientation
- **Does what**: Retrieves authoritative context via resolve_concern without knowing repo_name or feature_id upfront
- **By how much**: 100% of walking-skeleton UAT scenarios above pass (4/4)
- **Measured by**: Manual test run of the 4 UAT scenarios against a real configured repo
- **Baseline**: 0% — no concern-based querying exists today

### Technical Notes

- Depends on: existing lore-mcp server (US-01 through US-05 must be delivered; this story adds a third tool).
- Keyword matching is a pure function in src/core/ — takes a directory snapshot and file contents (already read), returns match/no-match classification. No fs access in core.
- Relevance ranking (feature-level > architecture-level > repo-conventions) is a pure function of the source_file path pattern — same logic used by query_context structure classification (extend, don't duplicate).
- snippet content: same whole-file-with-size-cap approach as ADR-003. Truncation + warning if file exceeds threshold.
- This story intentionally covers only single-repo scan depth. Multi-repo is US-CBQ-02.

---

## US-CBQ-02: Cross-Repo Scan — All Configured Repos Searched, Failures Handled Gracefully

### Problem

Maria's platform spans multiple repos. With only a single-repo scan (US-CBQ-01), `resolve_concern("auth")` might miss the definitive auth decision living in a different repo than the one lore-mcp happens to scan first, or skip it entirely if that repo's path is temporarily broken. The agent needs results from ALL configured repos to have confidence that the most authoritative source was not missed.

### Who

- AI coding agent (Claude Code) | Operating in Repo A with a multi-repo lore-mcp config (3+ entries) | Motivation: know that a concern query searched every configured repo — and be told explicitly when one was skipped

### Solution

`resolve_concern` scans ALL configured repos in the config list, aggregates matches across all of them, and handles per-repo failures (broken doc_path) by adding a warning and continuing — never aborting the full scan because one repo is unreachable.

### Elevator Pitch

Before: `resolve_concern(concern="auth")` with the walking skeleton only scans the single repo it happens to encounter first. If the definitive auth decisions live in nwave-cli but lore-mcp only scanned ab-mcp, the agent would conclude "no decisions found" — a false negative.
After: run `resolve_concern(concern="auth")` → sees `{"concern": "auth", "matches": [{"repo_name": "nwave-cli", "source_file": ".../auth-flow/design/wave-decisions.md", ...}, {"repo_name": "billing-service", "source_file": ".../ADR-0007.md", ...}], "warnings": ["Repo 'stale-service' skipped: configured doc-path '/Users/maria/old-path/docs' does not exist on disk."], "retrieved_at": "live (no cache)"}`.
Decision enabled: The agent decides which repo's auth convention takes precedence (e.g., nwave-cli's feature-level decision over billing-service's ADR), knowing the scan was exhaustive and any skipped repos are named explicitly.

### Domain Examples

#### 1: Happy Path — Concern matched across two different repos
Maria configures lore-mcp with `[ab-mcp, nwave-cli, nwave-skills]`. Claude Code calls `resolve_concern(concern="data persistence")`. Both nwave-cli (feature-level wave-decisions.md) and nwave-skills (ADR) contain "data persistence". Response includes matches from both repos, each with its own `repo_name` and `source_file`, ranked feature-level first.

#### 2: Edge Case — One repo's doc_path is broken, other repos still return results
Maria's config has a 4th entry `billing-service` whose doc_path was moved. `resolve_concern(concern="data persistence")` returns matches from nwave-cli and nwave-skills PLUS a `warnings` entry: "Repo 'billing-service' skipped: configured doc-path '/old/path/docs' does not exist on disk." — the response is NOT an error.

#### 3: Error/Boundary — All repos are unreachable
All 3 configured repos have broken doc_paths. `resolve_concern(concern="auth")` returns `{"error": "CONCERN_NOT_FOUND", "concern": "auth", "searched_repos": [], "warnings": ["Repo 'ab-mcp' skipped: ...", "Repo 'nwave-cli' skipped: ...", "Repo 'nwave-skills' skipped: ..."], "retrieved_at": "live (no cache)"}`.

### UAT Scenarios (BDD)

#### Scenario: Matches aggregated from multiple repos
```gherkin
Given ab-mcp is configured with 3 repos: ab-mcp, nwave-cli, nwave-skills
And "nwave-cli" has docs/feature/persistence/design/wave-decisions.md containing "data persistence"
And "nwave-skills" has docs/product/architecture/ADR-0002.md containing "data persistence"
When the agent calls resolve_concern(concern="data persistence")
Then matches contains results from both "nwave-cli" and "nwave-skills"
And each match's repo_name correctly identifies its source repo
And the nwave-cli result with relevance "feature-level" appears before the nwave-skills ADR result
```

#### Scenario: Scan continues when one repo's doc_path is unreachable
```gherkin
Given ab-mcp is configured with 4 repos, one of which ("billing-service") has a non-existent doc_path
And the other 3 repos are reachable and contain "data persistence"
When the agent calls resolve_concern(concern="data persistence")
Then matches contains results from the 3 reachable repos
And warnings contains a notice mentioning "billing-service" was skipped
And the response is NOT an error
```

#### Scenario: CONCERN_NOT_FOUND when all repos are unreachable
```gherkin
Given all configured repos have non-existent doc_paths
When the agent calls resolve_concern(concern="auth")
Then the response is an error "CONCERN_NOT_FOUND"
And warnings contains one entry per skipped repo
And searched_repos is empty (no repos were successfully scanned)
And "retrieved_at" is present
```

#### Scenario: No cross-contamination — source_file always rooted in the correct repo's doc_path
```gherkin
Given 2 repos both contain files mentioning "logging"
When resolve_concern(concern="logging") returns
Then every match whose repo_name is "nwave-cli" has source_file rooted in nwave-cli's configured doc_path
And every match whose repo_name is "nwave-skills" has source_file rooted in nwave-skills' configured doc_path
```

### Acceptance Criteria

- [ ] `resolve_concern` scans ALL configured repos, not just the first matching one
- [ ] Results from different repos are aggregated into a single matches array, each with its own `repo_name` and `source_file`
- [ ] If a repo's doc_path is unreachable, that repo is skipped with a `warnings` entry; the scan continues for remaining repos
- [ ] `source_file` paths are always rooted in the respective repo's configured `doc_path` — no cross-contamination
- [ ] `searched_repos` in CONCERN_NOT_FOUND lists only repos that were successfully scanned (not skipped ones)
- [ ] The response is never an error solely because one repo's scan failed — only when ALL repos produce no matches

### Outcome KPIs

- **Who**: AI coding agent working in a multi-repo platform
- **Does what**: Retrieves concern context from all configured repos in a single tool call
- **By how much**: >=80% of representative concern questions answered via resolve_concern alone (0 manual file navigation), across all configured repos
- **Measured by**: Manual test session — N concern questions asked, M answered via resolve_concern only
- **Baseline**: 0% — only single-repo scan possible after US-CBQ-01

### Technical Notes

- Depends on: US-CBQ-01 (single-repo keyword match must work; this story extends it to N repos).
- Scan order: repos scanned in config order (deterministic). Results within each repo ranked by relevance; then repos aggregated in scan order. This is a DESIGN-wave detail — the AC only requires feature-level matches appear before architecture-level ones per repo.
- Per-repo failure handling follows the same probe-and-continue pattern from architecture brief Section 9 (DocTreeReader probe). No new probe logic needed — existing REPO_PATH_NOT_FOUND detection is re-used; failures downgraded from error to warning at the aggregate level.

---

## US-CBQ-03: Rejected Paths — Surfaces "Roads Not Taken" from nWave Artifacts

### Problem

Maria (or Claude Code on her behalf) has been bitten before by re-proposing a solution that was already tried and rejected — only to discover it mid-implementation when someone remembers "we decided against that in ADR-0012". The dismissed alternatives are buried in wave-decisions.md and ADR bodies, never surfaced proactively. An agent designing a new feature will repeat historical mistakes if it can only see the accepted decisions, not the rejected ones.

### Who

- AI coding agent (Claude Code) | About to propose an implementation approach for a concern it just queried | Motivation: know what approaches have already been ruled out, so it doesn't waste time re-proposing them or violating an implicit constraint

### Solution

`resolve_concern` additionally inspects matched files for rejection language ("Rejected:", "out of scope", "Not built", "Won't Have", "Alternative considered and dismissed") near the concern keyword, and populates a `rejected_paths` array alongside `matches` — each entry with `source_file`, `snippet` (the rejection context), and `type: "rejected_alternative"`.

### Elevator Pitch

Before: `resolve_concern(concern="auth")` returns only what was decided ("JWT strategy"). The agent proposes OAuth2 as a design choice, not knowing it was explicitly rejected in ADR-0007.
After: run `resolve_concern(concern="auth")` → sees `{"matches": [...], "rejected_paths": [{"repo_name": "nwave-cli", "source_file": ".../ADR-0007-auth-strategy.md", "snippet": "## Rejected: OAuth2\\nRationale: too complex for single-developer OSS...", "type": "rejected_alternative"}], "retrieved_at": "live (no cache)"}`.
Decision enabled: The agent decides NOT to propose OAuth2 because it sees it was explicitly rejected, with rationale — saving Maria a code-review cycle.

### Domain Examples

#### 1: Happy Path — Rejection clause found near concern keyword in ADR
`resolve_concern(concern="auth")` scans nwave-cli. ADR-0007 contains "## Rejected Alternatives" with "OAuth2: too complex for solo OSS maintainer". This section is near "auth" in the file. `rejected_paths` includes the ADR with snippet showing the OAuth2 rejection paragraph.

#### 2: Edge Case — wave-decisions.md contains "Won't Have" section touching concern
`resolve_concern(concern="caching")` scans ab-mcp's own wave-decisions.md. The DISCUSS artifact contains "Out of scope: caching/invalidation layer". This matches the out-of-scope pattern. `rejected_paths` includes ab-mcp's wave-decisions.md with snippet showing the "Out of scope" clause.

#### 3: Error/Boundary — No rejection language found, rejected_paths is empty (not absent)
`resolve_concern(concern="logging")` finds wave-decisions.md with logging decisions but no rejection sections. Response: `"rejected_paths": []` — the field is present and empty, never absent. The agent can reliably check `.length` without defensive null checks.

### UAT Scenarios (BDD)

#### Scenario: Rejected alternative surfaced from an ADR
```gherkin
Given "nwave-cli" has docs/product/architecture/ADR-0007-auth-strategy.md
  containing "## Rejected Alternatives" near the word "auth"
  with the text "OAuth2: rejected — too complex for solo OSS"
When the agent calls resolve_concern(concern="auth")
Then rejected_paths contains one entry with source_file ending in "ADR-0007-auth-strategy.md"
And the entry's snippet contains "OAuth2"
And the entry's type is "rejected_alternative"
```

#### Scenario: Out-of-scope decision surfaced from wave-decisions.md
```gherkin
Given "ab-mcp" has docs/feature/ab-mcp/discuss/wave-decisions.md
  containing the text "Out of scope: caching/invalidation layer"
When the agent calls resolve_concern(concern="caching")
Then rejected_paths contains at least one entry with source_file in ab-mcp's docs
And the entry's snippet contains "caching"
And the entry's type is "rejected_alternative"
```

#### Scenario: rejected_paths is present and empty when no rejection language found
```gherkin
Given no matched file contains rejection language near "logging"
When the agent calls resolve_concern(concern="logging")
Then the response contains "rejected_paths": []
And the field is present (not null, not absent from the response)
```

#### Scenario: rejected_paths does not duplicate matches entries
```gherkin
Given an ADR contains both an accepted decision and a "Rejected:" section, both mentioning "auth"
When the agent calls resolve_concern(concern="auth")
Then the ADR appears in matches with the full snippet
And the ADR also appears in rejected_paths with the rejection-specific snippet
And these are separate entries — matches contains the full-file result, rejected_paths contains the rejection clause
```

### Acceptance Criteria

- [ ] `rejected_paths` field is present on every successful resolve_concern response, as an array (empty or populated)
- [ ] Rejection detection recognises at least these patterns (case-insensitive) near the matched concern keyword: "Rejected:", "out of scope", "Won't Have", "Not built", "Alternative considered and dismissed", "deferred"
- [ ] Each rejected_paths entry contains: `repo_name`, `source_file`, `snippet` (the rejection clause paragraph, capped), `type: "rejected_alternative"`
- [ ] A file can appear in BOTH matches and rejected_paths (different snippet contexts from the same file)
- [ ] Rejection detection is a pure function in src/core/ with no fs access

### Outcome KPIs

- **Who**: AI coding agent about to propose an implementation approach
- **Does what**: Checks rejected_paths before proposing a design, avoiding re-proposing dismissed alternatives
- **By how much**: 100% of documented rejection clauses in nWave artifacts surfaced in rejected_paths when concern matches (verified in test suite with 3 rejection-pattern fixture files)
- **Measured by**: Automated test suite — 1 test per rejection pattern keyword × fixture file
- **Baseline**: 0% — no rejection surfacing exists today; agents have no visibility into roads not taken

### Technical Notes

- Depends on: US-CBQ-02 (cross-repo scan must be working; rejection detection runs on the same scanned content).
- Rejection detection is a heuristic (text pattern matching) — not a guarantee that all rejections are captured. Wording is not standardised across all nWave artifacts. This is intentional and acceptable at MVP (same philosophy as the concern match itself: keyword-based, not semantic).
- Rejection snippet extraction: find the paragraph(s) surrounding the rejection keyword within the concern-matching file. Paragraph = text between blank lines. Cap the snippet at the same size limit as matches snippets.
- DESIGN-wave decision: exact rejection keyword list and proximity rules (e.g., "must be within N paragraphs of concern keyword") are DESIGN details. The AC requires the above 6 patterns; DESIGN may extend the list.

---

## US-CBQ-04: Partial-Structure Warnings + Input Validation — Agent Knows the Confidence Level of Its Grounding

### Problem

Maria's platform has repos at varying stages of nWave adoption. When `resolve_concern` finds only ADRs or only a CLAUDE.md for a given concern (no feature-level wave-decisions), an agent reading those results might not notice the caveat — it sees content and proceeds as if the grounding is complete. Additionally, an agent that passes an empty string to `resolve_concern` (e.g., from a variable substitution bug) should get an immediate, clear error rather than an empty no-match response that's indistinguishable from "concern genuinely not found".

### Who

- AI coding agent (Claude Code) | Receiving a resolve_concern response that includes only architecture-level or CLAUDE.md results | Motivation: correctly communicate to Maria "I found context, but it's only at the ADR level — there may be more specific decisions not yet documented"

### Solution

(1) When `resolve_concern` returns matches but none are at the "feature-level" relevance, add a `warnings` entry describing the gap — same pattern as query_context's partial-structure warnings (US-04). (2) An empty or whitespace-only concern string returns `INVALID_CONCERN` immediately, not CONCERN_NOT_FOUND.

### Elevator Pitch

Before: `resolve_concern(concern="rate-limiting")` returns an ADR match with no warning. The agent tells Maria "rate-limiting is handled per ADR-0003" — but nwave-cli has a more recent feature-level decision that the agent missed because lore-mcp didn't flag the ADR-only gap.
After: run `resolve_concern(concern="rate-limiting")` → sees `{"matches": [{"repo_name": "billing-service", "source_file": ".../ADR-0003.md", "relevance": "architecture-level", ...}], "warnings": ["No feature-level wave-decisions.md found for concern 'rate-limiting' in any configured repo -- returning architecture-level context only. Feature-level decisions may not be captured."], "retrieved_at": "live (no cache)"}`.
Decision enabled: The agent tells Maria "I found ADR-0003, but no feature-level wave-decisions.md. There may be more specific decisions not yet captured in nWave docs."

### Domain Examples

#### 1: Happy Path — Partial warning when only ADRs match
`resolve_concern(concern="rate-limiting")` finds only ADR-0003 across all repos (no wave-decisions.md or feature-delta.md mentions "rate-limiting"). Response includes ADR in matches + `warnings: ["No feature-level wave-decisions.md found for concern 'rate-limiting'..."]`.

#### 2: Edge Case — No warning when at least one feature-level match exists
`resolve_concern(concern="auth")` returns one feature-level match (wave-decisions.md) AND one ADR. No partial-structure warning is added — the agent has feature-level grounding. `warnings: []`.

#### 3: Error/Boundary — INVALID_CONCERN for empty string
`resolve_concern(concern="")` (empty string, from an agent variable substitution bug). Response: `{"error": "INVALID_CONCERN", "concern": "", "message": "concern must be a non-empty string. Provide a plain-language topic (e.g., 'auth', 'data persistence', 'rate-limiting').", "retrieved_at": "live (no cache)"}`.

### UAT Scenarios (BDD)

#### Scenario: Partial-structure warning when no feature-level matches exist
```gherkin
Given no configured repo has a wave-decisions.md or feature-delta.md containing "rate-limiting"
And "billing-service" has docs/product/architecture/ADR-0003.md containing "rate-limiting"
When the agent calls resolve_concern(concern="rate-limiting")
Then matches contains the ADR result with relevance "architecture-level"
And warnings contains "No feature-level wave-decisions.md found for concern 'rate-limiting'"
And the response is NOT an error
```

#### Scenario: No partial-structure warning when at least one feature-level match exists
```gherkin
Given "nwave-cli" has docs/feature/auth-flow/design/wave-decisions.md containing "auth"
  (relevance: feature-level)
And "nwave-cli" also has an ADR mentioning "auth"
When the agent calls resolve_concern(concern="auth")
Then matches contains both the wave-decisions.md and ADR results
And warnings does not contain any partial-structure warning
```

#### Scenario: INVALID_CONCERN for empty concern string
```gherkin
Given lore-mcp is running with any valid config
When the agent calls resolve_concern(concern="")
Then the response is an error "INVALID_CONCERN"
And the message explains that concern must be a non-empty string
And "retrieved_at" is present
```

#### Scenario: INVALID_CONCERN for whitespace-only concern string
```gherkin
Given lore-mcp is running with any valid config
When the agent calls resolve_concern(concern="   ")
Then the response is an error "INVALID_CONCERN"
And the message explains that concern must be a non-empty string after trimming
```

### Acceptance Criteria

- [ ] When all matches have `relevance: "architecture-level"` or `"repo-conventions"` (zero "feature-level" matches), `warnings` includes a partial-structure notice for the concern
- [ ] When at least one match has `relevance: "feature-level"`, no partial-structure warning is added for that concern
- [ ] `resolve_concern(concern="")` returns `INVALID_CONCERN` error with a helpful message — does not scan repos or return CONCERN_NOT_FOUND
- [ ] `resolve_concern(concern="   ")` (whitespace only) also returns `INVALID_CONCERN` (trimmed to empty)
- [ ] `retrieved_at` is present on INVALID_CONCERN responses
- [ ] Partial-structure warning wording is consistent with query_context warnings (same format, different concern-specific text)

### Outcome KPIs

- **Who**: AI coding agent receiving a resolve_concern response with only architecture-level content
- **Does what**: Communicates the partial-grounding caveat to Maria rather than presenting ADR-only context as complete
- **By how much**: 100% of partial-structure concern queries include a warning describing the gap; 100% of empty-string inputs return INVALID_CONCERN
- **Measured by**: Automated test suite — 1 full-structure fixture (no warning expected) + 1 ADR-only fixture (warning expected) + 1 empty-string input test
- **Baseline**: 0% — no partial-structure warning exists for concern queries today

### Technical Notes

- Depends on: US-CBQ-02 (cross-repo scan must aggregate results before partial-structure check can evaluate all matches).
- Partial-structure classification is a pure function in src/core/ — takes the aggregated matches array, checks if any entry has relevance "feature-level", returns whether to add the warning. Zero fs access.
- INVALID_CONCERN is a new error code not in the existing error taxonomy (REPO_NOT_CONFIGURED, REPO_PATH_NOT_FOUND, FEATURE_NOT_FOUND, NO_NWAVE_STRUCTURE). DESIGN wave to confirm it follows SCREAMING_SNAKE_CASE convention and add it to the structured error documentation.
- Warning wording for partial-structure: "No feature-level wave-decisions.md found for concern '${concern}' in any configured repo — returning architecture-level context only. Feature-level decisions may not be captured." — exact wording is a DESIGN-wave detail; AC requires the warning be present and concern-specific.
