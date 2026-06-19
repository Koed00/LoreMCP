# Upstream Issues — heading-anchored-snippets

## Issue 1: Ancestor section always wins density comparison over its own descendants

**Found during**: Post-merge integration gate, live dogfood check (KPI-HAS-4), 2026-06-19.

**Original spec** (architecture-design.md, step 5): "If more than one section contains a match, return the section with the highest occurrence count of the concern string within that section's text... ties broken by selecting the first-occurring section in document order."

**Gap**: This rule does not account for nesting. A section's "text" (per step 2's boundary rule — section ends at the next heading of *equal-or-higher* level) includes all of its descendant subsections' text. For a typical nWave file shaped `# Title` followed by multiple `## D-xxx:` subsections (no second H1), the H1's section never terminates and spans the entire file — making its occurrence count the sum of every subsection's occurrences combined. The H1 section therefore wins the density comparison against any of its own children essentially always, returning a snippet barely narrower than the pre-feature whole-file behavior.

**Evidence**: Live dogfood query `resolve_concern(concern: "concern matching")` against this repo's own `docs/feature/concern-based-querying/design/wave-decisions.md` (a `# Title` + 5 `## D-CBQ-D{N}:` subsections file) returned a 7696-character snippet (the entire file, truncated only by the 8000-char cap) — not narrowed to the single subsection actually discussing concern matching strategy.

**New assumption**: When multiple matching sections exist and one is a structural ancestor of another (i.e., the candidate's heading line falls within the ancestor's line range), the **most specific (deepest, smallest-range) matching section wins**, regardless of occurrence count. Density-based tie-breaking (highest occurrence count, first-occurring on ties) applies only among matching sections that are NOT in an ancestor/descendant relationship with each other (siblings or unrelated sections).

**Rationale**: The entire premise of this feature is returning a *narrower* snippet than the whole file. An ancestor-always-wins outcome silently defeats that premise for the single most common nWave document shape (one H1 title, multiple H2/H3 decision blocks) — which includes this project's own `wave-decisions.md` and ADR files.

## Resolution

Added AC6 (regression scenario) to `heading-anchored-extraction.feature`: a file with one H1 title and 3 `##` subsections, concern appears in exactly one subsection — snippet must be scoped to that subsection, not the whole file. Function contract amended: candidate sections are first filtered to exclude any section that is a strict ancestor of another matching section, before density comparison runs.

This is an additive correction to the architecture-design.md contract (step 5), not a reversal of any DISCUSS/DESIGN product decision — the binding multi-section product decision ("most keyword-dense section wins," resolved with the user during DISCUSS) is preserved; this fix only refines its scope to siblings rather than ancestors/descendants.

## Clarification (post-adversarial-review, confirmed with user)

When an ancestor section has a genuine match in its OWN text (not merely inherited from a descendant's text), it remains a density-eligible candidate alongside its descendants — density comparison decides the winner in that case, same as any other sibling comparison. "Most specific always wins" only applies to the original bug case: an ancestor whose ENTIRE match count comes from nested descendants (zero own-text matches). This was confirmed against live dogfood evidence: `adr-005-concern-matching-strategy.md`'s H1 title literally contains "Concern Matching Strategy," so it legitimately competes by density against any nested subsection and correctly wins (returning the broader, still-relevant document), rather than being artificially excluded in favor of a more deeply nested section.

The escape-hatch code path (an ancestor retaining candidacy because of a genuine own-text match) was implemented but initially shipped without direct test coverage — added in the adversarial-review revision pass (Issue 2 below).

## Issue 2: Escape-hatch path untested

**Found during**: Adversarial review (DELIVER Phase 4), 2026-06-19.

**Gap**: `excludeStructuralAncestors`'s "own-text match" escape hatch (an ancestor stays candidate-eligible if its own text, excluding descendants, contains the concern) had no unit or acceptance test directly exercising it. Existing tests covered: (a) a pure ancestor with zero own-text matches (correctly excluded — the original bug fix), and (b) flat sibling density comparison. Neither covered an ancestor WITH a genuine own-text match competing against a descendant.

**Resolution**: Added a unit test in `tests/core/concern-matcher.test.ts` proving an ancestor with both a genuine own-text match and a higher-density count than its descendant is correctly retained and selected — confirming the escape hatch behaves as designed, not just by absence of a counter-example.
