# ADR-006: Heading-Boundary Parsing Strategy for Snippet Extraction

## Status
Accepted (DESIGN wave, heading-anchored-snippets feature)

## Context

`resolve_concern` currently returns whole-file content (capped at 8000 characters,
heading-aligned truncation) as the `snippet` for every match, per ADR-003/ADR-005. Live
dogfooding surfaced a usability gap: a multi-section `wave-decisions.md` containing five
unrelated `## D-` decisions returns its entire content for a query about just one of them,
forcing the agent to scroll past unrelated material to judge relevance (US-HAS-01).

DISCUSS already resolved the product-level ambiguities and explicitly handed DESIGN a
narrower question: **how should the heading-boundary parsing itself be implemented?**
Binding decisions already made (not re-litigated here):
- Multi-section match: return the section with the highest keyword occurrence count.
- Headingless files: fall back unchanged to whole-file-up-to-cap (zero regression).
- Heading-boundary definition: nearest preceding heading to the next heading of
  equal-or-higher level.
- Keyword-in-heading-line counts as a match anchored at that heading.
- Oversized matched section: reuse the existing truncation-warning mechanism (ADR-003).

Constraints carried forward from ADR-005 and CLAUDE.md:
- Pure function in `src/core/concern-matcher.ts` — no fs, no network.
- Zero new runtime dependency (no markdown-AST library).
- Solo-maintainer cognitive budget — must be holdable in one person's head, consistent
  with the precedent already set by `detectRejectedPaths`' paragraph-splitting (regex +
  array indexing, no parser).

The decision is **how to detect heading lines and slice line ranges into sections**, not
*whether* to do heading-based extraction (DISCUSS already decided that).

## Decision

**Regex-based heading detection + line-array slicing.**

1. Split file content into lines (`content.split("\n")`).
2. Scan lines with a heading regex (`/^(#{1,6})\s+/`) capturing the heading level (number
   of `#` characters) and line index for every heading line.
3. Build a list of section boundaries: each heading line index, its level, and the line
   index where the section ends (the next heading line of level <= this heading's level,
   or end-of-file).
4. For a given match line index (the line containing the first case-insensitive
   occurrence of the concern keyword, OR the heading line itself if the concern appears
   in a heading), find the **nearest preceding heading** (the boundary search needed for
   the multi-section-density rule, below) and slice `lines[headingIndex..sectionEndIndex]`
   joined back with `"\n"`.
5. If the concern occurs in more than one section, compute occurrence count per
   section (case-insensitive substring count across that section's sliced text) and
   return the section with the highest count (ties broken by first-occurring section, for
   determinism).
6. If zero headings exist anywhere in the file, return `null` from the extraction
   function — the caller (`matchConcernInSnapshot`) falls back to the existing whole-file
   `capSnippetAtHeadingBoundary` path unchanged (zero regression, AC2/KPI-HAS-2).
7. Oversized section (>8000 chars): pass the sliced section text through the EXISTING
   `capSnippetAtHeadingBoundary` truncation helper — no new truncation logic, no new
   warning shape (AC5).

## Alternatives Considered

### A. Markdown-AST-lite line scanner (custom recursive-descent parser building a tree of
sections, then walking the tree to find the enclosing node)

- Pros: generalizes cleanly to nested heading levels; a tree structure makes "next
  heading of equal-or-higher level" a one-hop parent lookup rather than a linear rescan.
- Cons: meaningfully more code than flat regex + line-array slicing for a problem that is
  fundamentally one-dimensional (markdown headings are a flat outline by line position,
  not a real tree requiring traversal — "equal-or-higher level" is fully expressible as a
  single forward scan with a level comparison, no tree needed). Rough size estimate: flat
  regex scan + line-array slice is ~30-40 lines (boundary detection loop + one slice +
  one density-counting pass); a tree-based scanner needs node construction, parent-pointer
  or stack-based tree-building, and a traversal/lookup function to answer "next heading of
  equal-or-higher level" — estimated ~80-100 lines for equivalent behavior, roughly 2-3x
  the code for a problem expressible as a single linear scan. Adds an internal data
  structure (section tree) that must itself be tested for correctness independent of the
  extraction behavior — extra test surface with no behavioral benefit at this problem
  size. Diverges from the `detectRejectedPaths` precedent (flat regex split), introducing
  two different parsing styles in the same file for a solo maintainer to hold in their
  head.
- Rejected: complexity not justified by the problem shape; violates "simplest solution
  first" and the solo-maintainer cognitive-budget constraint with no corresponding
  correctness or testability gain — a flat line scan answers the same question with less
  code and fewer invariants to maintain.

### B. Full markdown-AST library (e.g., `remark`/`mdast`, `markdown-it` with heading
tokens)

- Pros: handles edge cases a hand-rolled regex might miss (headings inside fenced code
  blocks, headings inside HTML comments, ATX vs. Setext heading styles, front-matter).
- Cons: new runtime dependency — directly contradicts the binding constraint
  ("zero new dependency", DISCUSS wave-decisions.md, and the ADR-005 philosophy of "zero
  new runtime dependency... stays well within the solo-maintainer cognitive budget").
  nWave artifacts (`wave-decisions.md`, ADRs, `CLAUDE.md`) are hand-authored by convention
  using plain ATX headings (`##`) at the start of a line — the edge cases this library
  would solve (Setext headings, headings-in-code-fences) do not occur in the actual
  corpus this feature serves. Pulling in a parser to solve a problem the input format
  doesn't have is solving for theoretical generality the project doesn't need.
- Rejected: new dependency forbidden by binding constraint; no problem in the actual nWave
  corpus that the dependency would solve.

### C. Recommended: Regex-based heading detection + line-array slicing (chosen)

- Pros: zero new dependency (native string/array operations only, same toolset as
  `detectRejectedPaths`'s `split(/\n\n+/)`); the entire algorithm is a single forward
  pass building a flat array of `{lineIndex, level}` boundary markers, then a slice —
  testable exhaustively with table-driven fixtures (every AC in US-HAS-01 maps to one or
  two fixture files); consistent precedent with the existing paragraph-splitting function
  in the same module, so a future maintainer reading `concern-matcher.ts` sees one
  consistent parsing style (regex + array ops), not two; correctly implements the binding
  "equal-or-higher level" rule via a single integer comparison (`headingLevel <= matchedSectionLevel`)
  during the forward scan — no tree, no recursion needed.
- Cons: ATX-only (`#`-prefixed) heading detection — Setext-style headings
  (underline-style `===`/`---`) are not detected. Accepted: nWave convention and every
  example in user-stories.md/the Gherkin feature file use `##`-style ATX headings
  exclusively; Setext support would be solving for an input shape that does not occur in
  this corpus.
- Headings inside fenced code blocks (```` ``` ````) would be misdetected as real
  headings by a naive line-by-line regex scan. Accepted as a known limitation, NOT
  mitigated in this iteration: nWave `wave-decisions.md`/ADR/`CLAUDE.md` files use
  fenced code blocks for short configuration/command examples, not for content containing
  `#`-prefixed lines that could be mistaken for headings in practice (verified against
  this repo's own `docs/` corpus, which is the dogfood fixture per story-map.md). If this
  surfaces as a real false-positive in dogfooding, it is a candidate for a future
  iteration (track fenced-code-block state with a simple toggle on `` ``` `` lines — a
  small, isolated addition, not a reason to adopt a full parser now).

## Consequences

### Positive
- Zero new runtime dependency — `String.prototype.split`, regex `test`/`match`, and array
  indexing are the entire implementation, consistent with ADR-005's cost-of-cognition
  rationale.
- Pure-function testable: `extractHeadingAnchoredSnippet(content: string, concern: string): string | null`
  takes plain strings, returns a plain string or `null` — no fs, trivially table-driven
  in vitest, one fixture per AC (5 ACs -> 5+ test cases).
- Reuses the existing truncation mechanism unchanged (`capSnippetAtHeadingBoundary`) —
  no new warning shape, no new error taxonomy entry, satisfies AC5 with zero new code in
  `format-response.ts`.
- Headingless fallback is structural, not a special case bolted on: the function simply
  returns `null` when its internal boundary list is empty, and the existing call site
  decides what to do with `null` — the two code paths (heading-anchored vs whole-file) are
  cleanly separated, satisfying AC2/KPI-HAS-2 by construction rather than by a defensive
  check.

### Negative
- Fenced-code-block false-positive risk (see Alternative C cons) — accepted, monitored via
  dogfooding (KPI-HAS-4), not mitigated preemptively.
- Setext headings unsupported — accepted, not used by nWave convention.
- Multi-section density resolution requires a full second pass (count occurrences per
  candidate section) when more than one section matches — O(sections) extra work, but
  nWave files are small/curated (ADR-003's foundational premise), so this is not a
  performance concern at this scale.

## Enforcement

`extractHeadingAnchoredSnippet` lives in `src/core/concern-matcher.ts` alongside the
existing pure functions. Same `dependency-cruiser` rule already enforces zero `node:fs`/
`node:child_process`/`node:net` imports for the whole `src/core/**` tree — no new rule
required, consistent with ADR-005's enforcement section.
