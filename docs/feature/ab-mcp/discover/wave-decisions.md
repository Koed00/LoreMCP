# Wave Decisions -- DISCOVER (ab-mcp)

## Critical Reframe (Read First)

**Original problem framing was incorrect and has been corrected.**

- ORIGINAL (incorrect): ab-mcp helps an nWave project recall its OWN past decisions (self-recall of wave-decisions.md/ADRs within a single repo).
- CORRECTED (validated): ab-mcp helps a NEW repo query OTHER repos' nWave-ish documentation for cross-repo context grounding. The agent operates in Repo A and retrieves relevant doc snippets from sibling Repos B, C, D, etc.

**Why this matters for downstream waves**: This is not a refinement of scope -- it changes the fundamental actor relationship (self vs. cross-repo), the config shape (single project's own docs vs. a list of OTHER repos' doc paths), and the failure mode being solved (single-repo amnesia vs. cross-repo context blindness). All architecture, design, and requirements work in DISCUSS/DESIGN/DELIVER waves MUST use the corrected framing. Full exchange documented in `interview-log.md`.

## Decisions

### D-scope: MVP Value Proposition Scope

MVP focuses exclusively on **value prop 1 -- context grounding** (cross-repo doc snippet retrieval into the current repo's agent context). **Value prop 2 -- ownership/boundary mapping** (resolving which repo/team owns a given concern, e.g., auth, pagination, permissions, and routing to the authoritative source) is explicitly **deferred to a future iteration**, out of MVP scope.

Rationale: Ownership/boundary mapping requires a concern-to-repo registry/mapping mechanism, a materially larger problem than retrieval. Stakeholder explicitly chose to avoid MVP scope creep (Q5/Q6).

### D-config: Configuration Shape

Config is a **LIST of configured paths to reference repos' docs folders** (format: list of `{repo-name, doc-path}` or equivalent), NOT a single folder / single feature scope as originally assumed.

Constraints:
- Must support a baseline of **3 repos** at MVP.
- Must scale to **10+ repos** later **without schema redesign** (i.e., adding a repo = appending a list entry, no code/schema changes).
- Validated via H4 hypothesis (solution-testing.md) -- test plan: add 4th-5th mock repos to config and confirm zero code changes required.

### D-docquality: Documentation Maturity Variance (REVISED -- nWave-structured only)

**Revised scope decision (post-discovery):** ab-mcp's MVP retrieval mechanism targets repos with **nWave-conformant documentation structure** only:
- `docs/feature/{feature_id}/{phase}/wave-decisions.md` (or `feature-delta.md` for v3.14+ lean format)
- `docs/product/architecture/` (ADRs)
- `CLAUDE.md`

**Loosely-structured "ADRs/manuals dumped in a folder" repos are explicitly OUT OF SCOPE for MVP.** Rationale: relying on the predictable nWave folder/file conventions lets `list_features()` and `query_context()` work via path conventions alone, without heuristic free-text indexing -- a much smaller, more reliable build. The stakeholder's stated preference is for reference repos to adopt nWave's ADR conventions going forward (i.e., ab-mcp can act as an incentive to formalize docs via nWave), rather than ab-mcp accommodating arbitrary unstructured doc dumps.

This **supersedes the original H3 hypothesis** (which planned to test full-nWave vs. loose-folder retrieval). H3 is now narrowed to: validate retrieval precision across nWave-structured repos at varying levels of *completeness* (e.g., a repo with only ADRs and no wave-decisions.md vs. one with full wave artifacts), not arbitrary unstructured dumps.

**Future iteration candidate**: support for non-nWave/loosely-structured repos, if demand emerges.

### D-validation: Validation Methodology and Honesty Statement

This discovery is based on a **single-stakeholder OSS-creator scenario**. Evidence is **recalled past behavior** from the stakeholder's experience at a prior employer operating a multi-repo platform (1 backend + 3 frontends + Cerbos + WorkOS = 5 repos), gathered via 6 rounds of Mom Test-style Q&A -- NOT live multi-interview validation across 5+ independent customers as the standard discovery process would normally require.

This is a **documented deviation** from the standard G1/G3 thresholds (5+ interviews, >80% task completion from 5+ users), accepted because:
- This is a solo/small-team OSS project where the stakeholder is both the customer and the decision-maker (dogfooding model).
- The recalled evidence is rich, specific, and includes negative outcomes (staleness causing active harm) and failed mitigations (Slack reminders), which are strong Mom Test signal types even from a single source.

**Binding follow-through**: The solution will be tested against a **mocked local multi-repo doc structure** (3 mock repos: full-nWave, loose-structure, minimal) before/during build, per the test plan in `solution-testing.md`. Broader user validation (5+ independent users) is a post-MVP activity, not a pre-handoff blocker.

### D-done: MVP Definition of Done

> MVP is done when an agent operating in a new/different repo can **retrieve relevant doc snippets from other configured repos via MCP tools**, **without manual copy-pasting**, and **without staleness** (no reliance on copied/pasted CLAUDE.md notes that can drift from the source repo's current state).

This is the simpler of two definitions considered. The fuller definition (agent also resolves OWNERSHIP and routes to the authoritative repo for a given concern) was explicitly rejected for MVP per D-scope and is the primary candidate for the future iteration referenced there.

### D-bootstrap: CLAUDE.md Auto-Injection Out of Scope

Automatically injecting "use ab-mcp" instructions into a new repo's `CLAUDE.md` (e.g., as part of an nWave DESIGN-phase scaffolding step) is **out of scope for MVP**. For MVP, the stakeholder will **manually** add the rule pointing the agent at ab-mcp to the new repo's `CLAUDE.md`.

Rationale: Bootstrapping/scaffolding integration is a separate concern from the retrieval mechanism itself, and depends on nWave tooling changes outside ab-mcp's control. Revisit once the core retrieval value is proven.

### D-retrieval-risk: Open Question -- Will nWave-Structure-Based Retrieval Be Sufficient? (REVISED)

**Open question raised post-discovery (narrowed after D-docquality revision):** Given MVP now targets **nWave-structured repos only** (D-docquality), will retrieval based on the predictable folder/file conventions (`docs/feature/{feature_id}/{phase}/wave-decisions.md`, `docs/product/architecture/`, `CLAUDE.md`) surface enough relevant context for an agent -- or will partial/incomplete nWave adoption (e.g., a repo with ADRs but no wave-decisions.md, or stale CLAUDE.md) degrade results enough to need additional handling (e.g., frontmatter tags, freshness indicators)?

This is a **retrieval-quality / feasibility risk**, not yet tested. It directly affects:
- The mocked multi-repo test plan (solution-testing.md, H3, narrowed) -- test across nWave-structured mock repos with varying *completeness* (full wave artifacts vs. ADRs-only vs. CLAUDE.md-only), not arbitrary unstructured dumps.

**Status**: Flagged as a carry-forward question for DISCUSS/SPIKE. Likely candidate for a SPIKE-wave probe (e.g., "build minimal retrieval against nWave-structured mock repos of varying completeness, measure whether an agent can answer a known cross-repo question correctly").

## Gate Status Summary

| Gate | Status | Notes |
|------|--------|-------|
| G1 (Problem -> Opportunity) | PASS (with documented deviation) | Single-stakeholder, 6-round recalled evidence; 5 distinct supporting examples; see problem-validation.md |
| G2 (Opportunity -> Solution) | PASS | 7 opportunities mapped, top 3 (O1=17, O2=17, O5=12) all >8; O6 (ownership) deferred per D-scope |
| G3 (Solution -> Viability) | CONDITIONAL PASS | Solution direction validated via hypotheses H1-H4; empirical mocked-repo testing is a binding pre/early-build activity, not yet executed |
| G4 (Viability -> Build) | PASS | Lean Canvas complete; risks Value=Yellow, Usability=Yellow, Feasibility=Green, Viability=Green; channel/unit-economics conditionally documented (OSS, no revenue model) |

## Carry-Forward Items for DISCUSS Wave (product-owner)

1. Apply the corrected cross-repo framing throughout requirements -- do NOT reintroduce the "self-recall" framing.
2. Requirements must reflect the list-based, 3->10+ scalable config shape (D-config).
3. Requirements must account for structure-tolerant retrieval across full-nWave and loosely-structured repos (D-docquality).
4. Requirements scope = value prop 1 only (D-scope); explicitly note value prop 2 (ownership/boundary mapping) as a documented future-iteration backlog item, not silently dropped.
5. The mocked multi-repo test plan (solution-testing.md) should inform acceptance criteria / definition of done for early stories.
6. CLAUDE.md auto-injection/bootstrapping is out of scope for MVP (D-bootstrap) -- do not include it in MVP requirements.
7. Open feasibility question (D-retrieval-risk): whether plain folder-scan retrieval is sufficient, or whether nWave folder conventions/tags need to be leveraged for retrieval quality. Recommend a SPIKE to probe this before/alongside DESIGN.
