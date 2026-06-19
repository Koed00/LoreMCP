# Architecture Design -- list-concerns

## Feature: `list_concerns()` -- candidate concern/topic discovery across all configured repos

This document is the primary handoff artifact for the software-crafter (DELIVER wave).
It lists every file to touch, what changes, and the new pure-function contract -- without
specifying internal implementation. No new ADR was needed (see
`docs/feature/list-concerns/design/wave-decisions.md`) -- this feature is a straightforward
reuse of heading-detection machinery already decided in `adr-006-heading-boundary-parsing-strategy.md`
and the per-repo scan loop already decided in `adr-005-concern-matching-strategy.md`.

This is a surgical addition of a 4th tool to an already-shipped pipeline. No walking
skeleton (per story-map.md), no new error shape, no new external dependency.

---

## Approach Decision: Where Does the Aggregation/Dedup Function Live?

Two concrete options exist for where the new topic-extraction + aggregation logic lives.

### Option A (RECOMMENDED): Extend `src/core/concern-matcher.ts`

Add a new exported pure function, `collectConcernCandidates`, alongside the existing
heading-detection helpers (`detectHeadingLines`, `HEADING_PATTERN`, `partitionIntoSections`)
in the SAME file. These helpers are currently module-private (not exported) but are exactly
the building blocks needed to pull heading TEXT (not just boundaries) out of a file for
topic-candidate extraction.

**Rationale**:
- `detectHeadingLines`/`HEADING_PATTERN` are already in this file, already pure, already
  tested. No cross-module import needed -- the new function is a sibling in the same
  module, calling the same private helpers directly (no export-surface change to existing
  functions beyond making heading-text extraction available internally).
- `concern-matcher.ts` is already the home of "things that look at file content and produce
  candidate strings for `resolve_concern`-adjacent tools." `list_concerns()` is a direct
  sibling concept to `resolve_concern` -- both consume the same per-repo scan shape
  (feature dir names, ADR file contents, optionally CLAUDE.md), just produce a different
  output shape (candidate strings vs. matches). Keeping them in one file means a future
  maintainer sees the full "concern" concept (matching AND discovery) in one place.
- Avoids a THIRD core file for what is, per story-map.md's Carpaccio taste test, "one new
  pure aggregation function" -- introducing `src/core/concern-lister.ts` for a single
  function would violate "ships 4+ new components? No."

### Option B (REJECTED): New file `src/core/concern-lister.ts`

- Pros: stricter single-responsibility separation -- `concern-matcher.ts` stays focused on
  matching/scoring, a new file owns discovery/listing.
- Cons: requires either (a) exporting `detectHeadingLines`/`HEADING_PATTERN` from
  `concern-matcher.ts` for cross-module reuse (small API surface increase, but workable),
  or (b) duplicating the heading-detection regex in a second file (explicitly forbidden by
  the binding DISCUSS constraint: "Must reuse `detectHeadingLines`/`HEADING_PATTERN` from
  `heading-anchored-snippets` rather than reinventing topic extraction"). Adds a fourth
  core file for a single ~20-30 line function -- disproportionate ceremony for a solo
  maintainer at this problem size, and against "simplest solution first."
- Rejected: no correctness or testability gain over Option A; adds either an export-surface
  change or a forbidden duplication, for a problem that fits naturally as one more exported
  function in an existing, already-cohesive module.

### Option C (REJECTED): Extend `src/core/classify-structure.ts`

- Pros: `classify-structure.ts` already enumerates feature directory names and ADR file
  paths into a `TreeSnapshot` -- topic candidates could theoretically be derived there.
- Cons: `classify-structure.ts`'s job is classifying a SPECIFIC repo+feature_id query
  outcome (FULL/PARTIAL/FEATURE_NOT_FOUND/NO_NWAVE_STRUCTURE) -- it has zero involvement
  with file CONTENT (it only knows paths exist, never reads bytes). Heading-text extraction
  requires reading file content, which `classify-structure.ts` deliberately never touches
  (its only inputs are a `TreeSnapshot` of paths/booleans, no content). Bolting
  content-aware heading extraction onto a path-classification module would blur its single
  responsibility and entangle two different classification concerns -- the SAME concern
  brief.md Section 5.3 already flags for why `concern-matcher.ts` deliberately does NOT
  import `classify-structure.ts`.
- Rejected: wrong module for content-aware logic; would violate the existing separation
  already documented in brief.md Section 5.3.

**DECISION: Option A.** New function `collectConcernCandidates` added to
`src/core/concern-matcher.ts`, reusing the existing private `detectHeadingLines`/
`HEADING_PATTERN` helpers directly (no export-surface change needed for those two -- they
remain module-private; only the new function is exported).

---

## Changes Per File

| File | Change type | What changes |
|------|-------------|--------------|
| `src/core/concern-matcher.ts` | **Extend** | Add new exported pure function `collectConcernCandidates`. Add one new small private helper, `extractFirstHeadingText`, that reuses the existing `detectHeadingLines`/`HEADING_PATTERN` machinery to pull the TEXT of the first heading line in a file (used for ADR title extraction -- ADRs conventionally start with a single `# ADR-NNN: Title` heading per the existing corpus). No change to any existing exported function, type, or call site (`validateConcern`, `detectRejectedPaths`, `matchConcernInSnapshot`, `extractHeadingAnchoredSnippet` are all untouched). |
| `src/core/format-response.ts` | **Extend** | Add new response type `ListConcernsResponse` (`{ concerns: string[], searchedRepos: string[], warnings?: string[] }`) and formatter `formatListConcernsResponse`. No new error type -- per binding DISCUSS decision, `list_concerns()` never returns an ERROR shape for the all-repos-structureless case (unlike `resolve_concern`'s `CONCERN_NOT_FOUND`); that case returns a normal success shape with an empty `concerns` array. |
| `src/shell/server.ts` | **Extend** | Register a 4th tool, `list_concerns` (no input schema -- zero arguments, per binding decision). Handler reuses the EXACT per-repo probe/scan loop pattern already proven by `resolve_concern`'s handler (loop over `loadConfig()` repos, `reader.probe(entry.docPath)`, skip-on-failure with a `skipWarnings` entry, `buildTreeSnapshot` per repo) -- but instead of calling `matchConcernInSnapshot`, calls the new `collectConcernCandidates` per repo and accumulates candidate strings across all repos before deduping/capping. No new shell-level fs operations -- `buildTreeSnapshot`, `discoverFeatures`, `discoverAdrFiles` are reused unchanged (already read ADR file paths; the handler additionally reads ADR file CONTENT the same way `resolve_concern`'s handler already does, via `reader.readFile`). |
| `src/core/classify-structure.ts` | **No change** | Unrelated -- topic-candidate extraction is content-aware (reads file bytes), which this module deliberately never does (see Approach Decision, Option C rejection). |
| `src/shell/fs-doc-tree-reader.ts` | **No change** | No new fs operations -- `listDir`/`readFile`/`pathExists`/`probe` are already sufficient; `list_concerns` uses the SAME methods `resolve_concern` already uses. |
| `README.md` | **Extend (FLAGGED FOR DELIVER ROADMAP)** | (1) Add a `list_concerns()` entry to the "## MCP Tools" section, same format as the existing 3 tools (Input: none / Output: `{concerns, searched_repos, warnings?}` / no structured errors -- this tool never returns an ERROR shape). (2) Revise the "Using LoreMCP while architecting" section's "**Known gap**" paragraph (currently states `list_concerns()` "is scoped but not yet built") to state the gap is CLOSED -- update the numbered workflow (step 0/1) to recommend calling `list_concerns()` FIRST, before `resolve_concern`, as the new "browse" step. **This README update is part of THIS feature's delivery, not deferred -- software-crafter/DELIVER-wave roadmap MUST include a README-update step.** |

---

## New Function: `collectConcernCandidates` (in `src/core/concern-matcher.ts`)

### Responsibility

Given one repo's already-collected feature directory names, ADR file contents, and
heading text within those files, return a flat list of candidate concern/topic strings for
that repo. Aggregation ACROSS repos (dedup + 200-cap) happens at the call site
(`src/shell/server.ts`'s `list_concerns` handler), not inside this function -- this keeps
the function's responsibility scoped to "per-repo candidate extraction," matching the
existing precedent of `matchConcernInSnapshot` (also per-repo; cross-repo accumulation
happens in the shell loop for `resolve_concern` too).

### Contract

```
collectConcernCandidates(input: ConcernCandidateInput): string[]

type ConcernCandidateInput = {
  featureDirectoryNames: string[];
  adrFiles: Array<{ sourceFile: string; content: string }>;
  featureFiles: Array<{ sourceFile: string; phase: string; content: string }>;
};
```

**Inputs**: same shape of pre-read data `matchConcernInSnapshot` already consumes (minus
`concern` and `claudeMdFile` -- CLAUDE.md is repo-conventions, not a decision-topic source,
per the binding DISCUSS decision: "Candidate topics extracted from: feature directory
names, ADR filenames/titles, and heading text within wave-decisions.md/ADR files" --
CLAUDE.md is explicitly NOT listed as a topic source).

**Behavior** (binding rules from US-LC-01's 5 ACs; the *how* is the crafter's
implementation choice):

1. Every entry in `featureDirectoryNames` is itself a candidate string, verbatim (AC1 --
   "candidate concern strings drawn from those directory names").
2. For every ADR file in `adrFiles`: extract the title via `extractFirstHeadingText`
   (the text of the first detected heading line, with the leading `#{1,6}\s` markup and
   any `ADR-NNN:`/`ADR NNN:` numeric prefix stripped -- e.g. `# ADR-005: Concern Matching
   Strategy` -> candidate string `"Concern Matching Strategy"`). If the ADR file has no
   heading at all, fall back to the filename with the `adr-NNN-` prefix and `.md` suffix
   stripped and hyphens left as-is (e.g. `adr-005-concern-matching-strategy.md` ->
   `"concern-matching-strategy"`) -- this is the same "headingless fallback is structural,
   not a special case" philosophy ADR-006 already established for
   `extractHeadingAnchoredSnippet`.
3. For every file in `featureFiles` (wave-decisions.md/feature-delta.md per phase):
   extract heading TEXT for every heading line detected via `detectHeadingLines`
   (reused unchanged), with the leading `#{1,6}\s` markup stripped. Each heading's text
   becomes one candidate string. (This is the "heading text within wave-decisions.md/ADR
   files" source named in the binding DISCUSS decision.)
4. Return the flat concatenation of (1)+(2)+(3) for this one repo, in the order:
   feature directory names, then ADR titles (in `adrFiles` input order, which the shell
   already sorts), then feature-file heading text (in `featureFiles` input order). NO
   deduplication and NO 200-cap inside this function -- both happen once, across ALL
   repos' results combined, at the call site (see below).
5. Pure. No side effects, no fs access, no new dependency. Operates only on
   already-read strings (content already collected by the shell, same precondition as
   `matchConcernInSnapshot`).

### New private helper: `extractFirstHeadingText`

```
extractFirstHeadingText(content: string): string | null
```

Reuses `detectHeadingLines` (existing, unchanged) to find heading line indexes, takes the
FIRST one (ADRs in this corpus have exactly one top-level `# ADR-NNN: Title` heading by
convention -- verified against this repo's own 6 ADR files), strips the `#{1,6}\s` prefix
and the document's existing `ADR-NNN:`/`ADR NNN:` numbering convention (regex strip, e.g.
`/^ADR[-\s]?\d+:\s*/i`), and returns the remaining title text trimmed. Returns `null` if no
heading lines exist (caller falls back to filename-derived candidate, rule 2 above).

### Call-site change inside `src/shell/server.ts`: new `list_concerns` handler

```
server.registerTool(
  "list_concerns",
  { description: "...", inputSchema: {} },   // zero arguments, per binding decision
  async () => {
    repos = loadConfig(options.configPath);
    const allCandidates: string[] = [];
    const searchedRepos: string[] = [];
    const skipWarnings: string[] = [];

    for (const entry of repos) {
      const probe = reader.probe(entry.docPath);
      if (!probe.ok) {
        skipWarnings.push(`Skipped repo "${entry.repoName}": ${probe.reason}`);
        continue;   // AC2/AC3 -- silent exclusion, never an error for the whole call
      }
      searchedRepos.push(entry.repoName);
      const snapshot = buildTreeSnapshot(reader, entry);
      // read ADR file contents + feature file contents, same pattern as resolve_concern's loop
      const candidates = collectConcernCandidates({
        featureDirectoryNames: Object.keys(snapshot.features),
        adrFiles, featureFiles,
      });
      allCandidates.push(...candidates);
    }

    const deduped = Array.from(new Set(allCandidates));      // AC4 -- exact-string dedup
    const capped = deduped.slice(0, 200);                     // AC5 -- 200-entry cap
    const truncationWarning = deduped.length > 200
      ? [`Result truncated to 200 of ${deduped.length} candidate concerns.`]
      : [];

    return toToolResult(formatListConcernsResponse(
      capped, searchedRepos, [...skipWarnings, ...truncationWarning],
    ));
  },
);
```

This means:
- A repo whose `probe()` fails contributes nothing and produces only a `skipWarnings`
  entry -- exactly the existing `resolve_concern` skip pattern, satisfying AC2/AC3/KPI-LC-2.
- Dedup is exact-string-match across the WHOLE accumulated list (AC4) -- "rate-limiting"
  surfacing as both a directory name in one repo and a directory name in another repo
  collapses to one entry, satisfying KPI-LC-3.
- The cap is applied to the DEDUPED list, in the order repos were processed (config order)
  and within a repo in the order described in `collectConcernCandidates` rule 4 -- "first
  200 in repo-config order" per the binding D4 decision.
- `searchedRepos` lists every repo that was successfully probed, REGARDLESS of whether it
  contributed any candidates (AC1/AC3 both require `searched_repos` populated even when
  `concerns` ends up empty) -- this mirrors `resolve_concern`'s existing `searchedRepos`
  semantics exactly.
- Unlike `resolve_concern`, there is NO "zero matches -> error" branch. Per the binding
  DISCUSS decision, an empty `concerns: []` is always a valid success response, never
  `CONCERN_NOT_FOUND` or any other error shape (AC3).

---

## New Response Type and Formatter (in `src/core/format-response.ts`)

```
type ListConcernsResponse = {
  concerns: string[];
  searchedRepos: string[];
  warnings?: string[];
};

formatListConcernsResponse(
  concerns: string[],
  searchedRepos: string[],
  warnings: string[],
): ListConcernsResponse
```

No new `StructuredError` member -- `list_concerns()` has no error-shape branch in its
binding contract (config-load failure still surfaces the existing ad-hoc `CONFIG_ERROR`
shape already used identically by all 3 existing tools' handlers in `server.ts`; this is
pre-existing behavior, unchanged, not a new error type for this feature).

---

## Test Fixture Guidance (for DISTILL / acceptance-designer)

| Fixture | Contents | Exercises |
|---------|----------|-----------|
| `multi-repo-distinct-topics` | Two repos: one with 2+ feature dirs + 1 ADR with a clear `# ADR-NNN: Title` heading, one with a different feature dir | AC1, UAT scenario 1 |
| `one-structureless-repo` | Repo A has structure, Repo B has zero `docs/feature/`, zero ADRs, zero CLAUDE.md | AC2, UAT scenario 2, KPI-LC-2 |
| `all-structureless` | All configured repos have zero nWave structure | AC3, UAT scenario 3, KPI-LC-2 |
| `duplicate-topic-across-repos` | Two repos both have a feature dir literally named `rate-limiting` | AC4, UAT scenario 4, KPI-LC-3 |
| `over-200-candidates` | Fixture repo(s) collectively producing 200+ distinct directory names / heading texts / ADR titles | AC5, UAT scenario 5 |
| `headingless-adr` | An ADR file with no `#`-prefixed heading line at all | filename-fallback rule (rule 2 above), regression safety for KPI-LC-1 |

All fixtures should additionally be runnable against this repo's own `docs/` as a live
dogfood check (KPI-LC-1/KPI-LC-5) -- post-implementation, run `list_concerns()` against this
repo's own 3 feature directories + 6 ADRs and confirm at least one candidate per existing
feature directory and ADR (zero silent omissions), then feed one result into
`resolve_concern()` and confirm a real match (the two-tool chain, KPI-LC-5).

---

## Earned Trust: Probe Contract Extension

No new substrate dependency is introduced. `collectConcernCandidates` and
`extractFirstHeadingText` are pure string-in/array-out functions operating on content
already read by the existing, already-probed `DocTreeReader`. The existing
`DocTreeReader.probe()` contract (brief.md Section 9) and its behavioral gold tests are
unaffected -- `list_concerns`'s handler reuses the EXACT same `reader.probe(entry.docPath)`
call already gold-tested for `resolve_concern`, with the EXACT same skip-on-failure
semantics (fault-injection scenarios 1-4 from brief.md Section 9 apply unchanged; no new
fault-injection scenario is introduced since no new fs operation is introduced). The probe
for the new pure functions is their own unit test suite (table-driven, one case per AC
above); the existing meta-test (`probe-contract.test.ts`) requires no changes since no new
adapter is introduced.

---

## Architecture Enforcement

Style: Modular monolith, functional core / imperative shell (unchanged from brief.md
Section 6).
Language: TypeScript.
Tool: `dependency-cruiser` (existing, no new rule).

Rules enforced (unchanged, already cover this addition):
- `src/core/**` has zero imports from `node:fs`, `node:fs/promises`, `node:child_process`,
  `node:net`, or `src/shell/**`. `collectConcernCandidates` and `extractFirstHeadingText`
  live in `src/core/concern-matcher.ts`, already inside the enforced boundary.

---

## External Integrations

None. Same as every prior feature -- sibling repo filesystems are local read-only inputs,
not API integration partners. No contract testing annotation required.
