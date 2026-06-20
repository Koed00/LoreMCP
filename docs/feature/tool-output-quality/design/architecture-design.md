# Architecture Design -- tool-output-quality

## Feature: 4 independent defect fixes to already-shipped MCP tools

This document is the primary handoff artifact for the software-crafter (DELIVER wave).
It lists every file to touch, what changes, and the new/modified pure-function contracts
-- without specifying internal implementation. This is a regression-recovery round
(4 defects found via live dogfooding immediately after `list-concerns` shipped), not a
new feature -- no new tool, no new component, no topology change.

No walking skeleton (per story-map.md). No new npm dependency (binding DISCUSS constraint).
All 4 slices are independent and individually shippable.

---

## Slice 01: `query_context` total-response size cap

### Reuse Analysis

| Existing Component | File | Overlap | Decision | Justification |
|---|---|---|---|---|
| `capSnippetAtHeadingBoundary` | `src/core/concern-matcher.ts` | Truncation-with-warning philosophy is identical (cap a string, report truncation) | **REJECTED, not reused — new function** | Solves a different problem: it finds a cut-point WITHIN one string, with no concept of "this content came from N independently-ordered files." Re-splitting a truncated concatenated blob back into discrete `{sourceFile, phase, snippet}` results requires new byte-offset bookkeeping comparable in cost to writing a new function outright. Worse, concatenate-then-truncate risks cutting mid-file and orphaning a smaller, more-recent file that would otherwise fit — directly undermining AC3 ("most recent wave's content is preserved"). See "Approach Decision" below and ADR-007 for the full alternatives analysis. |
| `formatQueryContextResponse` | `src/core/format-response.ts` | Already shapes the response this cap must apply to | **Extend** — new `capResultsToTotalBudget` function is called from within/alongside this formatter, not a separate parallel path | Keeps response-shaping logic in its established home file, consistent with every prior feature's "format-response.ts owns response shape" precedent |

### Approach Decision: Truncation Mechanism

Two concrete options exist for HOW the total-response cap truncates an oversized
`query_context` response.

#### Option A: Reuse `capSnippetAtHeadingBoundary` on the concatenated-then-truncated total string

Concatenate all result snippets into one string, run the EXISTING
`capSnippetAtHeadingBoundary(content, maxChars)` helper (already used per-file in
`concern-matcher.ts`) against the concatenated total, then re-split back into per-file
results.

- **Pros**: reuses an already-tested helper verbatim; zero new truncation logic.
- **Cons**: `capSnippetAtHeadingBoundary` truncates at the LAST heading boundary
  BEFORE the cap, which is a single-string concept — it has no notion of "this content
  came from N independent files in oldest-to-newest order." Re-splitting a single
  truncated string back into discrete `{sourceFile, phase, snippet}` results requires
  tracking byte offsets per original file, which is new bookkeping logic not present in
  the helper today. Concatenating heterogeneous files (different phases, ADRs,
  CLAUDE.md) into one string before truncating also risks truncating MID-FILE in a way
  that orphans a later, smaller, more-recent file even though it would fit if processed
  independently — directly working against AC3 ("most recent wave's content is
  preserved"). This option optimizes for code reuse at the cost of correctness for the
  AC that matters most.

#### Option B (RECOMMENDED): Truncate at the file/result-array level by dropping oldest entries until under budget

`classified.filesToRead` (and the corresponding `fileContents` map) is already ordered
oldest-to-newest within a feature's phases (per `classify-structure.ts`'s
`featurePhaseFilesToRead`, which iterates `snapshot.features[featureId]` phase
directories in their existing order, followed by ADRs, followed by CLAUDE.md). Compute
each result's `snippet.length`, sum cumulatively from the END of the array (most recent
first) until adding the next (older) result would exceed the cap, then drop everything
before that point. No new file-content truncation logic — each kept result's snippet is
already capped per-file by the EXISTING per-file truncation (Decision 4 in brief.md,
unchanged). This is a NEW, separate truncation pass operating on the RESULT ARRAY, not
on any single string.

- **Pros**: operates on the natural unit the AC is written in terms of ("oldest wave
  content," "most recent wave's content preserved") — phase/file granularity, not
  byte-offset-in-a-blob granularity. Zero ambiguity about where a cut lands relative to
  file boundaries (a dropped file is dropped WHOLE, never mid-content). Trivially
  testable with table-driven fixtures (N results of known sizes, assert which subset
  survives). Composes cleanly with the EXISTING per-file cap (Decision 4) — that cap
  already ran during file content collection; this is a second, independent,
  array-level pass with a different unit (total chars across results, not chars within
  one file).
- **Cons**: does not literally reuse `capSnippetAtHeadingBoundary`'s code — but this is
  the correct outcome, since that helper solves a different problem (where to cut
  WITHIN one string) than this one (which whole results to keep). Forcing reuse here
  would be cargo-culting a precedent past its applicability boundary.

**DECISION: Option B.** Truncate at the file/result-array level, dropping oldest results
first, until the cumulative `snippet.length` of kept results is within the cap. This is
recorded as **ADR-007** (see below) because it is a genuine architecture-level
alternatives-with-trade-offs decision: it determines where total-response truncation
logic lives (a new pure function in `format-response.ts`, operating on already-built
`QueryContextResultItem[]`) and explicitly does NOT extend `concern-matcher.ts`'s
existing per-file truncation helper, despite the surface-level similarity the
slice's "Reference Class" note in `slice-01-query-context-cap.md` invites. Future
maintainers reading that note without this ADR could reasonably reach for Option A;
the ADR exists to prevent that regression.

**Total response cap constant**: reuse the same `8000`-character philosophy as the
existing per-file `SNIPPET_MAX_CHARS` but scaled for a MULTI-result response — recommend
a separate constant, `TOTAL_RESPONSE_MAX_CHARS = 24000` (3x the per-file cap, generous
enough that a single normal-sized feature with 1-3 phases is never affected, matching
Domain Example 2's "identical to today" requirement), defined in `format-response.ts`
next to where the new truncation function lives. This is a starting default, not a
config option (consistent with `SNIPPET_MAX_CHARS` having no config knob today).

### Changes Per File

| File | Change type | What changes |
|------|-------------|---------------|
| `src/core/format-response.ts` | **Extend** | Add new private constant `TOTAL_RESPONSE_MAX_CHARS = 24000`. Add new private pure function `capResultsToTotalBudget(results: QueryContextResultItem[]): { results: QueryContextResultItem[]; truncated: boolean }` — sums `snippet.length` across `results` from the END of the array backward (most recent first, since `filesToRead`/`results` is built oldest-to-newest per `classify-structure.ts`), keeps the maximal suffix of the array whose cumulative length is `<= TOTAL_RESPONSE_MAX_CHARS`, and reports whether any results were dropped. `buildQueryContextResults` (existing, in this same file) is extended to call this new function AFTER assembling `results` from `classified.filesToRead`; if `truncated` is true, `formatQueryContextResponse` adds a new warning string (e.g. `"Response truncated to stay within the total size limit; oldest wave content dropped. {N} of {M} results omitted."`) to its existing `warnings` array. No existing exported function signature changes — `formatQueryContextResponse`'s public signature is unchanged. |
| `src/core/concern-matcher.ts` | **No change** | `capSnippetAtHeadingBoundary` remains exactly as-is, used only for ITS existing per-file/per-snippet callers (`matchConcernInSnapshot`, `detectRejectedPaths`). Confirmed NOT reused for this slice — see Approach Decision above. |
| `src/core/classify-structure.ts` | **No change** | `classified.filesToRead` ordering (oldest-to-newest within a feature, ADRs, then CLAUDE.md) is the precondition this slice depends on — already correct, unchanged. |
| `src/shell/server.ts` | **No change** | `query_context`'s handler already calls `formatQueryContextResponse` with the full `fileContents` map; the new total-budget truncation happens entirely inside `format-response.ts`, transparent to the shell. |

### New/Modified Function Contracts

```
capResultsToTotalBudget(
  results: QueryContextResultItem[],
): { results: QueryContextResultItem[]; truncated: boolean }
```

**Responsibility**: given the full ordered list of `query_context` results (oldest wave
first, per `classify-structure.ts`'s existing build order), return the largest trailing
(most-recent-first) subset whose summed `snippet.length` does not exceed
`TOTAL_RESPONSE_MAX_CHARS`, plus whether any results were dropped.

**Behavior** (binding rules from US-TOQ-01's 3 ACs; the *how* is the crafter's
implementation choice):
1. If the sum of all `results[i].snippet.length` is already `<= TOTAL_RESPONSE_MAX_CHARS`,
   return `{ results, truncated: false }` unchanged (AC2 — zero regression for
   normal-sized features).
2. Otherwise, walk `results` from the LAST entry backward, accumulating
   `snippet.length`, and keep every entry that fits within the budget when summed from
   the end; the first (oldest) entries that would push the cumulative sum over budget
   are dropped entirely (AC1, AC3 — oldest dropped first, most recent preserved).
3. A result is kept or dropped as a WHOLE unit — no result's `snippet` is itself
   re-truncated by this function (that already happened upstream, per-file, via the
   existing Decision 4 mechanism).
4. Pure. No side effects, no fs access, no new dependency.

**Caller change** (`formatQueryContextResponse`, existing function in
`format-response.ts`): after `buildQueryContextResults` produces `results`, pass them
through `capResultsToTotalBudget`; if `truncated`, append the truncation warning string
to the existing `warnings` array (composed with `classified.warnings` and
`toctouWarnings`, same as today).

---

## Slice 02: `list_concerns` heading-text stoplist

### Reuse Analysis

| Existing Component | Location | Reuse Potential | Disposition |
|---|---|---|---|
| `REJECTION_KEYWORDS` constant + `containsRejectionKeyword` | `src/core/concern-matcher.ts` | Direct structural precedent — a `string[]` constant + a function checking case-insensitive substring/exact membership | REUSE THE PATTERN (new sibling constant `GENERIC_HEADING_STOPLIST` + new sibling function `isGenericHeading`), not the same constant or function — different domain (heading text vs. rejection-paragraph keywords), different matching semantics (exact/near-exact heading match, not substring-anywhere-in-paragraph) |
| `collectFeatureFileHeadingCandidates` | `src/core/concern-matcher.ts` | This is the ONLY function that needs the new filter applied — it is explicitly the sole source of heading-text candidates (binding D5) | EXTEND — filter applied at this function's return point, never touching `collectAdrCandidates` or the caller's `featureDirectoryNames` passthrough |

### Changes Per File

| File | Change type | What changes |
|------|-------------|---------------|
| `src/core/concern-matcher.ts` | **Extend** | Add new private constant `GENERIC_HEADING_STOPLIST: string[]` (case-insensitive exact-match list covering the generic headers named in DISCUSS/slice-02: "Decisions", "Summary", "Key Decisions", "Mode", "Constraints Established", "Upstream Changes", plus other convention-driven boilerplate headers observed across this repo's own `wave-decisions.md` files, e.g. "Requirements Summary", "Domain Examples", "Acceptance Criteria" — exact list to be finalized by software-crafter against the live dogfood baseline per KPI-TOQ-2, but must be case-insensitive EXACT match, not substring, to avoid accidentally suppressing a genuine heading that merely CONTAINS a stoplist word, e.g. "D-auth: JWT strategy" must survive even if "strategy"-adjacent words appear on the stoplist). Add new private function `isGenericHeading(headingText: string): boolean` (case-insensitive exact match against `GENERIC_HEADING_STOPLIST`, trimmed). `collectFeatureFileHeadingCandidates` is extended to filter OUT any heading where `isGenericHeading(candidate)` is true, BEFORE returning. No change to `collectAdrCandidates` (ADR titles never touched, per binding D5) and no change to how `featureDirectoryNames` flow through `collectConcernCandidates` (directory names never touched, per binding D5). |
| `src/core/format-response.ts` | **No change** | `ListConcernsResponse`/`formatListConcernsResponse` shapes are unchanged — this slice only reduces the SIZE of the `concerns` array's contents, not its shape. |
| `src/shell/server.ts` | **No change** | The `list_concerns` handler already calls `collectConcernCandidates` unchanged; filtering happens entirely inside that function's existing call graph. |

### Modified Function Contract

```
isGenericHeading(headingText: string): boolean   // new private helper
```

**Behavior**: case-insensitive, whitespace-trimmed EXACT match against
`GENERIC_HEADING_STOPLIST`. Returns `true` only for headings that are themselves
boilerplate section titles, never for headings that happen to contain a stoplist word as
a substring of a longer, genuine topic heading (AC2 — "D-auth: JWT strategy" must
survive). `collectFeatureFileHeadingCandidates`'s existing loop is extended with one
additional filter condition (`!isGenericHeading(candidateText)`) before pushing into the
returned array — no new parameter, no signature change to the exported
`collectConcernCandidates`.

---

## Slice 03: `list_features` deliver-phase detection

### Reuse Analysis

| Existing Component | Location | Reuse Potential | Disposition |
|---|---|---|---|
| `discoverFeatures` (wave-decisions.md presence check) | `src/shell/server.ts` | Direct structural precedent — same function, same per-phase-directory loop, same "does this marker file exist" pattern | EXTEND — add one more condition specifically for the `deliver` phase directory, alongside (not replacing) the existing `wave-decisions.md` check used by all other phases |
| DES execution-log.json schema (`sid`, `p`, `s`, `d`, `t` fields; `p: "COMMIT"` for committed steps) | `docs/feature/list-concerns/deliver/execution-log.json` (read as real example) | Direct schema precedent — this IS the format to parse, already produced by this project's own DELIVER wave tooling, not something ab-mcp invents | READ AND PARSE — `execution-log.json` is `JSON.parse`-able; the binding rule is "at least one entry with `p === \"COMMIT\"\"`" (event status `s`/disposition `d` are NOT part of the binding rule per D6 — mere presence of a COMMIT-phase entry is sufficient, matching the confirmed-with-user semantics; a COMMIT entry exists in the log only when a commit step actually ran, regardless of `s`/`d` detail) |

### Changes Per File

| File | Change type | What changes |
|------|-------------|---------------|
| `src/shell/server.ts` | **Extend** | `discoverFeatures` (existing function) is extended: for each `featureId`/phase-directory pair where `entryName === "deliver"`, instead of (or in addition to) the existing `wave-decisions.md`-presence check, check for `execution-log.json` at `featureDirAbsolute/deliver/execution-log.json`; if it exists, read it via `reader.readFile`, `JSON.parse` its content, and include `"deliver"` in that feature's `phases` array ONLY if `events` contains at least one entry with `p === "COMMIT"`. All OTHER phase directories (`design`, `discuss`, `discover`, `distill`) keep the EXISTING `wave-decisions.md`-presence check, completely unchanged (binding IN/OUT scope — slice 03 touches deliver-detection only). Malformed/unparseable `execution-log.json` (invalid JSON, missing `events` field) is treated as "deliver phase not detected" (fail-closed, consistent with the project's existing skip-on-failure philosophy for unreadable/malformed files elsewhere in this codebase — e.g. `resolve_concern`'s TOCTOU handling) — no new error/warning surfaced to the caller for this specific case, since `list_features` has no error-shape branch for partial per-feature read failures today (consistent with zero-new-error-shape scope). |
| `src/core/classify-structure.ts` | **No change** | `classifyRepoForListFeatures` consumes `snapshot.features` (already a `Record<string, string[]>` of feature_id -> phases) unchanged — it has no awareness of HOW each phase was detected, only that it's a string in the array. The new deliver-detection logic lives entirely in the SHELL (`discoverFeatures`), which is where the binding DISCUSS/US-TOQ-03 instructions explicitly place it ("reads a new file ... in the shell layer," matching where `discoverFeatures` already lives) — `execution-log.json` is a NEW fs read, which functional-core-purity rules (CLAUDE.md, brief.md Section 6) forbid inside `src/core/**`. |
| `src/shell/fs-doc-tree-reader.ts` | **No change** | No new `DocTreeReader` method needed — `reader.readFile` and `reader.pathExists` (both already exist) are sufficient to check for and read `execution-log.json`, same methods already used for every other file this codebase reads. |

### Modified Function Contract

```
discoverFeatures(reader: DocTreeReader, docPath: string): Record<string, string[]>
```
(existing exported-from-module-but-not-exported-publicly shell function — signature
UNCHANGED; only its internal per-phase-directory logic gains a `deliver`-specific
branch)

**New internal behavior** (binding rules from US-TOQ-03's 3 ACs):
1. For phase directories other than `deliver`: unchanged — included if
   `wave-decisions.md` exists directly under that phase directory (existing behavior,
   zero regression — AC3).
2. For a phase directory named exactly `deliver`: included in the feature's `phases`
   array if AND ONLY IF `deliver/execution-log.json` exists, is parseable JSON, has an
   `events` array, AND at least one element of that array has `p === "COMMIT"` (AC1).
   A `deliver/` directory that exists but lacks `execution-log.json`, or whose
   `execution-log.json` has zero `COMMIT`-phase entries, does NOT contribute `"deliver"`
   to the phases array (AC2).
3. A feature with no `deliver/` directory at all is entirely unaffected — the existing
   per-phase loop simply never iterates a `deliver` entry name, so this new branch never
   executes for that feature (AC3 — zero-regression, no special-case code needed for
   "directory absent" since the loop already only processes directory names that
   `reader.listDir` actually returned).

### Earned Trust note (Principle 12)

`execution-log.json` is a NEW fs read added to the shell, on a substrate (the local
filesystem) already covered by the existing `DocTreeReader.probe()` contract
(brief.md Section 9). No NEW fault-injection scenario is required beyond the 4 already
gold-tested (`reader.readFile`'s existing TOCTOU/not-found/permission-denied handling
already covers "file disappears between listing and read" and "path not readable" for
THIS new file the same way it covers every other file this codebase reads) — this is a
reuse of an already-probed read path, not a new substrate dependency. The one NEW
failure mode specific to this file is "exists but contains malformed/non-JSON content,"
which is a CONTENT-validity concern, not a SUBSTRATE-honesty concern (the filesystem
isn't lying about anything — it returned exactly the bytes on disk; the bytes
themselves are just not valid JSON). This is handled by the fail-closed rule above
(treated as "no COMMIT entry found"), and is covered by ordinary unit tests on
`discoverFeatures`'s new branch (table-driven: valid JSON with COMMIT, valid JSON
without COMMIT, malformed JSON, missing file, missing `deliver/` dir entirely) rather
than by a new probe-contract gold test.

---

## Slice 04: `resolve_concern`'s `CONCERN_NOT_FOUND` nudge

### Reuse Analysis

| Existing Component | Location | Reuse Potential | Disposition |
|---|---|---|---|
| `formatConcernNotFound` | `src/core/format-response.ts` | This IS the function to edit — single string literal change | EXTEND (single-line message-text edit, no new logic, no new parameter) |

### Changes Per File

| File | Change type | What changes |
|------|-------------|---------------|
| `src/core/format-response.ts` | **Extend** | `formatConcernNotFound`'s `message` string is edited from `` `No nWave artifacts mentioning "${concern}" were found across the searched repos.` `` to additionally mention `list_concerns()` as the next step, e.g. `` `No nWave artifacts mentioning "${concern}" were found across the searched repos. Try list_concerns() to browse available topics.` ``. No change to the function's signature, parameters, or the `ConcernNotFoundError` type shape — unconditional text, no check for whether `list_concerns()` would itself return empty (binding D7). |
| `src/shell/server.ts` | **No change** | `resolve_concern`'s handler already calls `formatConcernNotFound` unchanged with the same 3 arguments; the message text change is entirely internal to the formatter. |

### Modified Function Contract

```
formatConcernNotFound(
  concern: string,
  searchedRepos: string[],
  skipWarnings: string[],
): ConcernNotFoundError
```
(existing exported function — signature and return type UNCHANGED; only the literal
`message` string template gains a trailing sentence naming `list_concerns()`)

---

## C4 Diagrams

**No C4 diagram changes for this feature.** Confirmed explicitly per Principle 9 /
workflow Phase 6 requirement to state this rather than silently skip: all 4 slices
modify existing pure functions inside already-documented components
(`format-response.ts`, `concern-matcher.ts`) or extend an already-documented shell
function (`discoverFeatures` inside `server.ts`). No new component box, no new tool, no
new external dependency, no new relationship arrow. Section 5.2 (Container) and
Section 5.3 (Component) of `docs/product/architecture/brief.md` remain accurate as-is.

---

## Architecture Enforcement

Style: Modular monolith, functional core / imperative shell (unchanged from brief.md
Section 6).
Language: TypeScript.
Tool: `dependency-cruiser` (existing, no new rule).

Rules enforced (unchanged, already cover all 4 slices):
- `src/core/**` has zero imports from `node:fs`, `node:fs/promises`, `node:child_process`,
  `node:net`, or `src/shell/**`. Slices 01, 02, and 04 modify `src/core/format-response.ts`
  and `src/core/concern-matcher.ts` only — both already inside the enforced boundary, and
  neither gains any new IO import.
- Slice 03's new `execution-log.json` read is correctly placed in `src/shell/server.ts`
  (the imperative shell), NOT in `src/core/classify-structure.ts` — this is the one
  slice where the functional-core/imperative-shell boundary is actively load-bearing for
  the design decision (see Slice 03's Changes Per File rationale above). No new
  dependency-cruiser rule is needed; the EXISTING rule already forbids exactly the
  mistake of putting this fs read in `src/core/**`.

---

## External Integrations

None. Same as every prior feature -- sibling repo filesystems are local read-only inputs,
not API integration partners. No contract testing annotation required.

---

## Test Fixture Guidance (for DISTILL / acceptance-designer)

| Fixture | Contents | Exercises |
|---------|----------|-----------|
| `deep-history-feature-over-cap` | A feature with 5+ phases of wave-decisions.md content whose combined snippet length exceeds `TOTAL_RESPONSE_MAX_CHARS` | Slice 01 AC1, AC3, UAT scenario 1 |
| `normal-feature-under-cap` | A feature with 1 phase, well under the cap | Slice 01 AC2, UAT scenario 2 |
| `mixed-stoplist-headings` | A `wave-decisions.md` with headings "Decisions", "Summary", and "D-auth: JWT strategy" | Slice 02 AC1, AC2, UAT scenario 3 |
| `directory-named-decisions` | A feature directory literally named `Decisions` | Slice 02 AC3, UAT scenario 4 |
| `deliver-with-commit` | A feature with `deliver/execution-log.json` containing ≥1 `p: "COMMIT"` entry | Slice 03 AC1, UAT scenario 5 |
| `deliver-without-commit` | A feature with `deliver/execution-log.json` containing zero `p: "COMMIT"` entries (e.g. only `PREPARE`/`RED_ACCEPTANCE`) | Slice 03 AC2, UAT scenario 6 |
| `no-deliver-dir` | A feature with no `deliver/` directory at all | Slice 03 AC3 (regression) |
| `concern-not-found` | A concern string absent from all configured repos | Slice 04 AC1, UAT scenario 7 |

All fixtures should additionally be runnable against this repo's own `docs/` as a live
dogfood check per KPI-TOQ-1 through KPI-TOQ-4 -- re-run all 4 tools post-implementation
and compare against the documented baselines (97,705 chars; 96 candidates;
`concern-based-querying`/`heading-anchored-snippets`/`list-concerns` missing `"deliver"`;
`resolve_concern("rate-limiting")`'s message lacking `list_concerns`).
