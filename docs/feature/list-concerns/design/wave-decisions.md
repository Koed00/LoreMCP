# Wave Decisions Summary -- list-concerns (DESIGN)

## Key Decisions

- [D-LC-DESIGN-1] New pure function `collectConcernCandidates` (+ private helper
  `extractFirstHeadingText`) added to `src/core/concern-matcher.ts` -- NOT a new file.
  Reuses the existing private `detectHeadingLines`/`HEADING_PATTERN` heading-detection
  machinery already shipped for `heading-anchored-snippets`, unchanged. See
  `architecture-design.md`'s "Approach Decision" section for the 3 options considered
  (extend `concern-matcher.ts` / new file `concern-lister.ts` / extend
  `classify-structure.ts`) and why Option A (extend `concern-matcher.ts`) was chosen.
- [D-LC-DESIGN-2] `list_concerns()` registered as a 4th MCP tool in `src/shell/server.ts`,
  zero input schema, reusing the EXACT per-repo probe/scan loop pattern already proven by
  `resolve_concern`'s handler (same `loadConfig`/`reader.probe`/`buildTreeSnapshot`/
  skip-on-failure shape).
- [D-LC-DESIGN-3] New response type `ListConcernsResponse` and formatter
  `formatListConcernsResponse` added to `src/core/format-response.ts`. NO new
  `StructuredError` member -- per the binding DISCUSS decision, `list_concerns()` never
  returns an ERROR shape for the all-repos-structureless case; `concerns: []` +
  `searched_repos` populated is always a valid success response.
- [D-LC-DESIGN-4] No new ADR was needed. This feature does not introduce a genuine
  alternatives-with-trade-offs decision beyond what ADR-005 (per-repo keyword/heading-scan
  philosophy) and ADR-006 (regex-based heading detection, no markdown-AST library) already
  settled. The only design choice with real alternatives -- WHERE the aggregation function
  lives -- is recorded as an "Approach Decision" inside `architecture-design.md` rather than
  a standalone ADR, because it is a file-placement decision (module cohesion), not an
  architectural-style or technology decision in the sense ADR-005/ADR-006 were. (Per
  Critical Rule 3, every ADR needs 2+ alternatives with rejection rationale -- the
  Approach Decision section in architecture-design.md already provides exactly that;
  promoting it to a numbered ADR would duplicate content without adding decision weight,
  since it does not change any cross-cutting architectural rule, technology choice, or
  enforcement boundary.)
- [D-LC-DESIGN-5] Topic extraction sources are exactly the three named in DISCUSS: feature
  directory names (verbatim), ADR titles (first heading text, filename-fallback if
  headingless), and heading text within feature files (wave-decisions.md/feature-delta.md).
  `CLAUDE.md` is explicitly NOT a topic source (repo-conventions content, not a
  decision-topic source) -- confirmed against the binding DISCUSS framing, which lists only
  "feature directory names, ADR filenames/titles, and heading text within
  wave-decisions.md/ADR files."
- [D-LC-DESIGN-6] Dedup is exact-string-match (case-sensitive) across the FULL accumulated
  candidate list (all repos combined), applied once at the `list_concerns` handler call
  site in `server.ts` -- NOT inside `collectConcernCandidates` (which is per-repo and
  produces an unfiltered list; this mirrors the existing `matchConcernInSnapshot`
  per-repo / cross-repo-accumulation-in-shell precedent already established for
  `resolve_concern`).
- [D-LC-DESIGN-7] The 200-entry cap is applied to the DEDUPED list, preserving repo-config
  order then within-repo extraction order (feature dir names, then ADR titles, then
  feature-file heading text) -- matching the binding "first 200 in repo-config order"
  decision from DISCUSS exactly.
- [D-LC-DESIGN-8] README.md update is part of THIS feature's architecture deliverable
  (Changes Per File table, flagged explicitly) -- not deferred. The DELIVER-wave roadmap
  MUST include a README-update step alongside the code changes.

## Architecture Summary

`list_concerns()` is a 4th MCP tool, registered identically in shape to the existing 3
(`list_features`, `query_context`, `resolve_concern`), in the same modular-monolith,
functional-core/imperative-shell architecture established in brief.md Section 6 (unchanged
-- no new architectural style, no new component boundary, no new container in the C4
model). It adds:
- One new pure function (+ one small private helper) to the existing `src/core/
  concern-matcher.ts` module.
- One new response type + formatter to the existing `src/core/format-response.ts` module.
- One new tool registration + handler to the existing `src/shell/server.ts` module, reusing
  the existing `buildTreeSnapshot`/probe-loop/skip-warning shell machinery verbatim.
- One README.md documentation update (new tool entry + gap-closure revision).

No new container, no new component, no new external dependency, no new error taxonomy
entry, no new fs operation type. The C4 Component diagram (brief.md Section 5.3) is
UNCHANGED -- see "C4 Diagrams" below for why.

## Reuse Analysis

| Existing Component | Location | Reuse Potential | Disposition |
|---|---|---|---|
| `detectHeadingLines`, `HEADING_PATTERN` | `src/core/concern-matcher.ts` | HIGH -- exact heading-detection machinery needed for ADR-title and feature-file-heading-text extraction | Reused unchanged (private, called directly by the new sibling function in the same module) |
| `partitionIntoSections` | `src/core/concern-matcher.ts` | NOT NEEDED -- list_concerns extracts heading TEXT, not section boundaries/content; the simpler `detectHeadingLines` alone suffices | Not reused (no section-slicing required for topic-string extraction) |
| `buildTreeSnapshot`, `discoverFeatures`, `discoverAdrFiles`, `discoverClaudeMdPath` | `src/shell/server.ts` | HIGH -- identical per-repo directory/file enumeration `resolve_concern`'s handler already performs | Reused unchanged, called from the new `list_concerns` handler exactly as `resolve_concern`'s handler already calls them |
| Per-repo probe/scan loop (`reader.probe`, skip-on-failure, `searchedRepos`/`skipWarnings` accumulation) | `src/shell/server.ts` (`resolve_concern` handler) | HIGH -- identical repo-iteration shape, identical skip semantics (AC2/AC3) | Reused as a structural pattern (not a shared function -- each handler has its own loop body per existing convention in this file, consistent with how `list_features`/`query_context`/`resolve_concern` each have independent handler bodies today) |
| `classifyStructure`, `classifyRepoForListFeatures` | `src/core/classify-structure.ts` | NONE for this feature -- these classify a SPECIFIC repo+feature_id query outcome; list_concerns wants raw topic strings, not a classification outcome, and never touches file content (classify-structure.ts deliberately never reads bytes) | Not reused (see Approach Decision Option C rejection in architecture-design.md) |
| `capSnippetAtHeadingBoundary` (character-length truncation) | `src/core/concern-matcher.ts` | NONE -- list_concerns caps by ENTRY COUNT (200), not character length; unrelated truncation mechanism | Not reused; new, simple array-slice cap (`Array.prototype.slice(0, 200)`) inside the `list_concerns` handler, no helper function needed for a one-line operation |

## Technology Stack

No change. TypeScript 5.x, `@modelcontextprotocol/sdk`, `node:fs/promises`,
`dependency-cruiser`, `vitest`, `zod` -- all per brief.md Section 7, unchanged. Zero new
runtime dependency added by this feature (binding DISCUSS constraint satisfied: native
`Array`/`Set`/`String`/regex operations are the entire implementation).

## Constraints Established

- `collectConcernCandidates` and `extractFirstHeadingText` must remain pure (zero `node:fs`,
  `node:child_process`, `node:net` imports) -- enforced by the EXISTING `dependency-cruiser`
  rule (`npm run check:arch`); no new rule required, since both functions live inside the
  already-enforced `src/core/concern-matcher.ts`.
- `list_concerns()` MUST NOT introduce a new `StructuredError` shape -- the all-structureless
  case is a success response with `concerns: []`, never an error (binding, carried forward
  from DISCUSS, not re-litigated here).
- Dedup MUST be case-sensitive exact-string match (no fuzzy/normalized matching) -- keeps
  the implementation a single `Set` operation, consistent with the "simplest solution
  first" principle and the solo-maintainer cognitive budget already established by
  ADR-005/ADR-006.
- The 200-entry cap and its accompanying truncation warning string format are carried
  forward verbatim from the binding DISCUSS decision (D4) -- not re-decided here.

## Upstream Changes

None. No prior-wave artifact required revision. `brief.md` is extended (new tool contract
documented in Application Architecture / Section 8), not corrected -- no conflict was
found between this feature's design and any existing Decision 1-5 or ADR-001 through
ADR-006.

## C4 Diagrams

No update to the existing C4 Component diagram (brief.md Section 5.3) is warranted. The
addition does not introduce a new component -- `collectConcernCandidates` is a new
EXPORTED FUNCTION inside the already-diagrammed `concern-matcher.ts` component, and the new
tool registration is inside the already-diagrammed `server.ts` component. Per Section 5.3's
own threshold note ("crossing the threshold for an L3 diagram to show the new component"),
this feature crosses no new threshold: module COUNT in `src/core/` and `src/shell/` is
unchanged (3 core modules, 3 shell modules -- same as after `heading-anchored-snippets`).
The existing `concernmatcher` component description text in brief.md Section 5.3 is
extended with one clause (see brief.md diff) to mention `collectConcernCandidates`, the
same treatment `heading-anchored-snippets` gave `extractHeadingAnchoredSnippet` previously
-- a text annotation on an existing component box, not a new box or new relationship arrow.
