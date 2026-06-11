# Slice 04: No-Staleness Verification (Live Reads)

## Learning Hypothesis

"Because ab-mcp reads configured doc paths live at query time with no caching layer, a change to a source repo's doc file is reflected in the very next query with zero manual sync -- proving H2 (no staleness) by construction, verified via property test."

## Scope

- `query_context` response includes `retrieved_at` marker indicating a live (uncached) read
- Property test: modify a source repo's `wave-decisions.md` content, re-run `query_context` immediately, confirm updated content returned
- No caching layer is introduced anywhere in the implementation (verification, not new build -- mostly piggybacks on Slices 00-01)

## Production Data

Use the walking-skeleton repo (ab-mcp's own docs) or one of the 3-repo config entries from Slice 01. Make a real, small, reversible edit to a real wave-decisions.md (e.g., append a line, then revert).

## Effort Estimate

0.5 day (verification-heavy, minimal new code if Slices 00-01 already avoid caching)

## Demo

Query `query_context("ab-mcp", "ab-mcp")`, note content + retrieved_at. Append a line to `docs/feature/ab-mcp/discover/wave-decisions.md`. Re-query immediately -> new line appears in the response, retrieved_at reflects the new read, no restart/cache-clear needed. Revert the edit.

## Maps to User Story

US-05 (No-Staleness Property Verification) in user-stories.md
