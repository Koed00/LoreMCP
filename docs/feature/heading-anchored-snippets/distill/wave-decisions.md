# DISTILL Decisions — heading-anchored-snippets

## Key Decisions
- [DWD-01] Walking Skeleton Strategy: **Strategy C (Real local)** — confirmed with user, identical to `concern-based-querying`. Real tmp_path fixtures, real MCP stdio subprocess via `mcp-client.ts`, no mocks. No new walking-skeleton scenario needed — the existing `walking-skeleton.feature` from `concern-based-querying` already exercises the driving port end-to-end; this round adds scenarios on top of an already-green pipeline.
- [DWD-02] No scaffold files created (Mandate 7 N/A this round) — all 5 scenarios call `resolve_concern` over MCP stdio (port-to-port), not the new internal function directly. No import of `extractHeadingAnchoredSnippet` exists in test code, so there is no ImportError risk; failures are pure assertion failures (RED), confirmed by running the suite against current (pre-implementation) production code.
- [DWD-03] Reconciliation passed — 0 contradictions between DISCUSS and DESIGN wave-decisions.md (verified: multi-section density rule, headingless fallback, heading-as-anchor, and truncation-reuse are stated identically in both).

## Scenario Coverage

| # | Scenario | AC | Pre-implementation result |
|---|---|---|---|
| 1 | Snippet narrowed to matched section (multi-section file) | AC1 | RED (1 of 2 assertions fails — snippet narrowing not yet implemented) |
| 2 | Headingless file falls back to whole-file truncation | AC2 | GREEN (no regression — today's behavior already satisfies this AC by construction) |
| 3 | Concern keyword in heading anchors extraction | AC3 | RED |
| 4 | Multi-section density resolution | AC4 | RED (1 of 2 assertions fails) |
| 5 | Oversized matched section truncated with warning | AC5 | GREEN (today's truncation mechanism already satisfies this AC; will continue to apply unchanged once narrowing is added per DESIGN D4) |

3 of 5 scenarios are genuinely RED (new behavior required); 2 of 5 pass trivially today because they describe preserved/regression-safety behavior, not new behavior — this is expected and correct, not a test-writing defect.

## Adapter Scenario Coverage

| Adapter | @real-io scenario | Covered by |
|---------|-------------------|------------|
| `DocTreeReader` / `createFsDocTreeReader` | YES | Inherited from `concern-based-querying`'s existing real-fs walking skeleton + release-1/2/3 acceptance tests — no new adapter introduced this round (architecture-design.md confirms: "No new fs operations") |

No new driven adapter is introduced by this feature (per architecture-design.md "Changes Per File" table: `fs-doc-tree-reader.ts` is unchanged). Adapter coverage from the prior feature remains valid and is not re-verified here.

## Full Test Suite Status
- 14 of 15 test files green, 331 of 334 individual assertions pass
- 3 assertions in `tests/acceptance/heading-anchored-snippets/heading-anchored-extraction.steps.ts` are RED (confirmed AssertionError, not ImportError/BROKEN) — ready for DELIVER TDD cycle
- Zero regressions to any of the 303 pre-existing tests
