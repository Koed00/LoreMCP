# DESIGN Decisions -- heading-anchored-snippets

## Key Decisions

- [D1] Heading-boundary parsing approach: **regex-based heading detection + line-array
  slicing** (no markdown-AST library, no custom AST tree). Chosen over a markdown-AST-lite
  line scanner and a full markdown-AST library (`remark`/`markdown-it`). See
  `adr-006-heading-boundary-parsing-strategy.md` for full alternatives analysis.
- [D2] New pure function `extractHeadingAnchoredSnippet(content, concern): string | null`
  added to `src/core/concern-matcher.ts`. Returns `null` for headingless files, which
  signals the existing call sites to fall back to the unchanged whole-file truncation
  path -- zero regression by construction, not by defensive special-casing.
- [D3] Multi-section density resolution (highest occurrence count wins, ties broken by
  first-occurring section) implemented as a second pass over candidate sections only when
  more than one section matches -- accepted O(sections) cost given nWave files are small
  by convention (ADR-003 premise).
- [D4] No new types, no new error shape, no new warning shape. `ConcernMatch.snippet`'s
  field type (`string`) is unchanged; only its *content* narrows for multi-section files.
  The existing `capSnippetAtHeadingBoundary` truncation helper is reused unchanged for
  oversized matched sections (AC5) -- no second truncation mechanism introduced.
- [D5] `detectRejectedPaths` is explicitly NOT modified -- it continues operating on full
  file content, decoupled from the new heading-anchored match-snippet extraction. A
  rejection paragraph and the matched concern section can legitimately live in different
  parts of the same file.

## Architecture Summary

Surgical, single-function extension to the already-shipped `concern-based-querying`
pipeline. No new MCP tool, no new container, no new component in the C4 topology, no
walking skeleton (per story-map.md, confirmed N/A). The modular monolith / functional-core
architecture established in brief.md Section 6 is unchanged -- the new function lives
inside the existing `src/core/concern-matcher.ts` module, inside the already-enforced
`dependency-cruiser` core boundary (zero fs/network imports).

The three snippet-building call sites inside `matchConcernInSnapshot` (feature files, ADR
files, CLAUDE.md) each gain one line: attempt heading-anchored extraction first, fall back
to the existing whole-file path on `null`. See
`docs/feature/heading-anchored-snippets/design/architecture-design.md` for the exact
function contract and call-site diff description.

## Reuse Analysis

| Existing Component | Location | Reuse Potential | Disposition |
|---|---|---|---|
| `detectRejectedPaths` (paragraph-splitting via `content.split(/\n\n+/)`) | `src/core/concern-matcher.ts` | HIGH -- direct precedent for the new function's parsing style (regex + array split, no library) | Reused as a STYLE precedent, not as a shared helper -- paragraph-splitting and heading-splitting are different boundary rules (blank-line vs. heading-level), so no code is extracted into a shared utility. Kept separate per existing module convention (each detection function owns its own boundary logic). |
| `capSnippetAtHeadingBoundary` (existing truncation-at-heading helper) | `src/core/concern-matcher.ts` | HIGH -- directly reused, unchanged | REUSED AS-IS. The new function's output is piped through this existing helper when oversized (AC5) -- zero new truncation logic, zero new warning shape. |
| `matchConcernInSnapshot`'s three snippet-building blocks | `src/core/concern-matcher.ts` | HIGH -- call sites modified, not replaced | EXTENDED. One new line per block (call new function, fall back on `null`); surrounding match/relevance/rejection logic untouched. |
| `ConcernMatch` type, `ResolveConcernResponse`, all formatters | `src/core/format-response.ts` | HIGH -- zero change needed | REUSED AS-IS. Snippet field type unchanged; only runtime content narrows. |
| `src/shell/server.ts` resolve_concern handler | `src/shell/server.ts` | HIGH -- zero change needed | REUSED AS-IS. Handler already passes whole-file content into the core function that now does the narrowing internally. |
| Markdown-AST library (`remark`, `markdown-it`) | N/A (not in codebase) | LOW for this feature | REJECTED -- new dependency forbidden by binding DISCUSS constraint; ADR-006 documents rationale. |

## Technology Stack

No additions. Same stack as brief.md Section 7 (TypeScript, native string/array/regex
operations, `vitest`, `dependency-cruiser`). ADR-006 explicitly evaluated and rejected a
markdown-AST library to keep the stack unchanged.

## Constraints Established

- `extractHeadingAnchoredSnippet` MUST remain a pure function: `(content: string, concern: string) => string | null`. No fs, no network, no mutation of inputs.
- MUST return `null` (not throw, not return empty string) for files with zero ATX headings -- this is the explicit fallback signal contract, not an error condition.
- MUST NOT perform its own truncation -- truncation/size-capping responsibility stays exclusively with the existing `capSnippetAtHeadingBoundary` helper (single source of truth for the 8000-char cap and its warning message format).
- MUST NOT alter `detectRejectedPaths` behavior or its independent pass over full file content.
- MUST NOT introduce a new npm dependency (binding DISCUSS constraint, reaffirmed in ADR-006).

## Upstream Changes

- `docs/product/architecture/brief.md` Section 4 Decision 4: added an UPDATE note
  clarifying that the original "whole-file return" recommendation for `query_context`
  remains correct and unchanged; the heading-anchored refinement applies ONLY to
  `resolve_concern`'s `ConcernMatch.snippet`, governed by the new ADR-006, not a reversal
  of Decision 4.
- `docs/product/architecture/brief.md` Section 5.3 (C4 Component diagram): `concern-matcher.ts`
  component description text extended to mention `extractHeadingAnchoredSnippet`. No new
  component box, no new relationship arrow -- topology unchanged.
- `docs/product/architecture/brief.md` Section 10 (ADR Index): added
  `adr-006-heading-boundary-parsing-strategy.md`.
- `docs/product/architecture/brief.md` Section 11 (Quality Gate Self-Check): updated to
  reference this feature's traceability and confirm no new probe/dependency/enforcement
  requirements were introduced.
