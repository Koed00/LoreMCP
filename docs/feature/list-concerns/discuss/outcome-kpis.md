# Outcome KPIs — list-concerns

| KPI | Target | Measurement Method |
|---|---|---|
| KPI-LC-1: Candidate completeness on dogfood corpus | `list_concerns()` against this repo's own `docs/` returns at least one candidate per existing feature directory and ADR (zero silent omissions) | Compare output against `ls docs/feature/` and `ls docs/product/architecture/*.md` manually post-implementation |
| KPI-LC-2: Zero false errors on structureless repos | A repo with zero nWave structure never causes `list_concerns()` to error for the whole call | Acceptance scenario 2/3 — exact non-error assertion |
| KPI-LC-3: Deduplication correctness | Zero duplicate strings in any `list_concerns()` response, even when the same topic is signaled by both a directory name and an ADR title | Acceptance scenario 4 |
| KPI-LC-4: Mutation kill rate on new aggregation function | ≥80% (per-feature gate, consistent with project's mutation testing strategy — and consistent with the lesson learned in `heading-anchored-snippets` that the mutate scope in `stryker.config.mjs` must be kept current) | `npm run test:mutation` scoped to the new function |
| KPI-LC-5: Live dogfood confirmation | Calling `list_concerns()` then feeding one of its results into `resolve_concern()` against this repo's own docs returns a real match — proving the two-tool chain actually works end-to-end, not just in isolation | Manual chained call via the MCP connection post-deploy |
