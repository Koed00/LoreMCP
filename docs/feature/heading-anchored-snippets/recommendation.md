# DIVERGE Recommendation — lore-mcp next improvements

## Decision

Proceed with **heading-anchored snippet extraction** as the next feature. Extend `resolve_concern` (and eventually `query_context`) to return the matched section/paragraph instead of the whole file (capped at 8000 chars). This directly fixes a rough edge surfaced during live dogfooding: a query for "concern matching" returned the entire `wave-decisions.md` file truncated mid-content, rather than the specific section discussing concern matching.

## Job

From `docs/product/jobs.yaml` (`cross-repo-context-grounding`): once a relevant file is found, the agent still has to read more than necessary to judge relevance — "Locate → Confirm" steps in the job map remain partially manual.

## Options Evaluated

6 options generated via brainstorming (HMW: "How might we help an agent get only the relevant paragraph, trust it's current, and not miss synonym matches — without adding network calls, embeddings, or author burden?"). 1 filtered by DVF (watch/diff mode — violates ADR-004 no-cache/no-state principle). 5 survived to taste scoring.

| Rank | Option | Weighted Score |
|---|---|---|
| 1 | Heading-anchored snippet extraction | 4.35 |
| 2 | Synonym/alias expansion table | 4.15 |
| 3 | Match-strength field | 3.65 |
| 4 | `list_concerns()` discovery tool | 3.35 |
| 5 | Decision supersession detection | 3.05 |

Filtered (failed DVF): Watch mode / diff-since(timestamp) — requires state across calls, directly contradicts ADR-004.

## Recommended: Heading-anchored snippet extraction

**Rationale**: Highest Job Fit (5/5 — fixes the exact pain just observed) and highest Architecture Fit (5/5 — pure function, reuses the paragraph-splitting logic already built for `detectRejectedPaths`, no new dependencies). Most direct extension of the `concern-based-querying` feature just shipped.

## Dissenting Case: Synonym/alias expansion table

If false negatives (an agent never finding a relevant file because the literal keyword doesn't appear — e.g., querying "auth" when the file says "authentication") are judged worse than false positives with noisy snippets, this should be #1 instead. A noisy-but-found match is recoverable by the agent reading further; a silently missed match is not recoverable without the agent knowing to retry with a synonym. Revisit this ordering if user feedback shows missed matches are a frequent complaint.

## Backlog (not lost — pull into DISCUSS later)

- Synonym/alias expansion table (#2, 4.15)
- Match-strength field — annotate why each match fired (dir-name vs. body, exact vs. alias) (#3, 3.65)
- `list_concerns()` discovery tool — browse-before-you-query, 4th sibling to existing 3 tools (#4, 3.35)
- Decision supersession detection — flag superseded `D-xxx:` entries via nWave "Revised:"/"Supersedes:" convention (#5, 3.05)
- Watch/diff mode (filtered by DVF — would require violating ADR-004; only revisit if the no-cache architecture principle itself is revisited)
