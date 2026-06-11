# Interview Log -- ab-mcp Discovery

**Date**: 2026-06-11
**Stakeholder**: Single-stakeholder OSS-creator scenario (project owner / primary user of ab-mcp)
**Method**: Mom Test-style structured Q&A, recalled past behavior from prior employer's multi-repo platform
**Rounds**: 6 (Q1-Q6)

---

## Critical Mid-Discovery Reframe

**This is the single most important finding from this discovery session.**

The discovery conversation began with an assumed problem framing:

> ORIGINAL (INCORRECT) FRAMING: "ab-mcp helps an nWave project recall its OWN past decisions" -- i.e., a project querying its own historical wave-decisions.md / ADRs / feature-deltas to avoid re-litigating past choices.

During the interview, the stakeholder corrected this framing. The actual problem is different in kind, not just degree:

> CORRECTED FRAMING: "ab-mcp helps a NEW repo query OTHER repos' nWave-ish documentation for cross-repo context grounding" -- i.e., when working in Repo A, an agent needs to understand conventions, decisions, ownership boundaries, and architecture established in Repos B, C, D (sibling repos in a multi-repo platform), without the human manually copy-pasting docs or notes between repos.

This reframe changes:
- **Scope of "memory"**: not a single repo's own history, but a federation of multiple repos' documentation
- **Primary actor**: an agent operating in a *different* repo than the one whose docs are being retrieved
- **Failure mode being solved**: not "we forgot why we did X" (single-repo amnesia) but "this new repo doesn't know what those other repos already established" (cross-repo context blindness)
- **Config shape**: must reference multiple external repos' doc locations, not a single project's own doc folder

This reframe is documented as a binding constraint for all downstream DISCOVER outputs and must be carried forward to DISCUSS wave (see `wave-decisions.md`).

---

## Q1 -- Initial Problem Framing (Pre-Reframe)

**Scout**: Tell me about the last time you were working in one repo and needed to know something that was decided in a different repo. What happened?

**Stakeholder**: At my prior employer, we had a platform with one backend repo, three frontend repos, plus Cerbos (authorization) and WorkOS (auth/identity) as supporting services/repos. Constantly, when working in a frontend repo, I'd need to know things the backend team had already decided -- API contracts, auth flow assumptions, permission model conventions from Cerbos policies, role mappings from WorkOS. Or working on the backend, I'd need to know what a frontend assumed about a response shape.

[Initial framing assumed: this is about ab-mcp letting a project recall its own decisions. Stakeholder's answer didn't match that framing -- it was clearly about cross-repo, not self-recall.]

---

## Q2 -- Probing the Mismatch (The Reframe)

**Scout**: I want to check something -- when you describe needing to know what the backend team decided while working in a frontend repo, that sounds like you're querying ANOTHER repo's history, not your own repo recalling its own past. Is that right? Because the original framing for ab-mcp was "a project recalls its own past decisions." Which is it?

**Stakeholder**: You're right, that framing is wrong. It's not about a project remembering itself -- each repo's CLAUDE.md and wave-decisions.md already does an okay job of that locally. The real pain is cross-repo: I'm in repo A, and I need to pull in relevant context from repo B's docs (its wave-decisions, ADRs, conventions) without manually opening repo B, finding the right file, copying it, and pasting it into repo A's context -- and then having that copy go stale the moment repo B changes.

**[REFRAME LOGGED]**: ab-mcp's actual job is cross-repo context grounding for a NEW repo querying OTHER repos' docs, not self-recall.

---

## Q3 -- Past Behavior: How Was This Handled Before?

**Scout**: When this came up at your prior employer -- needing backend context while in a frontend repo -- what did you actually do? Walk me through the last specific time.

**Stakeholder**: Concretely: I'd `cd` into the backend repo, grep through its `docs/` or `ADRs/` folder for the relevant decision (e.g., "how do we handle pagination" or "what does Cerbos policy X actually enforce"), open the file, copy the relevant paragraph, switch back to the frontend repo, and paste it into a scratch note or directly into the agent's context/prompt. Sometimes I'd paste a whole CLAUDE.md section into the frontend repo's CLAUDE.md "for reference" -- which then immediately started going stale because nobody updated both copies when the backend's policy changed.

**Scout**: How often did this happen?

**Stakeholder**: At least a few times a week when actively building a feature that touched both backend and frontend boundaries -- so weekly+ at minimum, often daily during integration-heavy sprints.

---

## Q4 -- Hardest Part / Cost of Current Approach

**Scout**: What was the hardest part about that copy-paste approach, or what did you not love about it?

**Stakeholder**: Two things. First, staleness -- the pasted CLAUDE.md notes in the frontend repo described the backend's permission model as of the day I copied it, but Cerbos policies changed three more times that quarter and nobody went back to update the copies. So the frontend repo's "memory" of the backend was actively wrong, which is worse than having no memory at all because it looks authoritative. Second, discovery cost -- finding the RIGHT doc in the other repo took time. You don't always know which ADR or which section of wave-decisions.md is relevant; you have to search, scan, judge relevance, then extract.

**Scout**: What did you do about the staleness problem -- any workaround?

**Stakeholder**: Not really a good one. Occasionally someone would post in Slack "hey we changed the Cerbos policy, update your local notes" but that relied on people remembering to do it and remembering everywhere it was copied to. It just didn't happen reliably.

---

## Q5 -- Definition of Done

**Scout**: If ab-mcp existed back then, what would "done" look like for the MVP? Two possible framings: (a) the agent retrieves relevant doc snippets from other repos without manual copy-paste, or (b) a fuller scenario where the agent also resolves OWNERSHIP -- i.e., tells you which repo/team owns a given concern (auth, pagination, permissions) and routes you to the authoritative source automatically.

**Stakeholder**: Stick with the simpler version (a) -- "agent retrieves relevant doc snippets from other repos without manual copy-pasting." The ownership-resolution piece (b) is valuable but it's a bigger problem (requires some kind of registry/mapping of concern-to-repo) and I don't want MVP scope creep. Get retrieval working and stale-free first.

**[DECISION LOGGED -- D-done]**: MVP done = agent in a new repo can retrieve relevant doc snippets from other configured repos via MCP tools, without manual copy-paste, without staleness from copied CLAUDE.md notes.

---

## Q6 -- Value Proposition Focus & Config Shape

**Scout**: Two value props seem to be in play here: (1) context grounding -- pulling relevant snippets from other repos' docs into the current repo's agent context, and (2) ownership/boundary mapping -- knowing which repo is authoritative for which concern. Which is the MVP focus, and what would the config for "other repos" need to look like? You mentioned earlier this might be scoped to "a single folder" or "single feature scope" -- does that still hold given the backend + 3 frontends + Cerbos + WorkOS scenario (5+ repos)?

**Stakeholder**: Focus on (1) context grounding for MVP. Ownership/boundary mapping (2) is explicitly deferred as a future upgrade -- out of scope for MVP.

On config: no, single-folder/single-feature scope doesn't hold. In the real scenario I had backend + 3 frontends + Cerbos + WorkOS = potentially 5 external repos to reference, though realistically the doc-bearing ones were backend + frontends (Cerbos/WorkOS docs were often just policy files, less nWave-structured). The config needs to be a LIST of configured paths to other repos' docs folders -- starting with maybe 3 in a baseline setup but needs to scale to 10+ repos later (e.g., if the platform grows more frontends or services) without needing a redesign of the config schema.

Also worth noting: doc quality varies a lot across repos. Some repos (the well-maintained backend) have full nWave structure -- wave-decisions.md, ADRs, CLAUDE.md, feature-delta.md, the works. Others (a frontend that was mid-migration) just had a folder of loosely-organized ADRs and manuals dumped together, no consistent nWave structure. ab-mcp needs to handle both -- it can't assume every referenced repo follows the full nWave convention.

---

## Evidence Summary

| Signal | Type | Source |
|--------|------|--------|
| Weekly+ frequency of cross-repo doc lookups during integration work | Past behavior (recalled) | Q3 |
| Manual cd/grep/copy/paste workflow used "at least a few times a week" | Past behavior (recalled) | Q3 |
| Pasted CLAUDE.md notes went stale, became actively misleading | Past behavior, negative outcome (recalled) | Q4 |
| No reliable workaround existed (Slack reminders failed) | Past behavior (recalled) | Q4 |
| Discovery cost (finding right doc in other repo) called out as separate pain | Past behavior (recalled) | Q4 |
| Real scenario involved 5 candidate repos (1 backend, 3 frontends, Cerbos/WorkOS) | Context scale evidence | Q6 |
| Doc maturity varies across repos (full nWave vs. loose ADR dumps) | Context evidence | Q6 |

**Note on validation methodology**: This evidence is recalled past behavior from a single stakeholder reflecting on a prior employer's multi-repo platform, not live multi-interview validation across 5+ distinct customers. Per `D-validation` (see `wave-decisions.md`), this is treated as a single validated signal-cluster, to be further tested against a mocked local multi-repo doc structure during Solution Testing.
