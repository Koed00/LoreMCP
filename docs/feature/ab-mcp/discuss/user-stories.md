<!-- markdownlint-disable MD024 -->
# User Stories: ab-mcp -- Cross-Repo Context Retrieval

## System Constraints

- **Read-only**: ab-mcp MUST NOT write/modify any file in any configured repo. All operations are filesystem reads.
- **Local only**: ab-mcp runs as a local MCP server; no network calls, no hosted service, no external dependencies for retrieval.
- **No caching**: every `query_context`/`list_features` call reads the filesystem live at call time (D-retrieval-risk/H2 -- zero staleness by construction).
- **nWave-structured repos only (MVP)**: ab-mcp's retrieval relies on `docs/feature/{feature_id}/{phase}/wave-decisions.md` (or `feature-delta.md`), `docs/product/architecture/`, and `CLAUDE.md` path conventions (D-docquality REVISED). Repos without any of these return `NO_NWAVE_STRUCTURE`.
- **Config shape fixed**: list of `{repo-name, doc-path}` entries; adding repos = appending list entries, never schema changes (D-config/H4).
- **Out of scope (do not build)**: ownership/boundary mapping (O6/D-scope), CLAUDE.md auto-injection (D-bootstrap), any caching/invalidation layer, semantic/vector search (MVP retrieval is path-convention-based).
- **Structured errors only**: all failure conditions return JSON error objects with `error`, `message`, and recovery-relevant fields (e.g., `available_repos`, `available_features`) -- never raw exceptions or empty silent responses.

---

## US-01: Walking Skeleton -- Agent Retrieves ab-mcp's Own Wave Decisions

### Problem

A developer using Claude Code in the AB-MCP repo itself (dogfooding) wants to confirm the basic retrieval mechanism works before building anything more complex. Today, there is no MCP server at all -- the agent has zero programmatic access to `docs/feature/ab-mcp/discover/wave-decisions.md`, even though that file exists right there on disk.

### Who

- AI coding agent (Claude Code) | Operating inside the AB-MCP repo itself | Motivation: prove the config -> filesystem-read -> MCP-tool-response path works end-to-end against real data before adding multi-repo complexity

### Solution

A minimal MCP server with a 1-entry config (`{repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}`) exposing `list_features(repo_name)` and `query_context(repo_name, feature_id)`, reading real files from `docs/feature/ab-mcp/`.

### Elevator Pitch

- **Before**: An agent in the AB-MCP repo has no way to programmatically access `docs/feature/ab-mcp/discover/wave-decisions.md` -- it would need to be manually told to `Read` the file by full path, with no discovery mechanism.
- **After**: The agent calls the MCP tool `query_context(repo_name="ab-mcp", feature_id="ab-mcp")` and receives a JSON response: `{"repo_name": "ab-mcp", "feature_id": "ab-mcp", "results": [{"source_file": "<AB-MCP repo>/docs/feature/ab-mcp/discover/wave-decisions.md", "phase": "discover", "snippet": "## Critical Reframe (Read First)\n\n**Original problem framing was incorrect...**"}], "retrieved_at": "live (no cache)"}`.
- **Decision enabled**: The agent decides whether to proceed with the "corrected cross-repo framing" (per the Critical Reframe) vs. risk using stale/incorrect assumptions -- grounded in the actual current content of wave-decisions.md, not its training data or memory.

### Domain Examples

#### 1: Happy Path -- Maria queries ab-mcp about its own discovery decisions
Maria Santos (the OSS maintainer) is working in the AB-MCP repo and asks Claude Code: "What did DISCOVER decide about the config shape?" Claude Code calls `list_features("ab-mcp")`, sees `["ab-mcp"]`, then calls `query_context("ab-mcp", "ab-mcp")`, and receives the D-config decision text from `docs/feature/ab-mcp/discover/wave-decisions.md`, with `source_file` pointing at that exact file.

#### 2: Edge Case -- list_features called before query_context
Claude Code first calls `list_features("ab-mcp")` to discover what feature_ids exist, without yet knowing "ab-mcp" is the only one. The response `{"repo_name": "ab-mcp", "doc_path": "<path>/docs", "features": [{"feature_id": "ab-mcp", "phases": ["discover"]}], "has_architecture_adrs": false, "has_claude_md": false}` tells the agent only "discover" phase artifacts exist (matches current repo state -- no DESIGN/DELIVER yet).

#### 3: Error/Boundary -- query_context called with a feature_id that doesn't exist yet
Claude Code calls `query_context("ab-mcp", "nonexistent-feature")`. Since `docs/feature/nonexistent-feature/` doesn't exist, the response is `{"error": "FEATURE_NOT_FOUND", "repo_name": "ab-mcp", "feature_id": "nonexistent-feature", "message": "No docs/feature/nonexistent-feature/ directory found in 'ab-mcp'. Use list_features('ab-mcp') to see available feature_ids.", "available_features": ["ab-mcp"]}`.

### UAT Scenarios (BDD)

#### Scenario: Agent discovers ab-mcp's own feature documentation
```gherkin
Given ab-mcp is configured with one entry: {repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}
And "<AB-MCP repo>/docs/feature/ab-mcp/" exists with a "discover" phase directory
When the agent calls list_features("ab-mcp")
Then the response includes feature_id "ab-mcp"
And the response includes "doc_path" matching the configured path
And the response includes phases including "discover"
```

#### Scenario: Agent retrieves the Critical Reframe decision text
```gherkin
Given ab-mcp is configured with {repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}
And "<AB-MCP repo>/docs/feature/ab-mcp/discover/wave-decisions.md" contains the
  section "## Critical Reframe (Read First)"
When the agent calls query_context("ab-mcp", "ab-mcp")
Then the response includes a result with source_file ending in
  "docs/feature/ab-mcp/discover/wave-decisions.md"
And the result's snippet contains "Critical Reframe"
And "retrieved_at" indicates a live (uncached) read
```

#### Scenario: Agent receives a clear error for a feature_id that doesn't exist
```gherkin
Given ab-mcp is configured with {repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}
And "<AB-MCP repo>/docs/feature/nonexistent-feature/" does not exist
When the agent calls query_context("ab-mcp", "nonexistent-feature")
Then the response is an error "FEATURE_NOT_FOUND"
And the response includes available_features containing "ab-mcp"
```

#### Scenario: Server boots successfully with a 1-entry config
```gherkin
Given a config file lists exactly one entry: {repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}
When ab-mcp starts
Then the server starts without error
And both list_features and query_context tools are available to the calling agent
```

### Acceptance Criteria

- [ ] `list_features("ab-mcp")` returns feature_id "ab-mcp" with correct doc_path and phases
- [ ] `query_context("ab-mcp", "ab-mcp")` returns a result whose `source_file` ends in `docs/feature/ab-mcp/discover/wave-decisions.md` and whose snippet contains real content from that file
- [ ] Response includes `retrieved_at` indicating a live (uncached) read
- [ ] `query_context("ab-mcp", "nonexistent-feature")` returns structured `FEATURE_NOT_FOUND` error with `available_features`
- [ ] ab-mcp boots successfully with a 1-entry config and exposes both tools

### Outcome KPIs

- **Who**: AI coding agent in the AB-MCP repo
- **Does what**: Retrieves real wave-decisions.md content via `query_context` instead of requiring manual `Read` with a hardcoded path
- **By how much**: 100% of the walking-skeleton scenarios above pass (4/4)
- **Measured by**: Manual test run of the 4 UAT scenarios against the real AB-MCP repo
- **Baseline**: 0% -- no MCP server exists today

### Technical Notes (Optional)

- Config format and storage location (file format, default path) are DESIGN-wave decisions -- not prescribed here.
- "Phase" enumeration (`discover`, `discuss`, `design`, `deliver`) should be derived from directory names under `docs/feature/{feature_id}/`, not hardcoded to a fixed list (this repo currently only has `discover`).
- This story intentionally has NO multi-repo, NO error path beyond FEATURE_NOT_FOUND, and NO partial-structure handling -- those are later stories.

---

## US-02: Multi-Repo Retrieval -- Config Scales to 3 Repos

### Problem

Maria Santos (OSS maintainer) works across multiple repos in her platform. With only a 1-entry config (US-01), ab-mcp can only answer questions about itself -- the actual cross-repo pain (DISCOVER's validated job story: "I'm in repo A and need context from repo B's docs") is not yet addressed. She needs to configure ab-mcp with her real sibling repos and get correct, repo-specific results.

### Who

- AI coding agent (Claude Code) | Operating in Repo A (e.g., a new microservice) | Motivation: retrieve context from a SPECIFIC sibling repo (B, C, or D) among several configured, without cross-contamination between repos' results

### Solution

Extend ab-mcp's config to hold a list of 3 `{repo-name, doc-path}` entries. Both `list_features` and `query_context` resolve the correct `doc_path` per `repo_name` from this list, with no schema changes from the 1-entry case.

### Elevator Pitch

- **Before**: ab-mcp only knows about one repo (itself). An agent in Repo A working on a new feature has no way to ask "what does Repo B's wave-decisions.md say about X?" -- it would need the human to manually `cd` into Repo B and search.
- **After**: With ab-mcp configured with 3 entries (e.g., `ab-mcp`, `repo-b`, `repo-c`), the agent calls `query_context(repo_name="repo-b", feature_id="some-feature")` and receives `{"repo_name": "repo-b", "feature_id": "some-feature", "results": [{"source_file": "<repo-b path>/docs/feature/some-feature/design/wave-decisions.md", "phase": "design", "snippet": "<actual decision text from repo-b>"}], "retrieved_at": "live (no cache)"}` -- content unambiguously from repo-b, not ab-mcp or repo-c.
- **Decision enabled**: The agent decides how to implement a feature in Repo A consistently with a convention established in Repo B, citing repo-b's actual decision text as justification.

### Domain Examples

#### 1: Happy Path -- Agent retrieves a feature's design decision from a sibling repo
Maria configures ab-mcp with `[{repo-name: "ab-mcp", doc-path: ".../AB-MCP/docs"}, {repo-name: "nwave-cli", doc-path: ".../nwave-cli/docs"}, {repo-name: "nwave-skills", doc-path: ".../nwave-skills/docs"}]`. The agent calls `query_context("nwave-cli", "some-real-feature-id")` and receives content from `nwave-cli`'s `docs/feature/some-real-feature-id/.../wave-decisions.md`.

#### 2: Edge Case -- Same feature_id exists in two configured repos with different content
Both `nwave-cli` and `nwave-skills` happen to have a `docs/feature/logging/` directory (coincidental naming). `query_context("nwave-cli", "logging")` returns ONLY nwave-cli's logging decisions; `query_context("nwave-skills", "logging")` returns ONLY nwave-skills' -- no cross-contamination, verified by distinct `source_file` paths rooted in each repo's own `doc_path`.

#### 3: Error/Boundary -- Agent queries a repo_name not in config
The agent calls `list_features("nwave-design")` (a repo not yet added to config). Response: `{"error": "REPO_NOT_CONFIGURED", "repo_name": "nwave-design", "message": "Repo 'nwave-design' is not in ab-mcp's configured repo list. Add it as a {repo-name, doc-path} entry to query it.", "available_repos": ["ab-mcp", "nwave-cli", "nwave-skills"]}`.

### UAT Scenarios (BDD)

#### Scenario: Agent retrieves context from the second of three configured repos
```gherkin
Given ab-mcp is configured with 3 entries:
  | repo-name    | doc-path                  |
  | ab-mcp       | <AB-MCP repo>/docs        |
  | nwave-cli    | <nwave-cli repo>/docs     |
  | nwave-skills | <nwave-skills repo>/docs  |
And "nwave-cli" has docs/feature/{some-feature-id}/design/wave-decisions.md
  containing a real decision
When the agent calls query_context("nwave-cli", "{some-feature-id}")
Then the response includes a result with source_file rooted in
  "<nwave-cli repo>/docs"
And the snippet matches the real content from nwave-cli's wave-decisions.md
```

#### Scenario: Results from different repos do not cross-contaminate
```gherkin
Given the same 3-entry config as above
And both "nwave-cli" and "nwave-skills" have a docs/feature/logging/ directory
  with different wave-decisions.md content
When the agent calls query_context("nwave-cli", "logging")
And separately calls query_context("nwave-skills", "logging")
Then the first response's source_file is rooted in "<nwave-cli repo>/docs"
And the second response's source_file is rooted in "<nwave-skills repo>/docs"
And the snippet content differs between the two responses
```

#### Scenario: Agent queries a repo not present in config
```gherkin
Given the same 3-entry config as above (ab-mcp, nwave-cli, nwave-skills)
When the agent calls list_features("nwave-design")
Then the response is an error "REPO_NOT_CONFIGURED"
And the response includes available_repos containing
  "ab-mcp", "nwave-cli", and "nwave-skills"
```

#### Scenario: list_features returns distinct feature_ids per repo
```gherkin
Given the same 3-entry config as above
When the agent calls list_features("ab-mcp")
And separately calls list_features("nwave-cli")
Then the two responses' "features" lists reflect each repo's own
  docs/feature/*/ directory contents
And the two responses' "doc_path" values differ, each matching
  that repo's configured doc-path
```

### Acceptance Criteria

- [ ] Config holds 3 `{repo-name, doc-path}` entries with no schema changes from the 1-entry case (US-01)
- [ ] `query_context(repo_name, feature_id)` resolves `doc_path` correctly per `repo_name`
- [ ] Results from different repos never share a `source_file` root -- each is rooted in its own configured `doc_path`
- [ ] `list_features`/`query_context` for an unconfigured `repo_name` returns structured `REPO_NOT_CONFIGURED` error with `available_repos` listing all 3 configured names
- [ ] `list_features` returns repo-specific feature lists that differ correctly across the 3 repos

### Outcome KPIs

- **Who**: AI coding agent working across Maria's 3-repo platform
- **Does what**: Retrieves correct, repo-specific context for any of the 3 configured repos via a single consistent tool interface
- **By how much**: >=80% of representative cross-repo questions (KPI-1, outcome-kpis.md) answered correctly via tool-call-only across all 3 repos
- **Measured by**: Manual test session log (N questions, M correct via tool calls)
- **Baseline**: 0% -- only 1 repo (self) queryable after US-01

### Technical Notes (Optional)

- Depends on US-01 (single-repo retrieval mechanism must exist first; this story generalizes it).
- This story is the first concrete test of H4 (config scales 3->10+) -- adding repos 4-10 (without code changes) is verified separately as part of KPI-3 measurement, not a blocking AC for THIS story, but the config schema chosen here MUST support it.
- Real sibling repos preferred over fabricated mocks per DISCOVER's dogfooding framing -- if the stakeholder has 2+ other local nWave repos, use those.

---

## US-03: Error Paths -- Missing Repo Path and Missing Feature, Across Multiple Repos

### Problem

Maria's ab-mcp config can drift from reality -- a configured repo's path might move, get deleted, or be mistyped, and an agent might ask about a `feature_id` that simply doesn't exist in a given repo. Without clear, structured errors, the agent either crashes, gets an unhelpful empty response, or (worst case) hallucinates an answer instead of telling Maria something is wrong.

### Who

- AI coding agent (Claude Code) | Operating in Repo A with a multi-repo config (per US-02) where one entry has gone stale | Motivation: distinguish "this repo/feature genuinely doesn't have this info" from "ab-mcp is broken/misconfigured" -- and report the difference accurately to Maria

### Solution

Two structured error responses -- `REPO_PATH_NOT_FOUND` (configured `doc-path` doesn't exist on disk) and `FEATURE_NOT_FOUND` (feature_id not present under a valid repo's `docs/feature/`) -- each including enough context (`configured_path`, `available_repos`, `available_features`) for the agent to recover or report precisely.

### Elevator Pitch

- **Before**: Maria's config has a 4th entry `{repo-name: "billing-service", doc-path: "/Users/maria/code/billing-service/docs"}` but she renamed the local clone folder last week. An agent calling `query_context("billing-service", "invoicing")` would get a filesystem error, a stack trace, or silently empty results -- no actionable information.
- **After**: The agent calls `query_context("billing-service", "invoicing")` and receives `{"error": "REPO_PATH_NOT_FOUND", "repo_name": "billing-service", "configured_path": "/Users/maria/code/billing-service/docs", "message": "Configured doc-path for 'billing-service' does not exist on disk. Check ab-mcp config entry (repo-name: 'billing-service') and verify the path is correct and accessible.", "available_repos": ["ab-mcp", "nwave-cli", "nwave-skills"]}`.
- **Decision enabled**: The agent decides to tell Maria "your `billing-service` config entry's path is broken -- here's the path I tried" rather than silently proceeding without that context or fabricating an answer about billing-service's invoicing conventions.

### Domain Examples

#### 1: Happy Path -- Agent gets REPO_PATH_NOT_FOUND for a moved repo
Maria's config has `{repo-name: "billing-service", doc-path: "/Users/maria/code/billing-service/docs"}` but she moved the clone to `/Users/maria/dev/billing-service`. The agent's `query_context("billing-service", "invoicing")` returns `REPO_PATH_NOT_FOUND` with `configured_path: "/Users/maria/code/billing-service/docs"`, letting the agent tell Maria exactly which path to fix.

#### 2: Edge Case -- FEATURE_NOT_FOUND with helpful suggestions
The agent calls `query_context("nwave-cli", "loggin")` (typo for "logging"). Response includes `FEATURE_NOT_FOUND` with `available_features` containing `"logging"` -- close enough for the agent to suggest "did you mean 'logging'?" to Maria (suggestion logic itself is a DESIGN-wave nicety; AC only requires `available_features` be present and accurate).

#### 3: Error/Boundary -- Both errors return structured JSON, never raw exceptions
Regardless of whether the underlying filesystem error is "permission denied", "path not found", or "not a directory", the agent-facing response is always one of the two defined JSON error shapes -- never a Python traceback or Node stack trace leaking into the MCP tool response.

### UAT Scenarios (BDD)

#### Scenario: Agent receives REPO_PATH_NOT_FOUND for a configured-but-missing repo path
```gherkin
Given ab-mcp is configured with 4 entries including:
  {repo-name: "billing-service", doc-path: "/Users/maria/code/billing-service/docs"}
And that path does not exist on disk
When the agent calls query_context("billing-service", "invoicing")
Then the response is an error "REPO_PATH_NOT_FOUND"
And the response includes configured_path "/Users/maria/code/billing-service/docs"
And the response includes available_repos listing the other 3 configured repos
```

#### Scenario: Agent receives FEATURE_NOT_FOUND for a valid repo with an unknown feature_id
```gherkin
Given ab-mcp is configured with {repo-name: "nwave-cli", doc-path: "<nwave-cli repo>/docs"}
And "<nwave-cli repo>/docs/feature/loggin/" does not exist
And "<nwave-cli repo>/docs/feature/logging/" DOES exist
When the agent calls query_context("nwave-cli", "loggin")
Then the response is an error "FEATURE_NOT_FOUND"
And the response includes available_features containing "logging"
```

#### Scenario: list_features also returns REPO_PATH_NOT_FOUND for a broken config entry
```gherkin
Given the same 4-entry config as the first scenario
When the agent calls list_features("billing-service")
Then the response is an error "REPO_PATH_NOT_FOUND"
And the response includes configured_path "/Users/maria/code/billing-service/docs"
```

#### Scenario: Underlying filesystem errors never leak as raw exceptions
```gherkin
Given ab-mcp is configured with a repo whose doc-path exists but is not readable
  (e.g., permission-restricted directory)
When the agent calls query_context for that repo and any feature_id
Then the response is a structured JSON error (REPO_PATH_NOT_FOUND or an
  equivalent defined error shape)
And the response does not contain a raw stack trace or unhandled exception text
```

### Acceptance Criteria

- [ ] `query_context`/`list_features` for a repo with a non-existent configured `doc-path` returns `REPO_PATH_NOT_FOUND` with `configured_path` and `available_repos`
- [ ] `query_context` for a valid repo with an unknown `feature_id` returns `FEATURE_NOT_FOUND` with `available_features` (real, accurate list from that repo's `docs/feature/`)
- [ ] All error responses are valid JSON matching one of the defined error shapes -- never raw exceptions/stack traces
- [ ] `available_repos` and `available_features` lists are always accurate (reflect actual config / actual filesystem state at call time, not stale/cached)

### Outcome KPIs

- **Who**: AI coding agent encountering a misconfigured or stale ab-mcp config entry
- **Does what**: Reports the specific configuration problem to the developer instead of silently failing or fabricating cross-repo context
- **By how much**: 100% of the 4 error/edge UAT scenarios above pass; 0% of error conditions produce raw exceptions in agent-facing responses
- **Measured by**: Test suite -- one test per error condition (KPI-4, outcome-kpis.md)
- **Baseline**: 0% -- no error handling exists prior to this story (US-01/US-02 only cover happy paths + one FEATURE_NOT_FOUND case)

### Technical Notes (Optional)

- Depends on US-02 (multi-repo config) to have a realistic 3+ entry config to test "available_repos" against.
- "Did-you-mean" style suggestions (Edge Case 2) are NOT required AC for this story -- only that `available_features` is present and accurate. Suggestion UX is a DESIGN-wave enhancement.
- Permission-denied filesystem errors (Scenario 4) should map to `REPO_PATH_NOT_FOUND` or an equivalent -- exact error taxonomy is a DESIGN decision, but the "never raw exception" constraint is a hard requirement here.

---

## US-04: Partial nWave Structure -- ADRs-Only and CLAUDE.md-Only Repos

### Problem

Not all of Maria's repos have fully adopted nWave conventions yet -- some have `docs/product/architecture/` ADRs but no per-feature `wave-decisions.md`, and at least one has only a `CLAUDE.md`. If ab-mcp either returns nothing for these repos (agent assumes "no relevant context exists" -- false) or returns ADR/CLAUDE.md content without flagging it as partial (agent assumes "this is the full feature-level decision" -- also false), the agent could proceed with incomplete grounding and present it as complete. This is the open feasibility question flagged in DISCOVER (D-retrieval-risk).

### Who

- AI coding agent (Claude Code) | Operating in Repo A, querying a sibling repo (e.g., `cerbos`) that has ADRs but hasn't adopted per-feature `wave-decisions.md` yet, or a repo (e.g., a small frontend) with only a `CLAUDE.md` | Motivation: get the best available context AND know how complete/trustworthy it is, so it can decide whether to proceed confidently or flag a gap to Maria

### Solution

`query_context` returns whatever relevant nWave artifacts exist (ADRs, CLAUDE.md sections) even when the "ideal" `docs/feature/{feature_id}/{phase}/wave-decisions.md` is absent, and includes a `warnings` array describing exactly what's missing. `list_features` reports `has_architecture_adrs`/`has_claude_md` flags per repo. A repo with NONE of the three artifact types returns `NO_NWAVE_STRUCTURE`.

### Elevator Pitch

- **Before**: An agent queries `query_context("cerbos", "permission-policies")`. Cerbos has `docs/product/architecture/ADR-0012-policy-format.md` but no `docs/feature/permission-policies/`. Without this story, the agent either gets nothing (and assumes Cerbos has no relevant docs at all -- false) or gets the ADR content presented identically to a full feature-level decision (overconfident).
- **After**: The agent receives `{"repo_name": "cerbos", "feature_id": "permission-policies", "results": [{"source_file": "<cerbos path>/docs/product/architecture/ADR-0012-policy-format.md", "phase": "architecture", "snippet": "# ADR-0012: Policy Format\nStatus: Accepted\n..."}], "warnings": ["No docs/feature/permission-policies/wave-decisions.md found in 'cerbos' -- returning architecture-level (ADR) context only. Feature-level decisions may not be captured."], "retrieved_at": "live (no cache)"}`.
- **Decision enabled**: The agent decides to use the ADR-level policy format convention for its work in Repo A, AND tells Maria "I'm grounding this on Cerbos's ADR-0012 (architecture-level), but Cerbos has no feature-level wave-decisions for 'permission-policies' -- there may be more recent context I'm missing."

### Domain Examples

#### 1: Happy Path -- ADRs-only repo returns ADR content + warning
`cerbos` repo has `docs/product/architecture/ADR-0012-policy-format.md` but no `docs/feature/permission-policies/`. `query_context("cerbos", "permission-policies")` returns the ADR snippet plus a `warnings` entry naming the missing `wave-decisions.md`.

#### 2: Edge Case -- CLAUDE.md-only repo returns CLAUDE.md content + different warning
A small repo `frontend-mobile` has only `CLAUDE.md` (no `docs/feature/`, no `docs/product/architecture/`). `query_context("frontend-mobile", "auth-pagination")` returns a result sourced from `CLAUDE.md` (e.g., a section on "API conventions") plus a `warnings` entry: "only CLAUDE.md-level context found, no feature-specific or ADR-level documentation."

#### 3: Error/Boundary -- Repo with zero nWave artifacts returns NO_NWAVE_STRUCTURE
A 4th configured repo, `legacy-payments`, has a `docs/` folder but it contains only a `README.md` and a `manuals/` folder of unstructured PDFs exported to markdown -- none of `docs/feature/**/wave-decisions.md`, `docs/product/architecture/`, or `CLAUDE.md` exist. `list_features("legacy-payments")` and `query_context("legacy-payments", anything)` both return `NO_NWAVE_STRUCTURE` with a message suggesting nWave adoption or removal from config.

### UAT Scenarios (BDD)

#### Scenario: Repo with ADRs but no feature-level wave-decisions returns partial results with warning
```gherkin
Given ab-mcp is configured with {repo-name: "cerbos", doc-path: "<cerbos repo>/docs"}
And "cerbos" has docs/product/architecture/ADR-0012-policy-format.md
And "cerbos" has no docs/feature/permission-policies/ directory
When the agent calls query_context("cerbos", "permission-policies")
Then the response includes a result with source_file ending in
  "product/architecture/ADR-0012-policy-format.md"
And the response includes a warnings entry mentioning
  "no feature-level wave-decisions.md"
And the response is NOT an error (results are still returned)
```

#### Scenario: Repo with only CLAUDE.md returns CLAUDE.md content with a different warning
```gherkin
Given ab-mcp is configured with {repo-name: "frontend-mobile", doc-path: "<frontend-mobile repo>/docs"}
And "frontend-mobile" has only a CLAUDE.md file (no docs/feature/, no docs/product/architecture/)
And CLAUDE.md contains a section "## API Conventions"
When the agent calls query_context("frontend-mobile", "auth-pagination")
Then the response includes a result with source_file ending in "CLAUDE.md"
And the snippet contains "API Conventions"
And the response includes a warnings entry mentioning
  "only CLAUDE.md-level context"
```

#### Scenario: Repo with zero nWave artifacts returns NO_NWAVE_STRUCTURE
```gherkin
Given ab-mcp is configured with {repo-name: "legacy-payments", doc-path: "<legacy-payments repo>/docs"}
And "legacy-payments/docs" contains only README.md and manuals/ (no
  docs/feature/**/wave-decisions.md, no docs/product/architecture/, no CLAUDE.md)
When the agent calls query_context("legacy-payments", "any-feature-id")
Then the response is an error "NO_NWAVE_STRUCTURE"
And the message explains MVP requires nWave-structured docs and suggests
  adopting nWave conventions or removing the entry from config
```

#### Scenario: list_features reports structure-completeness flags accurately
```gherkin
Given ab-mcp is configured with "cerbos" (ADRs but no wave-decisions.md) and
  "frontend-mobile" (CLAUDE.md only)
When the agent calls list_features("cerbos")
Then the response includes "has_architecture_adrs": true
And the response includes "has_claude_md": (true or false matching cerbos's actual state)
When the agent calls list_features("frontend-mobile")
Then the response includes "has_architecture_adrs": false
And the response includes "has_claude_md": true
```

### Acceptance Criteria

- [ ] `query_context` for a repo with ADRs but no feature-level `wave-decisions.md`/`feature-delta.md` returns ADR-sourced results plus a `warnings` entry naming the gap
- [ ] `query_context` for a repo with only `CLAUDE.md` returns CLAUDE.md-sourced results plus a distinct `warnings` entry naming that gap
- [ ] `query_context`/`list_features` for a repo with NONE of {feature wave-decisions/feature-delta, architecture ADRs, CLAUDE.md} returns `NO_NWAVE_STRUCTURE`
- [ ] `list_features` accurately reports `has_architecture_adrs` and `has_claude_md` per repo, reflecting real filesystem state
- [ ] `warnings` array is absent (or empty) when full nWave structure is present for the queried feature_id (no false-positive warnings)

### Outcome KPIs

- **Who**: AI coding agent querying a repo with incomplete nWave adoption
- **Does what**: Receives accurate partial context with warnings, and surfaces the caveat rather than presenting partial context as complete
- **By how much**: 100% of partial-structure queries (across the 3 completeness levels: full / ADRs-only / CLAUDE.md-only) include a warning matching the actual gap (KPI-5, outcome-kpis.md)
- **Measured by**: Test suite with 1 full-structure + 1 ADRs-only + 1 CLAUDE.md-only repo, asserting `warnings` content per case
- **Baseline**: 0% -- this capability does not exist prior to this story

### Technical Notes (Optional)

- Depends on US-02 (multi-repo config) and US-03 (error response shapes) -- `NO_NWAVE_STRUCTURE` follows the same structured-error pattern as `REPO_PATH_NOT_FOUND`/`FEATURE_NOT_FOUND`.
- This story is the primary build-time probe for the **D-retrieval-risk carry-forward question** (wave-decisions.md, this feature). If, during implementation/testing, warnings prove insufficient to prevent agent overconfidence (e.g., agents still treat ADR-only results as feature-complete despite warnings), escalate to a dedicated SPIKE before DESIGN finalizes the retrieval architecture -- see "Upstream Changes" in this feature's `discuss/wave-decisions.md`.
- Exact warning message wording is a DESIGN-wave detail; AC requires warnings be present, accurate, and distinguishable per gap type (not prescriptive about phrasing).

---

## US-05: No-Staleness Property Verification -- Live Reads Confirmed

### Problem

The entire premise of ab-mcp (per the validated job story) is that it eliminates the staleness problem of manually-copied notes -- "pasted CLAUDE.md sections went stale... worse than no memory because it looks authoritative" (problem-validation.md). If ab-mcp itself introduced any caching, it would silently recreate this exact failure mode. Maria needs confidence that this property holds, not just that it was "designed" to hold.

### Who

- AI coding agent (Claude Code) | Operating in Repo A, querying a sibling repo whose docs were JUST edited (e.g., Maria just merged a wave-decisions.md update in `nwave-cli` moments ago) | Motivation: trust that `query_context` reflects the CURRENT state of the sibling repo, not a snapshot from server startup or a previous query

### Solution

Verify (via property test) that `query_context` reads the configured filesystem path live, on every call, with no caching layer -- a content edit to a source repo's doc file is reflected in the very next query with zero manual sync/restart.

### Elevator Pitch

- **Before**: (Hypothetical regression) If ab-mcp cached `nwave-cli`'s `wave-decisions.md` content at server startup, an agent querying `query_context("nwave-cli", "logging")` after Maria updates that file would receive the OLD content -- recreating the exact "looks authoritative but is stale" failure DISCOVER identified as the worst outcome.
- **After**: Maria edits `nwave-cli/docs/feature/logging/design/wave-decisions.md` (adds a new decision "D-log-format: structured JSON logs"). Without restarting ab-mcp, the agent calls `query_context("nwave-cli", "logging")` and the response's snippet includes "D-log-format: structured JSON logs" -- the new content -- with `retrieved_at` reflecting a fresh read.
- **Decision enabled**: The agent decides to follow the NEW logging convention (structured JSON) rather than whatever was true when ab-mcp started, because it can trust `query_context` reflects "now," not "server startup time."

### Domain Examples

#### 1: Happy Path -- Edit reflected on next query, same session
The agent queries `query_context("nwave-cli", "logging")`, gets snippet text "D-log-format: plain text logs". Maria edits the file to say "D-log-format: structured JSON logs" and saves. The agent (same ab-mcp server process, no restart) re-queries `query_context("nwave-cli", "logging")` and gets "D-log-format: structured JSON logs".

#### 2: Edge Case -- Multiple rapid successive queries each reflect latest state
The agent queries `query_context("ab-mcp", "ab-mcp")` three times in a row, with Maria appending a new line to `wave-decisions.md` between query 2 and query 3. Query 1 and 2 return identical content; query 3 includes the new line.

#### 3: Error/Boundary -- retrieved_at marker present even when content is unchanged
The agent queries `query_context("ab-mcp", "ab-mcp")` twice with no edits in between. Both responses include `retrieved_at: "live (no cache)"` (or equivalent), confirming the marker isn't only set on first/cold read.

### UAT Scenarios (BDD)

#### Scenario: Edit to a source repo's doc is reflected in the very next query
```gherkin
Given ab-mcp is configured with {repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}
And "<AB-MCP repo>/docs/feature/ab-mcp/discover/wave-decisions.md" currently
  does not contain the line "TEMP-VERIFY-LIVE-READ"
When the agent calls query_context("ab-mcp", "ab-mcp")
Then the response's snippet does not contain "TEMP-VERIFY-LIVE-READ"
And the line "TEMP-VERIFY-LIVE-READ" is appended to wave-decisions.md
And the agent calls query_context("ab-mcp", "ab-mcp") again, with no server restart
Then the response's snippet contains "TEMP-VERIFY-LIVE-READ"
And the appended line is reverted afterward
```

#### Scenario: retrieved_at marker present on every response, including unchanged content
```gherkin
Given ab-mcp is configured with {repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}
When the agent calls query_context("ab-mcp", "ab-mcp") twice in a row
  with no file changes in between
Then both responses include a "retrieved_at" field indicating a live
  (uncached) read
And the snippet content is identical between the two responses
```

#### Scenario: Successive queries each reflect the latest on-disk state
```gherkin
Given ab-mcp is configured with {repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}
When the agent calls query_context("ab-mcp", "ab-mcp") (call 1)
And a new line "D-temp: temporary verification line" is appended to
  wave-decisions.md
And the agent calls query_context("ab-mcp", "ab-mcp") again (call 2)
Then call 1's snippet does not contain "D-temp: temporary verification line"
And call 2's snippet contains "D-temp: temporary verification line"
And the appended line is reverted afterward
```

### Acceptance Criteria

- [ ] A content edit to a configured repo's doc file is reflected in the very next `query_context` call for that repo/feature, with no server restart and no manual sync step
- [ ] `retrieved_at` (or equivalent marker) is present on every `query_context` response, including when content is unchanged between calls
- [ ] No caching layer (in-memory, on-disk, or otherwise) is introduced by this story or any prior story (US-01 through US-04)
- [ ] Successive queries reflect successive on-disk states accurately (no stale snapshot from an earlier call)

### Outcome KPIs

- **Who**: AI coding agent querying a sibling repo whose docs change during the agent's working session
- **Does what**: Always receives the current on-disk content, never a stale cached snapshot
- **By how much**: 0 staleness incidents across all property-test runs (KPI-2, outcome-kpis.md) -- 100% of edits visible on next query
- **Measured by**: Property test (Slice 04): edit -> immediate re-query -> diff check
- **Baseline**: N/A (current manual-copy workaround has 100% eventual staleness rate per problem-validation.md)

### Technical Notes (Optional)

- This story is primarily VERIFICATION, not new build -- if US-01/US-02 are implemented without a caching layer (the recommended/default approach per D-retrieval-risk Solution Idea D), this story should require minimal new code, mostly tests.
- Depends on US-01 at minimum (needs a working `query_context` to verify against); can run against the 1-repo or 3-repo config.
- If a future iteration introduces caching for performance reasons, this story's tests become regression guards -- they MUST continue to pass or caching must include invalidation that preserves the "next query reflects edit" guarantee.

---

## Out-of-Scope Backlog (Documented, Not Built in This Feature)

- **Ownership/boundary mapping** (O6, value prop 2): resolving "which repo owns concern X" -- deferred per D-scope. Future iteration.
- **CLAUDE.md auto-injection** (D-bootstrap): automatically adding "use ab-mcp" instructions to a new repo's CLAUDE.md -- manual for MVP per D-bootstrap.
- **Caching with invalidation**: rejected in favor of always-live reads (D-retrieval-risk Solution Idea D over E) -- not part of MVP.
- **Semantic/vector search across loosely-structured repos**: rejected per D-docquality REVISED -- MVP is path-convention-based retrieval against nWave-structured repos only.
