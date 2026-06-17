# Wave Decisions -- DESIGN (concern-based-querying)

## Summary

DESIGN wave produced: architecture extension to `docs/product/architecture/brief.md`
(Section 1, 5, 8, 10, 11 updated; new C4 Component diagram added), ADR-005 (concern
matching strategy), this file, and `architecture-design.md` (Changes Per File table for
the crafter). All prior DISCUSS decisions are carried forward without revision.

---

## Reuse Analysis

| Existing Component | File | Overlap | Decision | Justification |
|---|---|---|---|---|
| `classifyStructure` / `classifyRepoForListFeatures` | `src/core/classify-structure.ts` | Relevance tier logic (feature-level / architecture-level / repo-conventions) is identical to the hierarchy used by `resolve_concern` matches | **Extend** — add `matchConcernInSnapshot` function alongside existing exports. Do NOT duplicate the tier-classification logic. | The tier mapping (path → relevance string) is already implicit in `classifyStructure`; extracting it as a shared helper keeps both code paths coherent. |
| `formatQueryContextResponse` / `formatListFeaturesResponse` | `src/core/format-response.ts` | Response-shaping pattern (build result array, collect warnings, attach `retrievedAt`) is identical | **Extend** — add `formatResolveConcernResponse` + new types (`ConcernMatch`, `RejectedPath`, `ResolveConcernResponse`, `ConcernNotFoundError`, `InvalidConcernError`) alongside existing exports. | Same file already owns all response-shape types. Adding alongside keeps the module cohesive without splitting a small file. |
| `server.ts` tool registration loop | `src/shell/server.ts` | Pattern for loading config, probing each repo entry, building snapshots, calling core, returning `toToolResult(...)` is reused verbatim | **Extend** — add `resolve_concern` handler following the same pattern. No structural change to the file. | Handler is ~40 lines following the established pattern; no abstraction needed. |
| `createFsDocTreeReader` / `DocTreeReader` | `src/shell/fs-doc-tree-reader.ts` | `listDir`, `readFile`, `pathExists`, `probe` are all that `resolve_concern`'s shell orchestration needs | **Reuse as-is** — no changes. | `resolve_concern` needs to scan all repos (not just one), reading files via `readFile`. The existing `DocTreeReader` interface covers all required operations. |
| `buildTreeSnapshot` (server.ts internal) | `src/shell/server.ts` (lines 37-49) | Builds the `TreeSnapshot` that `resolve_concern` also needs per-repo | **Reuse as-is** — the existing private function is called once per repo inside the new handler. | Same enumeration of features / ADRs / CLAUDE.md paths that `resolve_concern` scans for keyword matches. No change required. |

No new shell module is required. No new npm dependency is required. The entire concern-
matching and rejected-path-detection logic is new pure-function code in `src/core/`.

---

## Key DESIGN Decisions

### D-CBQ-D1: New Core Module vs Extending Existing Files

**Decision**: Add one new file `src/core/concern-matcher.ts` for concern-matching and
rejected-path-detection pure functions. Do NOT fold these into `classify-structure.ts` or
`format-response.ts`.

**Rationale**: `classify-structure.ts` is concerned with "given a feature_id and a tree
snapshot, which files should be read?" — a structural classification. Concern matching
is "given file content already read, does it mention this topic?" — a content classification.
Different questions; different test fixtures; separating them keeps each file testable in
isolation with focused fixtures. `format-response.ts` is extended (not replaced) because
response-shaping is its established responsibility.

**Alternatives considered**: Single-file expansion of `classify-structure.ts` (rejected:
mixes structural and content-based classification, increasing the test surface of an already-
tested file without benefit); creating a separate `src/core/format-concern-response.ts`
(rejected: unnecessary split for a small addition; `format-response.ts` is the natural home).

### D-CBQ-D2: Rejection Detection Scope and Proximity Rule

**Decision**: Rejection detection operates at **paragraph granularity** — a "paragraph" is
defined as a contiguous block of non-blank lines. A file contributes a `rejectedPath` entry
if any paragraph in the file BOTH (a) contains the concern keyword (case-insensitive) AND (b)
contains at least one rejection keyword. The rejection snippet is that paragraph (capped at
1 500 characters — shorter than the match snippet cap, since paragraphs are small).

Rejection keywords (minimum from D-CBQ-rejected; extended here):
- `rejected:`, `rejected —`, `not built`, `won't have`, `wont have`,
  `out of scope`, `not in scope`, `alternative considered and dismissed`,
  `deferred`, `discarded`, `not chosen`, `explicitly excluded`

All matches are case-insensitive.

**Rationale**: Paragraph-proximity avoids false positives from files that discuss a
concern in one section and a different rejection in a distant section. A paragraph is the
smallest coherent unit of nWave artifact prose. The cap at 1 500 characters is sufficient
for any nWave paragraph; if a single "paragraph" is longer it signals non-standard
formatting and truncation-with-warning applies.

**Alternatives considered**: Whole-file scan (flag entire file if both concern + rejection
present) — rejected: too many false positives, especially for ADRs which always have a
"Rejected Alternatives" section that could match any concern mentioned anywhere in the ADR.
N-line window (concern keyword within N lines of rejection keyword) — rejected: line-counting
is brittle for files with varying line lengths; paragraph boundary is a natural and stable
delimiter already present in nWave artifacts.

### D-CBQ-D3: Cross-Repo Scan Orchestration Placement

**Decision**: The cross-repo scan loop lives in `src/shell/server.ts` inside the
`resolve_concern` handler — NOT in a new shell module. The loop iterates over all config
entries, probes each, builds `TreeSnapshot`, then calls the pure core functions. Per-repo
probe failures are collected as warnings; successfully scanned repos contribute to the
aggregated `matches` and `rejectedPaths` arrays.

**Rationale**: The existing `query_context` and `list_features` handlers follow exactly this
pattern (load config → probe → build snapshot → call core → format). The difference is that
`resolve_concern` iterates ALL entries rather than one. No new abstraction is needed for a
loop; adding one would obscure a 15-line pattern with indirection.

### D-CBQ-D4: `CONCERN_NOT_FOUND` vs `INVALID_CONCERN` Precedence

**Decision**: `INVALID_CONCERN` is checked FIRST (before loading config or touching the
filesystem). An empty or whitespace-only concern string returns `INVALID_CONCERN`
immediately. Minimum non-whitespace alphanumeric content: at least one alphanumeric
character (`/[a-zA-Z0-9]/`) after trimming. A concern of `"???"` (punctuation only, no
alphanumeric) returns `INVALID_CONCERN`.

**Rationale**: This matches the DISCUSS wave decision (D-CBQ-errors) and US-CBQ-04.
Validating before any IO prevents diagnostic confusion (an agent with a variable
substitution bug gets an immediate, unambiguous error rather than scanning all repos and
finding nothing, which is indistinguishable from a genuinely undecided concern).

### D-CBQ-D5: `searched_repos` Field Definition

**Decision**: `searched_repos` in `CONCERN_NOT_FOUND` lists only repos where the probe
SUCCEEDED (i.e., `doc_path` was reachable). Repos that failed probe are listed in
`warnings` (same format as US-CBQ-02 Domain Example 2). This is the binding
interpretation from DISCUSS wave-decisions.md Upstream Change #4.

---

## Constraints Established (Carried to DISTILL / DELIVER)

1. `src/core/concern-matcher.ts` must have zero `node:fs`/`node:net`/`node:child_process`
   imports — same `dependency-cruiser` rule as all other core files.
2. `rejected_paths` field must always be present (as `[]` when empty) on a successful
   `resolve_concern` response — never absent. Crafter must not omit it.
3. `retrieved_at` must be present on ALL response shapes including `INVALID_CONCERN` and
   `CONCERN_NOT_FOUND`. The value `"live (no cache)"` or an ISO timestamp is acceptable
   (matching existing pattern in `query_context`).
4. Snippet content for `matches` uses the same 8 000-character size cap and heading-
   aligned truncation as ADR-003. Rejection snippet cap is 1 500 characters.
5. No module-level or closure-level variable keyed by repo_name/concern may survive between
   calls (ADR-004 enforcement). The scan starts fresh on every call.

---

## Upstream Changes to DISCUSS Artifacts

None. All DISCUSS decisions carried forward without revision. The rejection keyword list
in D-CBQ-rejected (6 keywords) is extended here (D-CBQ-D2) — this is an additive
DESIGN-wave detail, not a revision to the DISCUSS decision. The DISCUSS decision specified
"DESIGN wave to refine the keyword list", which this wave has done.
