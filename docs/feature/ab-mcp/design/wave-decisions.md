# Wave Decisions -- DESIGN (ab-mcp)

## Mode

Propose mode: solution-architect (Morgan) read all DISCUSS/DISCOVER SSOT artifacts and produced a complete first-pass architecture with recommendations, presented as 2-3 options + trade-offs + recommendation per key decision. The stakeholder reviewed all 5 key decisions plus OQ-1/OQ-2 and CONFIRMED Morgan's recommended option in every case (see AskUserQuestion responses, 2026-06-11). All 5 decisions and both open questions are now FINAL/BINDING for DISTILL/DELIVER.

## Greenfield Confirmation

- `docs/product/architecture/` did NOT exist prior to this wave (confirmed via Glob -- no results). This wave creates it.
- No `src/` code exists yet (confirmed via Glob -- no results). Reuse Analysis table in brief.md is empty by design (greenfield), not by omission -- all components are NEW with justification "no existing alternative."

## Key Decisions (CONFIRMED by Stakeholder)

1. **Language/MCP SDK -- CONFIRMED: TypeScript + `@modelcontextprotocol/sdk`** (npx-distributable, official SDK, compile-time contract enforcement for the 4 error shapes). Alternatives considered: Python `mcp` SDK, plain JS. See ADR-001.

2. **Development paradigm -- CONFIRMED: Functional core / imperative shell** within idiomatic TypeScript (pure functions for config validation, structure classification, snippet extraction, response formatting; thin imperative shell for fs + MCP wiring). Alternatives considered: OOP with DI/classes-per-concern. CLAUDE.md paradigm-declaration note added to repo root CLAUDE.md per stakeholder confirmation. See brief.md Decision 2.

3. **Config file format -- CONFIRMED: JSON** (`ab-mcp.config.json`, native `JSON.parse`, hand-written validator). Alternatives considered: YAML, TOML. See ADR-002.

4. **Snippet extraction approach -- CONFIRMED: whole-file return per structurally-relevant file** (path-convention-based relevance only, no markdown-AST/heading-matching/text-search), with size-cap + heading-aligned truncation as a safety valve, surfaced via `warnings`. Alternatives considered: heading-based section extraction, text-search/grep. This is the design-time resolution of D-retrieval-risk -- both rejected alternatives would reintroduce the heuristic content-indexing that D-docquality REVISED explicitly scoped out. See ADR-003.

5. **Phase/feature discovery mechanism -- CONFIRMED: pure directory enumeration**, phases derived from subdirectory names (no hardcoded phase list, per US-01 Technical Notes), `has_architecture_adrs`/`has_claude_md` computed via existence checks. Includes a defined precedence order for the 4 structured outcomes (REPO_NOT_CONFIGURED / REPO_PATH_NOT_FOUND / NO_NWAVE_STRUCTURE / FEATURE_NOT_FOUND vs. partial-with-warnings). Both open questions RESOLVED: OQ-1 (CLAUDE.md location = `<repo>/CLAUDE.md`, one level up from `doc_path`) and OQ-2 (feature_id directory absent but repo has ADRs/CLAUDE.md -> partial results + warnings, NOT FEATURE_NOT_FOUND) -- both CONFIRMED as Morgan's recommendation. See brief.md Decision 5.

## Architecture Summary

- **Pattern**: Modular monolith, single Node.js process, single npm package. Internally split into a functional core (no IO) and a thin imperative shell (fs + MCP SDK), enforced via `dependency-cruiser`. NOT full hexagonal with DI containers -- right-sized for 1 developer, ~4-6 days, single adapter per port.
- **Containers** (5, all within one process): MCP Tool Layer, Config Loader, Doc-Tree Scanner, Content Extractor, Response Formatter. C4 L1 (System Context) + L2 (Container) in `docs/product/architecture/brief.md`. L3 omitted (below complexity threshold).
- **Rejected simpler/alternative architectures**: single-file script (rejected -- mixes IO into the heavily-tested classification logic); full hexagonal+DI (rejected -- no second adapter ever needed); microservices (rejected -- N/A for local single-process solo-maintainer tool).

## Reuse Analysis

| Existing Component | Location | Reuse Potential | Disposition |
|---|---|---|---|
| -- (none found) | -- | N/A | Greenfield: no `src/` exists, no prior `docs/product/architecture/`. Table intentionally empty. All 5 containers are NEW, justified as "no existing alternative." |

## Technology Stack

| Component | Choice | License |
|---|---|---|
| Language | TypeScript 5.x | Apache 2.0 |
| Runtime | Node.js LTS >=20 | MIT |
| MCP SDK | `@modelcontextprotocol/sdk` | MIT |
| Config format | JSON | N/A (native) |
| Validation | hand-written guard (escalate to `zod` if needed) | MIT |
| Architecture enforcement | `dependency-cruiser` | MIT |
| Test runner | `vitest` | MIT |

All OSS, MIT/Apache 2.0. No proprietary technology.

## Constraints Established

- No caching layer of any kind (config, directory listings, file content) -- ADR-004, enforced via code-review checklist (no CI yet).
- Core modules (`src/core/**`) MUST NOT import `node:fs`, `node:fs/promises`, `node:child_process`, `node:net` -- enforced via `dependency-cruiser` pre-commit hook.
- All 4 error responses (`REPO_NOT_CONFIGURED`, `REPO_PATH_NOT_FOUND`, `FEATURE_NOT_FOUND`, `NO_NWAVE_STRUCTURE`) and 2 warning types (ADR-only, CLAUDE.md-only) plus truncation warning are part of the binding response contract -- typed in TS, tested exhaustively (KPI-4/5).
- `DocTreeReader` adapter MUST implement a `probe()` method covering 6 fault-injection scenarios (path missing, not-a-directory, permission-denied, TOCTOU file-disappears, symlink-escape documented as non-goal, case-insensitive-fs matching) -- enforced via 3-layer check (TS interface/subtype, dependency-cruiser/AST structural check, behavioral gold-tests). See brief.md Section 9.
- External integrations: NONE. No contract testing required for this feature.

## Upstream Changes

None expected. No corrections to DISCOVER/DISCUSS artifacts identified during DESIGN. The two open questions (OQ-1, OQ-2 in brief.md Decision 5) are DESIGN-time clarifications/interpretations requiring stakeholder confirmation, not corrections to upstream decisions.

## Handoff Readiness

- C4 L1+L2 diagrams: present (Mermaid, brief.md Section 5)
- ADRs: 4 created (adr-001 through adr-004), each with 2+ alternatives and consequences
- Probe contracts: specified for the sole external dependency (filesystem) per Principle 12
- Peer review: self-review conducted -- architecture traces cleanly to all 5 DISCUSS user stories and outcome KPIs; no contradictions with DISCOVER/DISCUSS scope decisions found; reuse analysis correctly empty (greenfield); functional-core/imperative-shell boundary enforceable via dependency-cruiser
- Stakeholder confirmation: all 5 key decisions + OQ-1 + OQ-2 CONFIRMED (2026-06-11)
- CLAUDE.md: created at repo root with project description + Development Paradigm section (functional core / imperative shell)
- `docs/product/architecture/brief.md`: updated to reflect CONFIRMED status throughout (header + Decision 5 Open Questions section)

**Status: READY for handoff to nw-platform-architect (DEVOPS wave).** DESIGN wave complete -- architecture, ADRs, C4 diagrams, and all decisions/open questions finalized. No SPIKE escalation needed (D-retrieval-risk addressed via Decision 4; build-time probe deferred to Slice 03 per DISCUSS recommendation, no new feasibility concerns raised during DESIGN).
