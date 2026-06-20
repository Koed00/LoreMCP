# DISTILL Decisions — tool-output-quality

## Key Decisions
- [DWD-01] Walking Skeleton Strategy: **Strategy C (Real local)** — confirmed with user, identical to every prior round. Real tmp_path fixtures, real MCP stdio subprocess via `mcp-client.ts`, no mocks. No new walking-skeleton scenario — all 4 driving ports (`query_context`, `list_concerns`, `list_features`, `resolve_concern`) already have proven walking skeletons from prior features.
- [DWD-02] No scaffold files created (Mandate 7 N/A this round) — all 8 scenarios call existing, already-registered MCP tools over stdio (port-to-port). No new tool registration needed (unlike `list-concerns`'s DISTILL pass, which required a `NOT_IMPLEMENTED` stub for a tool that didn't exist at all). Failures are pure assertion failures, confirmed by running the suite against current (pre-implementation) production code.
- [DWD-03] Reconciliation passed — 0 contradictions between DISCUSS and DESIGN wave-decisions.md (verified: total-response-cap-not-per-file, heading-text-only stoplist, COMMIT-entry-required deliver detection, and unconditional nudge text are stated identically in both).

## Scenario Coverage

| # | Scenario | Slice / AC | Pre-implementation result |
|---|---|---|---|
| 1 | query_context caps oversized response with warning | Slice 01 AC1, AC3 | RED (3 of 4 assertions fail) |
| 2 | query_context does not truncate normal-sized response | Slice 01 AC2 | GREEN (regression-safety — today's unbounded behavior already satisfies "no truncation" trivially) |
| 3 | list_concerns filters generic headings, keeps genuine topics | Slice 02 AC1, AC2 | RED (2 of 3 assertions fail — genuine-topic assertion already passes) |
| 4 | list_concerns does not filter a literally-named directory | Slice 02 AC3 | GREEN (no stoplist exists yet, so nothing is filtered — passes trivially, will continue passing post-fix since stoplist scope excludes directory names) |
| 5 | list_features reports deliver phase with COMMIT entry | Slice 03 AC1 | RED |
| 6 | list_features omits deliver phase without COMMIT entry | Slice 03 AC2 | GREEN (no detection logic exists yet, so deliver is never included — passes trivially today, must continue passing post-fix since the new logic must also exclude this case) |
| 7 | list_features unaffected when no deliver dir exists | Slice 03 AC3 | GREEN (regression-safety — zero new code path triggered) |
| 8 | resolve_concern nudges toward list_concerns | Slice 04 AC1 | RED |

4 of 8 scenarios are genuinely RED (new behavior required); 4 of 8 pass trivially today because they describe preserved/regression-safety behavior or because the absence of new logic incidentally produces the same outcome the new logic must also produce — this is expected and correct, not a test-writing defect, consistent with the precedent set in `heading-anchored-snippets`'s DISTILL pass.

## Adapter Scenario Coverage

| Adapter | @real-io scenario | Covered by |
|---------|-------------------|------------|
| `DocTreeReader` / `createFsDocTreeReader` | YES | Inherited from prior features' real-fs walking skeletons + acceptance tests — no new adapter introduced this round. Slice 03's new `execution-log.json` read uses the EXISTING `reader.readFile` method, already gold-tested. |

No new driven adapter is introduced by this round (per architecture-design.md: `fs-doc-tree-reader.ts` requires no new method — `readFile`/`pathExists` already suffice for slice 03's `execution-log.json` read). Adapter coverage from prior features remains valid and is not re-verified here.

## Full Test Suite Status
- 16 of 17 test files green, 484 of 491 individual assertions pass
- 7 assertions in `tests/acceptance/tool-output-quality/tool-output-quality.steps.ts` are RED (confirmed `AssertionError`, not `TypeError`/`SyntaxError`/`ImportError`) — ready for DELIVER TDD cycle
- Zero regressions to any of the 442 pre-existing tests
