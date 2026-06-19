# Journey: Agent receives a heading-anchored snippet from resolve_concern

## Mental Model

The agent calling `resolve_concern` already believes: "a match means the snippet shows me the relevant part." Today this belief is false for long files — the snippet is whole-file-content truncated at 8000 chars, not the relevant section. This journey closes that gap without introducing new vocabulary (`match`, `snippet`, `relevance` are all pre-existing concepts).

## Happy Path

| Step | Agent Action | Tool Behavior | Output | Emotional State |
|---|---|---|---|---|
| 1 | Calls `resolve_concern(concern: "X")` | Scans configured repos for matches (unchanged) | List of candidate files | Neutral — querying |
| 2 | — | **[NEW]** Locates the paragraph/section within each matched file that contains the concern keyword | Internal: matched section boundaries | — |
| 3 | — | **[NEW]** Extracts the section using heading boundaries (nearest preceding heading → next heading of equal-or-higher level), capped at 1500-8000 chars | `snippet` field narrowed to the relevant section | — |
| 4 | Reads the match | Returns `ConcernMatch` with narrowed snippet | Agent sees only the relevant section | **Confident** — no dread of scanning 8000 chars for the actual point |
| 5 | Acts on the decision | — | — | Decisive — acts without re-opening the source file |

## Emotional Arc

Neutral (querying) → Neutral (waiting) → **Confident** (snippet is sufficient to decide) → Decisive (acts). Strictly upward — no step introduces new doubt versus today's behavior; the change only removes an existing friction point (excess scanning).

## Shared Artifacts Registry

| Artifact | Type | Single Source of Truth |
|---|---|---|
| `concern` | string | Agent's MCP tool call argument (unchanged) |
| `ConcernMatch.snippet` | string | New heading-anchored extraction function in `src/core/concern-matcher.ts`, replacing today's whole-file-substring-then-truncate logic |
| `ConcernMatch.source_file`, `phase`, `relevance` | unchanged | Existing fields, no change |

No new variables introduced — this is a quality improvement to an existing field's content, not a new concept.

## Error / Edge Paths

| Scenario | Behavior | Why |
|---|---|---|
| File has no markdown headings (plain prose) | Fall back to today's whole-file-up-to-cap truncation | No heading boundary exists to anchor to — graceful degradation, not a failure |
| Concern keyword appears in multiple sections of the same file | **OPEN — flagged for DESIGN**: either return the most keyword-dense section, or concatenate multiple sections up to the cap | Ambiguous without a DESIGN-wave decision; not blocking DISCUSS |
| Concern keyword appears in a heading itself (not body text) | The section *starting at* that heading is extracted | Heading match implies the whole section is relevant |
| Extracted section itself exceeds the cap | Truncate within the section (existing truncation-warning mechanism, reused) | Same mechanism as today, just applied to a narrower input |

## Constraints for DESIGN

1. Heading-boundary parsing must remain a pure function (no new dependency, reuses paragraph-splitting precedent from `detectRejectedPaths`).
2. Multi-section-match behavior is an open decision — DESIGN must resolve and document rationale.
3. No regression to today's behavior on headingless files — must be covered by an explicit acceptance scenario.
