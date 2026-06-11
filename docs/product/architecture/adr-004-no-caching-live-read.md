# ADR-004: No-Caching, Live-Read Architecture

## Status
Accepted (carried forward from DISCOVER/DISCUSS as a binding system constraint -- not a DESIGN-wave choice point, documented here for architectural traceability and enforcement)

## Context

The validated job story (problem-validation.md) identifies STALENESS of manually-copied cross-repo notes as the worst failure mode -- "pasted CLAUDE.md sections went stale... worse than no memory because it looks authoritative." D-retrieval-risk Solution Idea D ("always read live, no caching") was chosen over Idea E (caching with invalidation) at DISCOVER. US-05 exists specifically to verify this property holds (KPI-2, guardrail metric).

System Constraints (discuss/user-stories.md): "No caching: every `query_context`/`list_features` call reads the filesystem live at call time... zero staleness by construction."

## Decision

ab-mcp introduces **NO caching layer of any kind** -- no in-memory cache, no on-disk cache, no memoization across calls, for: config file content, directory listings, or file content.

Every `list_features`/`query_context` call:
1. Re-reads `ab-mcp.config.json` from disk
2. Re-runs directory enumeration (`docs/feature/*/`, `docs/product/architecture/*.md`, `CLAUDE.md` existence checks)
3. Re-reads any matched file's full content

`retrieved_at` is computed at call time (e.g., `"live (no cache)"` or an ISO timestamp of the read), never a startup-time or first-call value.

This also means: **config file edits take effect on the next call without a server restart** -- adding repo entries 4-10 (KPI-3/H4) requires no restart, just an edited config file and a subsequent tool call.

## Alternatives Considered

### In-memory cache with TTL
- Pros: would reduce repeated fs syscalls for high-frequency queries
- Cons: directly recreates the staleness failure mode that is THE primary validated problem this tool exists to solve; even a short TTL means "an edit made 10 seconds ago might not be visible yet" -- which is exactly the "looks authoritative but is stale" failure described in problem-validation.md
- Rejected: violates the core value proposition (D-done) and the explicit guardrail metric KPI-2

### Cache with file-watcher invalidation (e.g., chokidar)
- Pros: could approximate "live" while reducing repeated reads, invalidating on fs change events
- Cons: adds a dependency, adds complexity (watcher lifecycle, debouncing, watcher failure modes needing their OWN probe contracts), and for a LOCAL tool reading small markdown files, the performance benefit is negligible -- fs reads of small files are not a bottleneck for an interactive agent workflow. Adds a new class of bugs (watcher misses an event -> silent staleness, the worst-case failure mode) for no measurable benefit.
- Rejected: complexity and new failure modes not justified by any performance requirement (none exists -- this is a local single-process dev tool, not a high-throughput service)

## Consequences

### Positive
- Staleness is structurally impossible by construction -- satisfies KPI-2 (0 staleness incidents) without any test-time-only guarantee
- US-05's property tests become simple: edit file, call tool, assert new content appears -- no cache-invalidation logic to test
- Simplifies the architecture: no cache lifecycle, no invalidation logic, no watcher dependency

### Negative
- Every call performs fresh fs syscalls (directory listings + file reads) -- acceptable given local fs performance and the interactive (not high-frequency-loop) usage pattern; if this EVER becomes a measured performance problem, KPI-2 must be re-verified before introducing any caching (per outcome-kpis.md Guardrail Metrics note)

## Enforcement

The `dependency-cruiser` rule set (ADR referenced in brief.md Section 6/9) should additionally include a check (or a code-review checklist item, given no CI yet) that no module introduces a persistent in-memory `Map`/`Set`/module-level variable keyed by `repo_name`/`doc_path`/`feature_id` that survives across tool invocations -- this is a structural smell indicating an incipient cache. Given the small codebase size, this is initially a code-review checklist item; if the codebase grows, consider a custom AST lint rule.
