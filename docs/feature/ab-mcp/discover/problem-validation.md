# Problem Validation -- ab-mcp

## Problem Statement (Customer Words)

> "I'm in repo A and I need to pull in relevant context from repo B's docs (its wave-decisions, ADRs, conventions) without manually opening repo B, finding the right file, copying it, and pasting it into repo A's context -- and then having that copy go stale the moment repo B changes."

This is the VALIDATED framing. It supersedes an earlier, incorrect framing that assumed ab-mcp was about a project recalling its own past decisions (see `interview-log.md` -- Critical Mid-Discovery Reframe).

## Job-to-be-Done (JTBD)

**When** I'm working in one repo (Repo A) and need to understand a decision, convention, or boundary established in a sibling repo (Repo B, C, D...) within the same multi-repo platform,
**I want to** retrieve the relevant doc snippets from those other repos directly into my current agent context,
**so I can** make informed decisions in Repo A without manual cross-repo file-hunting and without relying on stale, manually-copied notes.

### Job Map (Locate / Prepare steps -- primary pain)

| Step | Current State (Pain) | Desired Outcome |
|------|----------------------|------------------|
| Define | Recognize that Repo A's question depends on Repo B's prior decisions | Minimize time to identify which other repo(s) hold relevant context |
| Locate | `cd` into Repo B, grep through `docs/`/ADRs to find relevant file | Minimize time to gather relevant doc snippets from other repos |
| Prepare | Copy/paste relevant paragraph or whole CLAUDE.md section into Repo A | Minimize manual copy-paste of cross-repo context |
| Confirm | No mechanism to verify pasted content is still accurate | Minimize likelihood of stale/incorrect cross-repo context |
| Monitor | Pasted notes silently diverge from Repo B's current state over time | Minimize uncertainty about whether retrieved context reflects Repo B's current state |

## Evidence (Recalled Past Behavior)

Source: single-stakeholder OSS creator, recalling experience at prior employer (multi-repo platform: 1 backend, 3 frontends, Cerbos, WorkOS).

1. **Frequency**: Cross-repo doc lookups occurred "at least a few times a week" during feature work touching backend/frontend boundaries, "often daily during integration-heavy sprints." -- Weekly+ threshold met.
2. **Current workaround / cost**: Manual `cd` -> grep `docs/`/ADRs -> open file -> copy paragraph -> switch repo -> paste into scratch note or CLAUDE.md. Time cost in discovery (finding the right doc) plus manual transcription.
3. **Negative outcome of workaround**: Pasted CLAUDE.md sections went stale as the source repo (e.g., Cerbos policies) changed multiple times per quarter without copies being updated -- "worse than no memory because it looks authoritative."
4. **Failed mitigation attempted**: Slack reminders to update copied notes -- did not work reliably, relied on individual memory across multiple copy locations.
5. **Scale of the problem space**: Real scenario spanned 5 candidate repos (backend, 3 frontends, Cerbos/WorkOS), with doc maturity varying significantly across them.

## Confirmation Assessment

Per Mom Test decision rules (single stakeholder, recalled evidence -- not yet 5+ independent interviews):

- Problem confirmed with strong emotional/cost markers: frustration ("worse than no memory"), frequency (weekly+), failed workaround attempts (Slack reminders).
- Evidence type: past behavior (recalled), not future intent. Meets quality bar for "real problem" per Mom Test, though sample size is below the standard 5+ interview threshold (see `D-validation` in `wave-decisions.md`).
- Treated as a single rich signal-cluster covering multiple distinct interaction points (frequency, cost, staleness, failed workaround, scale) -- sufficient to proceed to Opportunity Mapping for an OSS single-stakeholder MVP context, with explicit commitment to test the solution against a mocked multi-repo structure before further investment.

## G1 Gate Evaluation: Problem -> Opportunity

| Criterion | Target | Result | Status |
|-----------|--------|--------|--------|
| Interviews/sessions completed | 5+ (or documented deviation) | 1 stakeholder, 6 Q&A rounds, deep recalled evidence | PASS (with deviation -- see D-validation) |
| Confirmation rate | >60% | 100% (single stakeholder confirms pain across multiple sub-problems) | PASS |
| Problem in customer words | Required | Captured verbatim above | PASS |
| 3+ examples | Required | Frequency, staleness, discovery cost, failed Slack workaround, 5-repo scale (5 examples) | PASS |
| Current alternatives inadequate | Implicit | Manual copy-paste workflow confirmed inadequate (staleness, discovery cost) | PASS |

**Gate Decision**: PROCEED to Opportunity Mapping.

**Documented deviation**: Standard G1 requires 5+ independent interviews. This discovery used a single-stakeholder OSS-creator scenario with 6 rounds of deep, recalled-evidence questioning. This is acceptable for an OSS solo-maintainer MVP context but is logged as a risk to be addressed via mocked multi-repo testing in Phase 3 (see `wave-decisions.md` -- D-validation). Confirmation should be re-validated with additional users post-MVP.
