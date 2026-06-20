# User Stories: tool-output-quality

## System Constraints (carried forward, unchanged)

- **Read-only, local-only, no-cache**: all 4 fixes change existing response content, not IO behavior.
- **Functional core / imperative shell**: all logic changes are pure functions in `src/core/`, except the deliver-phase detection which reads a new file (`execution-log.json`) in the shell layer (`src/shell/server.ts`), consistent with where `discoverFeatures` already lives.
- **No new npm dependency**: all 4 fixes reuse existing parsing/filtering patterns already in the codebase.

---

## US-TOQ-01: Agent Receives a Bounded query_context Response Regardless of Feature History Depth

### Job Traceability
Traces to `cross-repo-context-grounding` — the "Confirm" job map step (minimize uncertainty about whether retrieved context is usable) is currently violated: a 97,705-character response is not usable by an agent in one call.

### Problem
Maria (OSS maintainer, dogfooding lore-mcp) calls `query_context("lore-mcp", "list-concerns")` immediately after that feature's DELIVER wave completes — a feature with 3+ phases of accumulated wave-decisions.md content. The response is 97,705 characters, exceeding the calling agent's own token limit and failing outright.

### Who
- AI coding agent (Claude Code) | Calling `query_context` to deep-dive a specific feature | Motivation: get usable context regardless of how much history the feature has accumulated

### Solution
Apply a total-response size cap to `query_context`'s aggregated output, truncating oldest-wave content first, with a truncation warning.

### Elevator Pitch
Before: `query_context("lore-mcp", "list-concerns")` returns 97,705 characters — too large for the calling agent to process in one call, with no warning that this happened.
After: run `query_context("lore-mcp", "list-concerns")` → sees a response capped at a fixed size, with `"warnings": ["response truncated, oldest wave content dropped"]` when capping occurs.
Decision enabled: The agent can rely on `query_context` returning a usable-sized response every time, and knows when it's seeing a partial picture versus the full history.

### Domain Examples

#### 1: Happy Path — Oversized feature gets capped
A feature with 5 phases of wave-decisions.md content summing past the cap. `query_context` returns truncated content with the most recent wave preserved and a truncation warning.

#### 2: Edge Case — Normal-sized feature is unaffected
A feature with one phase's worth of content, well under the cap. `query_context` returns the full content, no warning — identical to today.

### UAT Scenarios (BDD)
See `docs/feature/tool-output-quality/discuss/journey-tool-output-quality.feature` scenarios 1-2.

### Acceptance Criteria
1. A feature whose combined wave-decisions content exceeds the cap returns a truncated response with a warning, via the `query_context` MCP tool.
2. A feature under the cap returns an unchanged, untruncated response.
3. When truncated, the most recent wave's content is preserved over older waves.

---

## US-TOQ-02: Agent Receives High-Signal Candidates from list_concerns

### Job Traceability
Traces to `cross-repo-context-grounding` — `list_concerns`'s entire purpose (browse before you query) is undermined if most candidates are generic boilerplate the agent must mentally filter itself.

### Problem
Maria calls `list_concerns()` and gets 96 candidates, a large fraction of which are generic nWave section headers ("Decisions", "Summary", "Mode") present in nearly every wave-decisions.md by convention — indistinguishable from genuine topics like "Concern Matching Strategy" without reading further.

### Who
- AI coding agent (Claude Code) | Browsing candidate topics before calling `resolve_concern` | Motivation: every candidate should be worth considering, not generic noise

### Solution
Filter a stoplist of known generic nWave section headers out of `list_concerns`'s heading-text candidates only (never directory names or ADR titles).

### Elevator Pitch
Before: `list_concerns()` returns 96 candidates including "Decisions", "Summary", "Mode" — generic noise indistinguishable from real topics.
After: run `list_concerns()` → sees a candidate list with generic headers filtered out, dense with genuine topic signal.
Decision enabled: The agent can scan the candidate list and trust that most entries are worth considering, instead of mentally filtering boilerplate itself.

### Domain Examples

#### 1: Happy Path — Generic headers filtered, genuine topics kept
A wave-decisions.md with headings "Decisions", "Summary", and "D-auth: JWT strategy". Only the last survives filtering.

#### 2: Edge Case — A literally-named directory/ADR is not filtered
A feature directory literally named "Decisions" still surfaces, since the stoplist applies only to heading text, never directory/ADR names.

### UAT Scenarios (BDD)
See `docs/feature/tool-output-quality/discuss/journey-tool-output-quality.feature` scenarios 3-4.

### Acceptance Criteria
1. A heading-text candidate matching the stoplist is excluded from the `list_concerns` response.
2. A genuine decision-topic heading is not excluded.
3. A feature directory or ADR title literally matching a stoplist term is not excluded.

---

## US-TOQ-03: Agent Can Tell Whether a Feature's DELIVER Wave Actually Happened

### Job Traceability
Traces to `cross-repo-context-grounding` — an agent asking "did this feature ship?" currently gets a wrong answer from `list_features`, since DELIVER-wave evidence (execution-log.json) is never checked.

### Problem
`list_features("lore-mcp")` reports `phases: ["design","discuss","distill"]` for `concern-based-querying`, `heading-anchored-snippets`, and `list-concerns` — all of which have a complete, committed DELIVER wave with a real `execution-log.json`. The tool is silently blind to whether a feature shipped.

### Who
- AI coding agent (Claude Code) | Checking what's been built in a sibling repo | Motivation: know whether a feature is just planned/designed or actually delivered

### Solution
Detect the `deliver` phase via `execution-log.json` containing at least one COMMIT-phase entry, not merely via `wave-decisions.md` presence (DELIVER doesn't produce that file).

### Elevator Pitch
Before: `list_features("lore-mcp")` shows `phases: ["design","discuss","distill"]` for `list-concerns`, even though it has a complete, committed DELIVER wave.
After: run `list_features("lore-mcp")` → sees `phases: ["design","discuss","distill","deliver"]` for `list-concerns`.
Decision enabled: The agent can trust `list_features`'s phases array to answer "did this feature ship?", not just "was this feature designed?"

### Domain Examples

#### 1: Happy Path — Completed DELIVER is detected
A feature with `execution-log.json` containing a COMMIT-phase entry. `deliver` appears in its phases array.

#### 2: Edge Case — Started-but-incomplete DELIVER is not counted
A feature with `execution-log.json` but zero COMMIT entries (mid-DELIVER, abandoned or in progress). `deliver` does NOT appear.

### UAT Scenarios (BDD)
See `docs/feature/tool-output-quality/discuss/journey-tool-output-quality.feature` scenarios 5-6.

### Acceptance Criteria
1. A feature with `execution-log.json` containing ≥1 COMMIT entry includes `"deliver"` in its phases array.
2. A feature with `execution-log.json` containing zero COMMIT entries does not include `"deliver"`.
3. A feature with no `deliver/` directory at all behaves identically to today.

---

## US-TOQ-04: Agent Is Nudged Toward list_concerns When resolve_concern Finds Nothing

### Job Traceability
Traces to `cross-repo-context-grounding` — the two tools were explicitly designed to chain (README's documented workflow), but the error path doesn't reflect that chain.

### Problem
`resolve_concern("rate-limiting")` (a concern this repo never decided on) returns `CONCERN_NOT_FOUND` with no mention of `list_concerns()`, even though that's the documented recovery path for exactly this situation.

### Who
- AI coding agent (Claude Code) | Just got a dead end from `resolve_concern` | Motivation: know the next step without re-reading the README

### Solution
`CONCERN_NOT_FOUND`'s message text mentions `list_concerns()` as the next step.

### Elevator Pitch
Before: `resolve_concern("rate-limiting")` returns `CONCERN_NOT_FOUND` with a message that says nothing about what to try next.
After: run `resolve_concern("rate-limiting")` → sees a `CONCERN_NOT_FOUND` message that mentions `list_concerns()`.
Decision enabled: The agent's next action is suggested directly in the error, not left to memory of the README.

### Domain Examples

#### 1: Happy Path — Message mentions list_concerns
A concern absent from all configured repos. The `CONCERN_NOT_FOUND` message text includes "list_concerns".

### UAT Scenarios (BDD)
See `docs/feature/tool-output-quality/discuss/journey-tool-output-quality.feature` scenario 7.

### Acceptance Criteria
1. `CONCERN_NOT_FOUND`'s message mentions `list_concerns`.
