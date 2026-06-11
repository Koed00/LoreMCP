# Slice 03: Partial nWave Structure -- ADRs-Only and CLAUDE.md-Only Repos

## Learning Hypothesis

"When a configured repo has incomplete nWave adoption (ADRs but no wave-decisions.md, or only CLAUDE.md), ab-mcp can still return relevant partial context plus an explicit warning -- proving D-retrieval-risk's narrowed H3 (retrieval across varying nWave completeness levels) without requiring per-repo configuration."

## Scope

- `query_context` for a feature_id where the target repo has `docs/product/architecture/ADR-*.md` but NO `docs/feature/{feature_id}/.../wave-decisions.md` -> returns ADR results + `warnings: ["no feature-level wave-decisions.md found..."]`
- `query_context` for a repo where ONLY `CLAUDE.md` exists (no feature dir, no ADRs) -> returns CLAUDE.md-sourced result + `warnings: ["only CLAUDE.md-level context found..."]`
- `NO_NWAVE_STRUCTURE` error when a configured repo has NONE of: feature wave-decisions/feature-delta, architecture ADRs, CLAUDE.md
- `list_features` flags `has_architecture_adrs` / `has_claude_md` accurately per repo

## Production Data

Construct (or identify) one repo in config with ADRs-only structure for a given feature_id, and one with CLAUDE.md-only. If the stakeholder's real sibling repos don't currently have these gaps, create minimal real doc trees reflecting genuine incomplete-adoption scenarios (still real markdown content, not placeholder text).

## Effort Estimate

1 day

## Demo

Query a feature in the ADRs-only repo -> get ADR snippet + warning about missing wave-decisions.md. Query a feature in the CLAUDE.md-only repo -> get CLAUDE.md snippet + warning. Query against a 4th configured repo with zero nWave artifacts -> NO_NWAVE_STRUCTURE error.

## Maps to User Story

US-04 (Partial Structure Handling) in user-stories.md

## Carry-Forward Note

This slice is the primary build-time probe for the D-retrieval-risk SPIKE candidate flagged in DISCOVER's wave-decisions.md. If results during this slice show warnings are insufficient (agent still misled), escalate to a dedicated SPIKE before Release 2 is considered complete.
