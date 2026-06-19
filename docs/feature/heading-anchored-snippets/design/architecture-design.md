# Architecture Design -- heading-anchored-snippets

## Feature: Heading-anchored snippet narrowing inside `resolve_concern`

This document is the primary handoff artifact for the software-crafter (DELIVER wave).
It lists every file to touch, what changes, and the new pure-function contract — without
specifying internal implementation. See `adr-006-heading-boundary-parsing-strategy.md`
for the rejected alternatives and rationale behind the chosen parsing approach.

This is a surgical extension to an already-shipped, already-green pipeline
(`concern-based-querying`). No walking skeleton, no new tool, no new error shape, no new
response field. Exactly one new pure function and one call-site change.

---

## Changes Per File

| File | Change type | What changes |
|------|-------------|--------------|
| `src/core/concern-matcher.ts` | **Extend** | Add new pure function `extractHeadingAnchoredSnippet`. Modify the three snippet-building call sites inside `matchConcernInSnapshot` (feature files, ADR files, CLAUDE.md) to call the new function first and fall back to the existing `capSnippetAtHeadingBoundary(file.content, ...)` path when it returns `null`. No change to `validateConcern`, `detectRejectedPaths`, or any exported type signature. |
| `src/core/format-response.ts` | **No change** | `ConcernMatch.snippet` remains `string` — its *content* now may be a narrower section instead of whole-file content, but the field's type and the response shape are unchanged. No new formatter, no new error, no new warning shape (truncation warnings reuse the existing `truncationWarnings` mechanism unchanged). |
| `src/shell/server.ts` | **No change** | The `resolve_concern` handler already passes whole-file content into `matchConcernInSnapshot`; the new extraction happens entirely inside the core function it already calls. No handler-logic change. |
| `src/shell/fs-doc-tree-reader.ts` | **No change** | No new fs operations — extraction operates on content already read into memory by the existing handler. |
| `src/core/classify-structure.ts` | **No change** | Unrelated to snippet content; structural classification is untouched. |

---

## New Function: `extractHeadingAnchoredSnippet` (in `src/core/concern-matcher.ts`)

### Responsibility

Given a file's full content and the concern keyword, return the heading-anchored section
containing the highest-density match, or `null` if the file has no markdown headings at
all (signaling the caller to fall back to existing whole-file behavior).

### Contract

```
extractHeadingAnchoredSnippet(content: string, concern: string): string | null
```

**Inputs**: `content` — full file text (already read from disk by the shell, unchanged
from today). `concern` — the validated, non-empty concern string (same value already
passed into `matchConcernInSnapshot`).

**Behavior** (binding rules from US-HAS-01 / journey-snippet-extraction.feature; the
*how* is the crafter's implementation choice, constrained only by ADR-006's chosen
approach — regex heading detection + line-array slicing, no markdown-AST library):

1. Detect all markdown heading lines in `content` (ATX style, `^#{1,6}\s`). If none
   exist, return `null` immediately (AC2 — headingless fallback; the caller must then use
   the existing `capSnippetAtHeadingBoundary(content, SNIPPET_MAX_CHARS)` path
   unchanged).
2. Partition `content` into sections, each spanning from one heading line to the next
   heading line of **equal-or-higher** level (fewer or equal `#` characters), or to
   end-of-file for the last section.
3. A section "contains a match" if the concern string (case-insensitive substring)
   appears anywhere in that section's text, INCLUDING the heading line itself (AC3 — a
   concern matching only the heading line still anchors the section starting at that
   heading).
4. If exactly one section contains a match, return that section's full text (AC1).
5. If more than one section contains a match, return the section with the **highest
   occurrence count** of the concern string within that section's text (case-insensitive,
   counting all occurrences, not just presence) — ties broken by selecting the
   first-occurring section in document order, for determinism (AC4).
6. If zero sections contain a match (should not normally occur, since this function is
   only called for files already confirmed to match by `matchConcernInSnapshot`'s
   existing top-level check — defensive only), return `null` and let the caller fall back
   to whole-file behavior.
7. Does NOT perform truncation/size-capping itself. Returns the raw matched section text
   regardless of length. The caller is responsible for passing the result through the
   EXISTING `capSnippetAtHeadingBoundary` helper if it exceeds `SNIPPET_MAX_CHARS` (AC5 —
   reuses the existing truncation-warning mechanism, no new warning shape).
8. Pure. No side effects, no fs access, no new dependency.

### Call-site change inside `matchConcernInSnapshot`

For each of the three snippet-building blocks (feature files, ADR files, CLAUDE.md), the
existing line:

```
const { snippet, truncated } = capSnippetAtHeadingBoundary(file.content, SNIPPET_MAX_CHARS);
```

becomes (conceptually — crafter owns exact structuring):

```
const headingAnchored = extractHeadingAnchoredSnippet(file.content, concern);
const sourceText = headingAnchored ?? file.content;
const { snippet, truncated } = capSnippetAtHeadingBoundary(sourceText, SNIPPET_MAX_CHARS);
```

This means:
- Headingless files: `headingAnchored` is `null`, `sourceText` falls back to
  `file.content` — IDENTICAL behavior to today (AC2/KPI-HAS-2, exact byte-for-byte
  regression safety since the fallback path is untouched).
- Multi-section files: `headingAnchored` is the narrowed section text, which is then
  passed through the SAME truncation helper used today — if the section itself exceeds
  the cap, the existing truncation + warning logic fires unchanged (AC5).
- The `truncationWarnings` array, `ConcernMatch.snippet` field, and all downstream
  formatting in `format-response.ts` are untouched — this function only changes what
  string is handed to the existing truncation step, nothing about the shapes around it.

`detectRejectedPaths` is NOT changed — it continues to operate on `file.content` (the
full file), independent of the heading-anchored match snippet. Rejected-path detection
and match-snippet extraction are deliberately decoupled (a rejection paragraph may live
in a different section than the matched concern section).

---

## Test Fixture Guidance (for DISTILL / acceptance-designer)

| Fixture | Contents | Exercises |
|---------|----------|-----------|
| `multi-section-single-match` | `wave-decisions.md` with 3+ `## ` sections, concern word appears in exactly one | AC1, UAT scenario 1 |
| `headingless-claude-md` | `CLAUDE.md` with no `#` lines, contains concern word in prose | AC2, UAT scenario 2, KPI-HAS-2 |
| `heading-line-match` | `wave-decisions.md` with `## D-auth: JWT strategy` where concern word appears only in the heading text, not the body | AC3, UAT scenario 3 |
| `multi-section-density` | `wave-decisions.md` where concern appears 3x in one section and 1x in another | AC4, UAT scenario 4 |
| `oversized-section` | `wave-decisions.md` with one section >8000 chars containing the concern | AC5, UAT scenario 5 |

All fixtures should additionally be runnable against this repo's own `docs/` as a live
dogfood check (KPI-HAS-4) — re-run `resolve_concern(concern: "concern matching")` post-
implementation and confirm the snippet is scoped to ADR-005's matching-strategy section,
not the full `wave-decisions.md`.

---

## Earned Trust: Probe Contract Extension

No new substrate dependency is introduced. `extractHeadingAnchoredSnippet` is a pure
string-in/string-out function operating on content already read by the existing,
already-probed `DocTreeReader`. The existing `DocTreeReader.probe()` contract
(brief.md Section 9) and its behavioral gold tests are unaffected — no new fault-injection
scenarios apply. The "probe" for this function is its own unit test suite (table-driven,
one case per AC above); the existing meta-test (`probe-contract.test.ts`) requires no
changes since no new adapter is introduced.

---

## Architecture Enforcement

Style: Modular monolith, functional core / imperative shell (unchanged from brief.md
Section 6).
Language: TypeScript.
Tool: `dependency-cruiser` (existing, no new rule).

Rules enforced (unchanged, already cover this addition):
- `src/core/**` has zero imports from `node:fs`, `node:fs/promises`, `node:child_process`,
  `node:net`, or `src/shell/**`. `extractHeadingAnchoredSnippet` lives in
  `src/core/concern-matcher.ts`, already inside the enforced boundary.
