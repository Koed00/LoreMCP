# Outcome KPIs — tool-output-quality

| KPI | Target | Measurement Method |
|---|---|---|
| KPI-TOQ-1: query_context bounded response | Re-running `query_context("lore-mcp", "list-concerns")` post-fix returns a response within the cap (down from the 97,705-char baseline) | Live dogfood re-run via MCP connection, compare char count to baseline |
| KPI-TOQ-2: list_concerns signal density | Re-running `list_concerns()` against this repo's own docs returns fewer candidates than the 96-candidate baseline, with all known generic headers (Decisions, Summary, Mode, etc.) absent | Live dogfood re-run, diff against baseline candidate list |
| KPI-TOQ-3: list_features deliver visibility | Re-running `list_features("lore-mcp")` post-fix shows `"deliver"` in the phases array for `concern-based-querying`, `heading-anchored-snippets`, and `list-concerns` (all 3 known to have real completed DELIVER waves) | Live dogfood re-run, compare to known DELIVER-completion state |
| KPI-TOQ-4: resolve_concern nudge present | Re-running `resolve_concern("rate-limiting")` post-fix returns a message mentioning `list_concerns` | Live dogfood re-run |
| KPI-TOQ-5: Zero regression across all 4 slices | All pre-existing acceptance/unit tests remain green after each slice | Full `npm test` run after each slice's GREEN phase |
| KPI-TOQ-6: Mutation kill rate on all modified files | ≥80% (per-feature gate; explicit reminder per the lesson learned in `list-concerns` — verify `stryker.config.mjs`'s mutate scope already covers every file touched, since this round touches `format-response.ts`, `concern-matcher.ts`, and `server.ts`, plus possibly `classify-structure.ts`) | `npm run test:mutation` after DELIVER completes |
