# Journey: Cross-Repo Context Retrieval (Visual)

## Actor

An AI coding agent (e.g., Claude Code) operating in **Repo A** (a new/different repo in a multi-repo nWave platform), on behalf of a developer (e.g., the OSS maintainer dogfooding ab-mcp). The agent's "feelings" are reframed pragmatically as **confidence/correctness signals** -- does the agent have grounded, attributable, current information to act on, or is it guessing?

## Trigger

The agent, while working a feature in Repo A, encounters a decision point that depends on a convention, ADR, or prior wave decision established in a sibling repo (Repo B/C/D) -- e.g., "what pagination convention does the backend use?"

## Emotional Arc (Agent Confidence Framing)

```
START                MIDDLE                          END
Uncertain/Blocked -> Investigating (tool calls) ---> Grounded/Confident
"I don't know         "Querying configured            "I have the answer,
 Repo B's              repos for relevant               with source file path,
 convention,            context..."                     I can proceed correctly"
 guessing is risky"

ERROR BRANCH (any step): Grounded/Confident-with-caveat
  "Repo B isn't configured / has no nWave docs / feature_id not found
   -> agent receives a clear, actionable message and either retries
   with corrected input or proceeds while flagging the gap to the
   developer -- never silently fabricates an answer."
```

No jarring transitions: every error path returns a structured, attributable response (never a silent failure or hallucination-inducing empty response).

## ASCII Flow

```
[Repo A: agent working   [Agent calls            [ab-mcp reads LIVE     [Agent receives
 on a feature, hits a  ]  list_features(repo) ] ->  filesystem of      ] -> snippet(s) +
 cross-repo question  ]    and/or                   configured Repo B/   source file path(s),
                            query_context(repo,      C/D doc folders      grounds its work
                            feature_id)               (no cache)          decision

  Feels: Uncertain          Feels: Investigating      Feels: (system       Feels: Grounded/
                                                        retrieving)          Confident
  Sees: ambiguous           Sees: tool call in        Sees: (internal)     Sees: structured
   requirement in            progress                                       response: snippet
   Repo A's code/docs                                                       text + repo name +
                                                                             file path + section

  Artifacts: feature_id     Artifacts: ab-mcp         Artifacts: docs/     Artifacts: returned
   or topic of interest      config (list of           feature/{id}/        snippet text,
                              {repo-name, doc-path})    {phase}/wave-        source attribution
                                                          decisions.md or     (repo-name + path)
                                                          feature-delta.md,
                                                          docs/product/
                                                          architecture/*.md,
                                                          CLAUDE.md
```

## TUI Mockups (MCP tool call/response, agent-facing)

### Step 1: Agent discovers what's available -- list_features(repo_name)

```
+-- MCP Tool Call: list_features ----------------------------------+
| Tool: ab-mcp.list_features                                        |
| Args: { "repo_name": "${repo_name}" }                             |
+--------------------------------------------------------------------+
| Response (JSON):                                                   |
| {                                                                   |
|   "repo_name": "${repo_name}",                                     |
|   "doc_path": "${doc_path}",                                       |
|   "features": [                                                    |
|     { "feature_id": "auth-pagination",                             |
|       "phases": ["discover","discuss","design","deliver"] },       |
|     { "feature_id": "rate-limiting",                               |
|       "phases": ["discover","discuss"] }                           |
|   ],                                                                |
|   "has_architecture_adrs": true,                                   |
|   "has_claude_md": true                                            |
| }                                                                   |
+--------------------------------------------------------------------+
```

### Step 2: Agent retrieves grounded context -- query_context(repo_name, feature_id)

```
+-- MCP Tool Call: query_context -----------------------------------+
| Tool: ab-mcp.query_context                                         |
| Args: { "repo_name": "${repo_name}",                               |
|         "feature_id": "auth-pagination" }                          |
+--------------------------------------------------------------------+
| Response (JSON):                                                    |
| {                                                                    |
|   "repo_name": "${repo_name}",                                      |
|   "feature_id": "auth-pagination",                                  |
|   "results": [                                                      |
|     {                                                                |
|       "source_file": "${doc_path}/feature/auth-pagination/         |
|                        design/wave-decisions.md",                   |
|       "phase": "design",                                            |
|       "snippet": "## D-pagination: Cursor-based pagination\n        |
|                    All list endpoints use opaque cursor tokens       |
|                    (base64-encoded offset+filter hash)..."          |
|     },                                                               |
|     {                                                                |
|       "source_file": "${doc_path}/product/architecture/             |
|                        ADR-0007-pagination.md",                      |
|       "phase": "architecture",                                       |
|       "snippet": "# ADR-0007: Pagination Strategy\n                  |
|                    Status: Accepted\n                                |
|                    Decision: cursor-based over offset-based..."      |
|     }                                                                |
|   ],                                                                 |
|   "retrieved_at": "live (no cache)"                                  |
| }                                                                     |
+--------------------------------------------------------------------+
```

### Step 3 (error): Configured repo path doesn't exist

```
+-- MCP Tool Call: query_context (error) ----------------------------+
| Response (JSON):                                                    |
| {                                                                     |
|   "error": "REPO_PATH_NOT_FOUND",                                    |
|   "repo_name": "billing-service",                                    |
|   "configured_path": "/Users/dev/code/billing-service/docs",         |
|   "message": "Configured doc-path for 'billing-service' does not    |
|                exist on disk. Check ab-mcp config entry              |
|                (repo-name: 'billing-service') and verify the path    |
|                is correct and accessible.",                          |
|   "available_repos": ["frontend-web", "frontend-mobile", "cerbos"]   |
| }                                                                      |
+----------------------------------------------------------------------+
```

### Step 4 (error): feature_id not found in configured repo

```
+-- MCP Tool Call: query_context (error) ----------------------------+
| Response (JSON):                                                    |
| {                                                                     |
|   "error": "FEATURE_NOT_FOUND",                                      |
|   "repo_name": "frontend-web",                                       |
|   "feature_id": "auth-pagination",                                   |
|   "message": "No docs/feature/auth-pagination/ directory found in   |
|                'frontend-web'. Use list_features('frontend-web') to |
|                see available feature_ids.",                          |
|   "available_features": ["checkout-flow", "notifications-v2"]        |
| }                                                                      |
+----------------------------------------------------------------------+
```

### Step 5 (partial structure): repo has ADRs but no wave-decisions.md

```
+-- MCP Tool Call: query_context (partial) --------------------------+
| Response (JSON):                                                    |
| {                                                                     |
|   "repo_name": "cerbos",                                              |
|   "feature_id": "permission-policies",                               |
|   "results": [                                                        |
|     {                                                                  |
|       "source_file": "${doc_path}/product/architecture/              |
|                        ADR-0012-policy-format.md",                    |
|       "phase": "architecture",                                        |
|       "snippet": "# ADR-0012: Policy Format\n..."                     |
|     }                                                                  |
|   ],                                                                   |
|   "warnings": [                                                        |
|     "No docs/feature/permission-policies/ wave-decisions.md found    |
|      in 'cerbos' -- returning architecture-level (ADR) context only.  |
|      Feature-level decisions may not be captured."                    |
|   ],                                                                   |
|   "retrieved_at": "live (no cache)"                                   |
| }                                                                       |
+-----------------------------------------------------------------------+
```

### Step 6 (no nWave docs at all)

```
+-- MCP Tool Call: query_context (no structure) ---------------------+
| Response (JSON):                                                    |
| {                                                                     |
|   "error": "NO_NWAVE_STRUCTURE",                                     |
|   "repo_name": "legacy-payments",                                    |
|   "configured_path": "/Users/dev/code/legacy-payments/docs",         |
|   "message": "Configured path exists but contains none of: docs/    |
|                feature/**/wave-decisions.md or feature-delta.md,     |
|                docs/product/architecture/, CLAUDE.md. ab-mcp MVP     |
|                requires nWave-structured docs. Consider adopting    |
|                nWave doc conventions in 'legacy-payments', or        |
|                remove this entry from ab-mcp config."                |
| }                                                                      |
+-----------------------------------------------------------------------+
```

## Shared Artifacts (Summary -- see registry for full detail)

- `${repo_name}` -- from ab-mcp config list, consumed by both `list_features` and `query_context`
- `${doc_path}` -- from ab-mcp config list, root for all filesystem reads
- `${feature_id}` -- from Repo A agent's query, must match `docs/feature/{feature_id}/` directory in target repo
- `source_file` -- always an absolute or doc_path-relative path returned with every snippet (source attribution, anti-hallucination)

## Integration Checkpoints

1. ab-mcp config (list of `{repo_name, doc_path}`) is the single source of truth for which repos/paths are queryable -- both tools read from it.
2. Every snippet returned by `query_context` carries `source_file` traceable back to `${doc_path}` + relative nWave path.
3. No caching layer -- every query re-reads the filesystem (validates H2/D-retrieval-risk "no staleness").
4. Error responses are structured (not exceptions/stack traces) so the calling agent can reason about next steps.

## Walking Skeleton Note

The thinnest end-to-end slice (Feature 0): ab-mcp boots with a config containing ONE repo entry, `list_features` returns that repo's feature_ids by scanning `docs/feature/*/`, and `query_context(repo, feature_id)` returns the real content of that repo's `wave-decisions.md` (or `feature-delta.md`) with source attribution. See story-map.md.
