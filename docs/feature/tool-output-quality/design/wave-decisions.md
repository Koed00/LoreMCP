# Wave Decisions Summary -- tool-output-quality (DESIGN)

## Mode
Propose -- all decisions below presented with alternatives/trade-offs for the
stakeholder; this is a regression-recovery round (4 independent defect fixes), not a
new feature, so the bulk of DESIGN work is "where does the fix live, and is there a
genuine architecture-level alternatives decision" rather than new technology/pattern
selection.

## Multi-Architect Context
Single architect (Morgan) -- no prior System Architecture (Titan) or Domain Model
(Hera) sections exist in `docs/product/architecture/brief.md` for this product; brief.md
already has an `## Application Architecture` section from this feature's own prior
authorship (across `ab-mcp`, `concern-based-querying`, `heading-anchored-snippets`,
`list-concerns`). This DESIGN wave extends Section 9 (Earned Trust) note only where a
new probe-relevant fact appears (slice 03's new fs read) -- see D-TOQ-DESIGN-6 below.

## Slice 01 -- query_context total-response cap

- **D-TOQ-DESIGN-1**: Total-response truncation is a NEW pure function
  (`capResultsToTotalBudget`) in `src/core/format-response.ts`, operating on the already
  -ordered `QueryContextResultItem[]` array, dropping whole oldest results until the
  cumulative `snippet.length` of the kept (most-recent-first) subset fits within a new
  `TOTAL_RESPONSE_MAX_CHARS = 24000` budget. It does NOT reuse or extend
  `capSnippetAtHeadingBoundary` (the existing per-file truncation helper in
  `concern-matcher.ts`) -- recorded as **ADR-007** (genuine alternatives-with-trade-offs
  decision; see rationale there for why the superficially-similar "Reference Class" note
  in `slice-01-query-context-cap.md` does not transfer cleanly to this problem shape).
- **D-TOQ-DESIGN-2**: `TOTAL_RESPONSE_MAX_CHARS` is set to 24000 (3x the existing
  per-file `SNIPPET_MAX_CHARS` of 8000) -- a starting default, not a config option,
  consistent with `SNIPPET_MAX_CHARS` having no config knob today. This value also
  establishes an invariant noted in ADR-007's Consequences: any single result's
  `snippet.length` is already bounded well below this total budget by the existing
  per-file cap, so the "single oversized result alone exceeds the total budget" edge
  case cannot occur given current constant values.

## Slice 02 -- list_concerns heading-text stoplist

- **D-TOQ-DESIGN-3**: New constant `GENERIC_HEADING_STOPLIST` + new private function
  `isGenericHeading` added to `src/core/concern-matcher.ts`, following the EXISTING
  `REJECTION_KEYWORDS`/`containsRejectionKeyword` pattern as a structural precedent (not
  literal reuse -- different domain, different matching semantics: case-insensitive
  EXACT match against a heading string, not substring-anywhere-in-paragraph). Applied
  only inside `collectFeatureFileHeadingCandidates`, never touching
  `collectAdrCandidates` or the `featureDirectoryNames` passthrough, per binding D5.
- No ADR needed for this slice: this is a module-internal filter-list addition
  following an already-established pattern in the same file, not a new
  architectural-style/technology/enforcement-boundary decision. Same precedent as
  `list-concerns`'s D-LC-DESIGN-4 (no ADR for `collectConcernCandidates`'s module
  placement).

## Slice 03 -- list_features deliver-phase detection

- **D-TOQ-DESIGN-4**: Deliver-phase detection logic lives in the SHELL
  (`discoverFeatures` in `src/shell/server.ts`), extending its existing per-phase
  -directory loop with a `deliver`-specific branch that reads and parses
  `execution-log.json` -- NOT in `src/core/classify-structure.ts`, because
  `execution-log.json` is a NEW fs read and `src/core/**` is forbidden from importing
  `node:fs` (CLAUDE.md, brief.md Section 6, enforced via `dependency-cruiser`).
  `classifyRepoForListFeatures` (core) continues to consume `snapshot.features` as an
  opaque `Record<string, string[]>` with no awareness of how each phase string was
  derived -- zero change needed there.
- **D-TOQ-DESIGN-5**: Malformed/unparseable `execution-log.json` (invalid JSON, missing
  `events` field) is treated as "deliver phase not detected" -- fail-closed, no new
  error/warning surfaced, consistent with this codebase's existing skip-on-failure
  philosophy for unreadable/malformed files (e.g. `resolve_concern`'s TOCTOU handling).
  This is a CONTENT-validity concern (the filesystem returned exactly the bytes on
  disk; they're just not valid JSON), not a substrate-honesty concern requiring a new
  probe-contract gold test -- see D-TOQ-DESIGN-6.
- **D-TOQ-DESIGN-6 (Earned Trust)**: No new fault-injection scenario added to brief.md
  Section 9 -- `execution-log.json` is read via the SAME already-probed `reader.readFile`
  path every other file in this codebase uses; the 4 existing gold-tested fault
  scenarios (not-found, not-a-directory, permission-denied, TOCTOU) already cover this
  new read. The one new failure mode specific to this file (malformed JSON content) is
  a content-validity concern handled by ordinary table-driven unit tests on
  `discoverFeatures`'s new branch, not a new probe-contract scenario.
- No ADR needed for this slice: "where does a new fs-reading branch live, core or
  shell" is already answered definitively by the existing, binding functional-core/
  imperative-shell rule (CLAUDE.md) -- there is no genuine alternative to evaluate
  (putting it in core would violate an already-enforced architectural rule, not present
  a legitimate trade-off).

## Slice 04 -- resolve_concern's CONCERN_NOT_FOUND nudge

- **D-TOQ-DESIGN-7**: Single string-literal edit to `formatConcernNotFound`'s `message`
  template in `src/core/format-response.ts` -- no new parameter, no signature change, no
  conditional logic (binding D7: unconditional nudge, no check for whether
  `list_concerns()` would itself return empty).
- No ADR needed: a message-text edit with no structural alternative to evaluate.

## C4 Diagrams
No changes. Confirmed explicitly (not silently skipped) -- all 4 slices modify existing
pure functions inside already-documented components or extend an already-documented
shell function; no new component, no new tool, no new external dependency, no new
relationship arrow. `docs/product/architecture/brief.md` Sections 5.2/5.3 remain
accurate as-is.

## brief.md Updates
Two narrow additions to `docs/product/architecture/brief.md`'s `## Application
Architecture` Section 8 (Integration Patterns) are made, since slices 01 and 03 change
documented response-contract semantics (the `query_context`/`list_features` SHAPES
themselves are unchanged; the SEMANTICS of when truncation/deliver-detection occurs is
new and load-bearing for any future architect or crafter reading the contract):
1. `query_context`'s response contract note gains a sentence documenting the new
   total-response cap and its warning text pattern (ADR-007).
2. `list_features`'s `phases` semantics note gains a sentence documenting that
   `"deliver"` requires `execution-log.json` with >=1 COMMIT-phase entry, not mere
   directory existence (D6/ADR not needed, but the SEMANTIC CHANGE to an already
   -documented contract field warrants a brief.md update so the contract description
   stays accurate).
No other Section needs updating -- Sections 1-7, 9-11 are unaffected (no new component,
no new tech choice, no new probe scenario per D-TOQ-DESIGN-6, no ADR-index change beyond
adding ADR-007).

## ADR Index Update
Added: `adr-007-total-response-truncation-strategy.md` -- result-array-level truncation
for `query_context`'s total-response cap (slice 01).
No other new ADR -- slices 02, 03, 04 are each a single-file pattern-following extension
or a string edit with no genuine architecture-level alternative to record (see each
slice's "No ADR needed" rationale above).
