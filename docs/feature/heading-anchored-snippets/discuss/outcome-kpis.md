# Outcome KPIs — heading-anchored-snippets

| KPI | Target | Measurement Method |
|---|---|---|
| KPI-HAS-1: Snippet size reduction on multi-section files | Median snippet length for matches in files >2000 chars drops by ≥50% vs. pre-feature baseline | Compare `snippet.length` across the same fixture corpus (this repo's own `docs/`) before/after the change, via the acceptance test fixtures |
| KPI-HAS-2: Zero regression on headingless files | 100% of headingless-file matches return identical snippet content to pre-feature behavior | Acceptance scenario 2 (headingless fallback) — exact-match assertion against pre-feature snapshot |
| KPI-HAS-3: Mutation kill rate on new extraction function | ≥80% (per-feature gate, consistent with project's mutation testing strategy) | `npm run test:mutation` scoped to `concern-matcher.ts` |
| KPI-HAS-4: Live dogfood confirmation | The exact "concern matching" query that motivated this feature returns a snippet scoped to the concern-matching-strategy section, not the full wave-decisions.md file | Manual re-run of `resolve_concern(concern: "concern matching")` via the MCP connection post-deploy, compared against the transcript that surfaced the original pain |
