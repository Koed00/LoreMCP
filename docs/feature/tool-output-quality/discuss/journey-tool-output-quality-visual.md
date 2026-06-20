# Journey: Agent receives reliable, signal-dense responses from all 4 tools

## Mental Model

An agent calling `query_context`, `list_concerns`, `list_features`, or `resolve_concern` already believes each tool stays within a usable size/signal envelope and degrades gracefully on bad input. This was found false in 3 of 4 ways during live dogfooding against this repo's own docs immediately after `list-concerns` shipped:

1. `query_context` returned 97,705 characters for a single feature — no size cap exists at all, unlike every other tool in this server (which all cap at 8000/1500/200).
2. `list_concerns` returned 96 candidates, a large fraction of which are generic nWave section headers (`"Decisions"`, `"Summary"`, `"Mode"`, `"Key Decisions"`) that provide zero topic signal — present in nearly every wave-decisions.md by convention, indistinguishable from genuine topics like `"Concern Matching Strategy"`.
3. `list_features` reported phases `["design","discuss","distill"]` for features that have a real, complete `deliver/` directory (roadmap.json + execution-log.json) — silently blind to whether a feature actually shipped, because `discoverFeatures` only counts a phase if `wave-decisions.md` exists there, and DELIVER produces execution logs, not decision docs.
4. `resolve_concern`'s `CONCERN_NOT_FOUND` error doesn't mention `list_concerns` as the next step, even though the two tools were explicitly designed to chain together (README's "Using LoreMCP while architecting" workflow).

## Happy Path (post-fix)

| Step | Agent Action | Tool Behavior (after fix) | Output | Emotional State |
|---|---|---|---|---|
| 1 | Calls `query_context(repo_name, feature_id)` on a feature with deep wave history | Applies a size cap across the aggregated response (mechanism TBD in DESIGN), same discipline as the other 3 tools | Response stays within a usable token budget, with a truncation warning if capped | Confident — tool is reliable regardless of feature size |
| 2 | Calls `list_concerns()` | Filters out a stoplist of generic nWave section headers before returning candidates | Response is dense with genuine topic signal, not boilerplate | Oriented — every entry is worth considering |
| 3 | Calls `list_features(repo_name)` on a feature with a completed DELIVER wave | Detects DELIVER phase via execution-log.json/roadmap.json presence, not just wave-decisions.md | `phases` array correctly includes `"deliver"` | Confident — can tell what actually shipped |
| 4 | Calls `resolve_concern(concern)` for a topic that doesn't exist | `CONCERN_NOT_FOUND` message suggests calling `list_concerns()` next | Agent is nudged toward the correct next tool instead of guessing again | Recovering — a dead end becomes a next step |

## Emotional Arc

Confident (calling a known tool) → **broken/surprised** (97K-char dump, noisy list, missing deliver phase, dead-end error) → **fixed/confident** (after this round, each tool behaves within its documented contract). This is a regression-recovery arc, not a net-new feature arc — the target state is "matches what was already implied/documented," not a new capability.

## Shared Artifacts Registry

| Artifact | Type | Single Source of Truth |
|---|---|---|
| `query_context` response size cap | TBD (chars or per-file) | New constant/logic in `src/core/classify-structure.ts` or `format-response.ts` — DESIGN to decide exact placement |
| `list_concerns` stoplist | string[] | New constant in `src/core/concern-matcher.ts`, alongside `collectConcernCandidates` |
| `deliver` phase detection rule | boolean predicate | Extends `discoverFeatures` in `src/shell/server.ts` — DESIGN to decide exact file(s) checked |
| `CONCERN_NOT_FOUND` message text | string | `formatConcernNotFound` in `src/core/format-response.ts` |

No new MCP-facing types — all 4 fixes change existing response *content*, not response *shape* (consistent with `heading-anchored-snippets`'s precedent: narrowing/improving content without breaking the contract).

## Error / Edge Paths

| Scenario | Behavior | Why |
|---|---|---|
| `query_context` response naturally under the cap | No truncation, no warning — identical to today | Zero regression for the common case |
| `query_context` response exceeds the total cap | Truncate lowest-priority results first (exact ordering rule TBD in DESIGN — likely oldest-wave-first, since most recent decisions are most relevant), add a truncation warning | Confirmed with user: total-response cap, not per-file — a per-file cap alone would not have prevented the 97K-char bug, since it was caused by many under-cap files summed together |
| `list_concerns` stoplist accidentally filters a legitimately-named topic (e.g. a feature literally named "Decisions") | Acceptable — stoplist applies ONLY to heading-text candidates, never to directory names or ADR titles, so a feature/ADR genuinely named "Decisions" still surfaces via its own structural signal | Confirmed with user: heading text only, since directory/ADR names are human-chosen and inherently meaningful, while heading text is convention-driven boilerplate in nWave files |
| A feature has a `deliver/` directory but execution-log.json has zero COMMIT-phase entries (mid-DELIVER, never finished a step) | `deliver` phase is NOT included in `phases` array | Confirmed with user: "shipped" requires at least one COMMIT phase logged, not just directory existence — matches DES (Delivery Execution System) semantics already used throughout this project |
| `resolve_concern`'s nudge text when `list_concerns` itself would also return empty | Message should not blindly suggest a tool that won't help | Needs to stay honest — don't suggest a dead end. (Acceptable per DESIGN: the nudge can be unconditional text pointing to `list_concerns()` as a general next step, since recommending the tool costs nothing even if it also returns empty — the agent learns that fact for free on the next call) |

## Constraints for DESIGN

1. All 4 fixes are pure-function changes in `src/core/` (and one shell-layer detection change in `server.ts` for the deliver-phase fix) — no new dependency, consistent with every prior feature.
2. `query_context`'s cap is a TOTAL-response cap with truncation warning (confirmed with user) — DESIGN owns the exact truncation-priority ordering and the numeric threshold.
3. `list_concerns` stoplist applies to heading-text candidates ONLY, never directory names or ADR titles (confirmed with user) — DESIGN owns the exact stoplist content.
4. `deliver` phase detection requires execution-log.json with at least one COMMIT-phase entry (confirmed with user) — DESIGN owns the exact parsing logic.
