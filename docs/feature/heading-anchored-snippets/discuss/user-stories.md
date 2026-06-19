# User Stories: heading-anchored-snippets

## System Constraints (carried forward, unchanged)

- **Read-only, local-only, no-cache**: same as `concern-based-querying` — this feature only changes how a snippet is extracted from already-collected file content, no new IO.
- **Functional core / imperative shell**: extraction logic is a pure function in `src/core/concern-matcher.ts`.
- **No new npm dependency**: heading-boundary parsing via regex, same approach as paragraph-splitting in `detectRejectedPaths`.

---

## US-HAS-01: Agent Receives a Heading-Anchored Snippet Instead of a Whole-File Dump

### Job Traceability
Traces to `cross-repo-context-grounding` (jobs.yaml) — specifically the "Locate → Confirm" job map steps: minimizing time to judge relevance of a returned snippet without reading the whole file.

### Problem
Maria (OSS maintainer, dogfooding lore-mcp via Claude Code) calls `resolve_concern(concern: "concern matching")` and gets back the entire `wave-decisions.md` file — truncated at 8000 characters mid-content — instead of just the section discussing concern matching. She has to scroll past four unrelated design decisions (D-CBQ-D1 through D5) to find the one she asked about.

### Who
- AI coding agent (Claude Code) | Calling `resolve_concern` on behalf of a developer | Motivation: judge relevance of a match without re-opening the source file

### Solution
`resolve_concern` extracts the heading-anchored section containing the matched keyword — from the nearest preceding heading to the next heading of equal-or-higher level — instead of returning whole-file content up to the cap.

### Elevator Pitch
Before: `resolve_concern(concern: "caching")` on a multi-section `wave-decisions.md` returns the entire file (up to 8000 chars), forcing the agent to scroll past unrelated sections to find the caching discussion.
After: run `resolve_concern(concern: "caching")` → sees `{"matches": [{"snippet": "## D-caching: Redis strategy\n\nWe use Redis for..." }]}` — only the caching section, not the whole file.
Decision enabled: The agent decides whether to act on the caching decision immediately from the snippet alone, without opening the source file to disambiguate which section is relevant.

### Domain Examples

#### 1: Happy Path — Multi-section file, single match location
`wave-decisions.md` has 5 `## D-CBQ-D{N}:` sections. Only `D-CBQ-D2` discusses "rejection." `resolve_concern("rejection")` returns a snippet starting at `## D-CBQ-D2:` and ending before `## D-CBQ-D3:`.

#### 2: Edge Case — Headingless file
`CLAUDE.md` has no markdown headings, contains "testing" in prose. `resolve_concern("testing")` falls back to whole-file-up-to-cap (unchanged from today).

#### 3: Edge Case — Concern in multiple sections
`wave-decisions.md` mentions "rate-limiting" in two sections — one three times, one once. `resolve_concern("rate-limiting")` returns the section with three mentions only.

### UAT Scenarios (BDD)
See `docs/feature/heading-anchored-snippets/discuss/journey-snippet-extraction.feature` — 5 scenarios covering: multi-section narrowing, headingless fallback, heading-as-match-anchor, multi-section density resolution, and section-exceeds-cap truncation.

### Acceptance Criteria
1. **Given** a matched file with multiple `##`-level sections and the concern appears in exactly one section, **when** `resolve_concern` is called via the MCP tool, **then** the returned snippet contains only that section's content (verified: snippet excludes text unique to other sections).
2. **Given** a matched file with no markdown headings, **when** `resolve_concern` is called, **then** the returned snippet is the whole-file-up-to-8000-chars content (unchanged behavior, regression-tested).
3. **Given** the concern keyword appears within a heading line itself, **when** `resolve_concern` is called, **then** the returned snippet starts at that heading.
4. **Given** the concern appears in two sections of the same file with different occurrence counts, **when** `resolve_concern` is called, **then** the returned snippet is the section with the higher occurrence count.
5. **Given** the matched section itself exceeds 8000 characters, **when** `resolve_concern` is called, **then** the snippet is truncated within that section and a truncation warning is present in the response (reusing the existing warning mechanism).
