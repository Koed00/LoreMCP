# Journey: Concern-Based Querying -- Visual Map

## Feature: concern-based-querying
## Persona: AI coding agent (Claude Code), operating on behalf of Maria Santos
## Goal: Identify who owns a concern, which constraints apply, and what has been tried — without knowing upfront which repo or feature to look in

---

## Emotional Arc

```
START              MIDDLE                END
Uncertain/Blocked  Searching/Focused     Grounded/Confident
                                         (or Grounded-with-caveat)
"I don't know      "I'm querying by      "I have an authoritative
where to look"      topic, not path"      answer + I know its limits"
```

---

## Journey Flow

```
[Trigger]           [Step 1]             [Step 2]              [Step 3]
Agent is about      Agent expresses      resolve_concern()     Agent reads
to design a         a concern topic      searches all          result: owner
feature and         ("auth", "data       configured repos,     repo, binding
needs to            persistence",        matches against       decisions, ADRs,
understand          "rate-limiting")     nWave artifacts       rejected paths
the landscape                                                   + warnings
   |                    |                     |                     |
Feels: Blocked      Feels: Curious       Feels: Engaged        Feels: Confident
                    Artifacts: concern   Artifacts: matched    Artifacts: result
                    string (input)       files, repo list      JSON response
```

---

## Step Detail: Step 1 — Agent Expresses a Concern

```
+-- Step 1: Agent formulates concern query --------------------+
|                                                              |
|  The agent does NOT need to know:                            |
|    - which repo owns the concern                             |
|    - which feature_id maps to it                             |
|    - whether it has been decided at all                      |
|                                                              |
|  The agent only needs:                                       |
|    - the concern topic in plain language                     |
|      e.g. "auth", "data persistence", "rate-limiting",      |
|           "session management", "error handling"             |
|                                                              |
|  MCP call:                                                   |
|    resolve_concern(concern="auth")                           |
|                                                              |
+--------------------------------------------------------------+

  Feels: Curious — "let me ask the system instead of hunting"
```

---

## Step Detail: Step 2 — Cross-Repo Search Executes

```
+-- Step 2: resolve_concern() searches all configured repos ---+
|                                                              |
|  For each configured repo:                                   |
|    - keyword-match concern string against:                   |
|        docs/feature/**/wave-decisions.md                     |
|        docs/feature/**/feature-delta.md                      |
|        docs/product/architecture/*.md (ADRs)                 |
|        CLAUDE.md                                             |
|                                                              |
|  Match strategy:                                             |
|    - case-insensitive keyword match in file CONTENT          |
|    - also match against feature_id directory names           |
|    - ranked by: feature-level > architecture-level > CLAUDE  |
|                                                              |
|  Shared artifacts tracked:                                   |
|    ${repo_name}   <- from config                             |
|    ${doc_path}    <- from config                             |
|    ${concern}     <- from caller input                       |
|    ${matched_files} <- from live directory scan              |
|                                                              |
+--------------------------------------------------------------+

  Feels: Engaged — system is doing the hard work
  Integration checkpoint: every configured repo must be scanned
  (not just the "current" repo)
```

---

## Step Detail: Step 3 — Agent Receives Structured Response

### Happy Path: Concern found with clear owner

```
+-- Step 3: Result — concern resolved ----------------------------+
|                                                                 |
|  {                                                              |
|    "concern": "auth",                                           |
|    "matches": [                                                 |
|      {                                                          |
|        "repo_name": "nwave-cli",                               |
|        "source_file": ".../docs/feature/auth-flow/             |
|                         design/wave-decisions.md",             |
|        "phase": "design",                                       |
|        "snippet": "## D-auth: JWT strategy decided...",        |
|        "relevance": "feature-level"                            |
|      },                                                         |
|      {                                                          |
|        "repo_name": "nwave-cli",                               |
|        "source_file": ".../docs/product/architecture/          |
|                         ADR-0007-auth-strategy.md",            |
|        "phase": "architecture",                                 |
|        "snippet": "# ADR-0007: Auth Strategy...",              |
|        "relevance": "architecture-level"                       |
|      }                                                          |
|    ],                                                           |
|    "rejected_paths": [                                          |
|      {                                                          |
|        "repo_name": "nwave-cli",                               |
|        "source_file": ".../auth-flow/design/                   |
|                         wave-decisions.md",                    |
|        "snippet": "Rejected: OAuth2 (D-auth-H2)...",           |
|        "type": "rejected_alternative"                          |
|      }                                                          |
|    ],                                                           |
|    "warnings": [],                                              |
|    "retrieved_at": "live (no cache)"                           |
|  }                                                              |
|                                                                 |
+-----------------------------------------------------------------+

  Feels: Confident — "I know who owns this and what was decided"
```

### Partial Path: Concern found but only in ADRs/CLAUDE.md

```
+-- Step 3: Result — concern partially resolved ----------------+
|                                                               |
|  {                                                            |
|    "concern": "rate-limiting",                                |
|    "matches": [                                               |
|      {                                                        |
|        "repo_name": "billing-service",                       |
|        "source_file": ".../ADR-0003-rate-limiting.md",       |
|        "phase": "architecture",                               |
|        "snippet": "# ADR-0003: Rate Limiting...",            |
|        "relevance": "architecture-level"                     |
|      }                                                        |
|    ],                                                         |
|    "rejected_paths": [],                                      |
|    "warnings": [                                              |
|      "No feature-level wave-decisions.md found for           |
|       concern 'rate-limiting' in any configured repo --      |
|       returning architecture-level (ADR) context only."      |
|    ],                                                         |
|    "retrieved_at": "live (no cache)"                          |
|  }                                                            |
|                                                               |
+---------------------------------------------------------------+

  Feels: Grounded-with-caveat — "ADR tells me the constraint,
          but no feature has documented implementation decisions"
```

### No-Match Path: Concern not found anywhere

```
+-- Step 3: Result — concern not found ------------------------+
|                                                              |
|  {                                                           |
|    "error": "CONCERN_NOT_FOUND",                             |
|    "concern": "graphql-federation",                          |
|    "message": "No matches found for 'graphql-federation'    |
|     in any configured repo. This concern may be undecided   |
|     or outside the documented scope of the platform.",      |
|    "searched_repos": ["ab-mcp", "nwave-cli", "nwave-skills"],|
|    "retrieved_at": "live (no cache)"                         |
|  }                                                           |
|                                                              |
+--------------------------------------------------------------+

  Feels: Informed — "I know it hasn't been decided yet"
  Recovery: agent can proceed with a fresh decision, knowing
            there's no prior art to conflict with
```

---

## Error Paths

| Failure | Trigger | Response |
|---------|---------|----------|
| All repos unreachable | Every configured `doc_path` missing on disk | `CONCERN_NOT_FOUND` with `searched_repos` empty, plus per-repo `REPO_PATH_NOT_FOUND` warnings |
| Concern string empty | `resolve_concern(concern="")` | Structured error `INVALID_CONCERN` — not a silent empty match |
| Partial repo failure | 2 of 3 repos readable, 1 has broken path | Returns matches from 2 reachable repos + `warnings` noting skipped repo |

---

## Integration Checkpoints

1. `resolve_concern` must access the SAME config source as `list_features`/`query_context` — single source of truth for `{repo_name, doc_path}` list
2. `source_file` paths in `matches` must be absolute, matching the same format as existing `query_context` responses (shared artifact: `source_file`)
3. `retrieved_at` marker must appear on every response, consistent with US-05's live-read property
4. `warnings` array format must be identical to `query_context` responses (same shared artifact)

---

## Shared Artifacts Referenced

| Artifact | Source | Displayed As | Consumers |
|----------|--------|-------------|-----------|
| `concern` | caller input | `"concern": "${concern}"` | resolve_concern input, response envelope |
| `repo_name` | config | `"repo_name": "${repo_name}"` | matches, warnings, searched_repos |
| `doc_path` | config | internal path resolution | scan root per repo |
| `source_file` | live fs scan | `"source_file": "${source_file}"` | matches, rejected_paths |
| `snippet` | live file read | `"snippet": "${snippet}"` | matches, rejected_paths |
| `retrieved_at` | runtime constant | `"retrieved_at": "live (no cache)"` | every response |
| `warnings` | classification logic | `"warnings": [...]` | partial results, repo-skip notices |
