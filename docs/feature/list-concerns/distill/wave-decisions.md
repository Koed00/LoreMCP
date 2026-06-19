# DISTILL Decisions — list-concerns

## Key Decisions
- [DWD-01] Walking Skeleton Strategy: **Strategy C (Real local)** — confirmed with user, identical to the two prior features. Real tmp_path fixtures, real MCP stdio subprocess via `mcp-client.ts`, no mocks. No new walking-skeleton scenario needed — the existing `walking-skeleton.feature` from `concern-based-querying` already exercises the driving port end-to-end; this round adds a 4th tool's scenarios on top of an already-green server.
- [DWD-02] RED scaffold required (unlike the prior two features): `list_concerns` had no registered MCP tool at all (not even a stub), so the first acceptance-test run produced a real MCP protocol-level error ("MCP error: Unknown tool") rather than a clean assertion failure — risking BROKEN misclassification per Mandate 7. Fixed by registering a minimal `NOT_IMPLEMENTED`-stub tool in `src/shell/server.ts` (mirroring the precedent already established for `resolve_concern`'s own walking-skeleton stub in the `concern-based-querying` feature). This converts the failure mode into clean JSON responses that the test assertions can compare against, producing genuine `AssertionError`s instead of protocol crashes.
- [DWD-03] Step-definition assertions use `?? []` nullish-coalescing guards on `lastResponse.concerns`/`lastResponse.searched_repos` so that a not-yet-implemented response shape (missing these fields entirely) produces a clean failed assertion rather than a `TypeError` crash mid-test — same RED-not-BROKEN discipline as the tool-registration fix above, applied at the assertion level too.
- [DWD-04] Reconciliation passed — 0 contradictions between DISCUSS and DESIGN wave-decisions.md (verified: topic-extraction sources, dedup behavior, 200-cap, and the no-error-shape decision are stated identically in both).

## Scenario Coverage

| # | Scenario | AC | Pre-implementation result |
|---|---|---|---|
| 1 | Candidate topics from feature dirs + ADR titles across repos | AC1 | RED |
| 2 | Structureless repo silently excluded | AC2 | RED |
| 3 | All repos structureless | AC3 | RED |
| 4 | Duplicate topic across repos deduplicated | AC4 | RED |
| 5 | Over-200-candidates capped with truncation warning | AC5 | RED |

All 5 scenarios are genuinely RED — unlike `heading-anchored-snippets` (where 2 of 5 passed trivially because they described preserved/regression-safety behavior), `list_concerns` is a wholly new tool, so every scenario requires new implementation.

## Adapter Scenario Coverage

| Adapter | @real-io scenario | Covered by |
|---------|-------------------|------------|
| `DocTreeReader` / `createFsDocTreeReader` | YES | Inherited from `concern-based-querying`'s existing real-fs walking skeleton + release-1/2/3 acceptance tests — no new adapter introduced this round (architecture-design.md confirms: `listDir`/`readFile`/`pathExists`/`probe` are reused unchanged) |

No new driven adapter is introduced by this feature (per architecture-design.md "Changes Per File" table: `fs-doc-tree-reader.ts` is unchanged). Adapter coverage from the prior features remains valid and is not re-verified here.

## Full Test Suite Status
- 15 of 16 test files green, 394 of 406 individual assertions pass
- 12 assertions in `tests/acceptance/list-concerns/list-concerns-discovery.steps.ts` are RED (confirmed `AssertionError`, not `TypeError`/`SyntaxError`/`ImportError`) — ready for DELIVER TDD cycle
- Zero regressions to any of the 369 pre-existing tests
