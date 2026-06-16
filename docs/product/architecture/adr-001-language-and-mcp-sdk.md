# ADR-001: Language and MCP SDK Selection

## Status
Proposed (Recommendation pending stakeholder confirmation -- Propose-mode DESIGN output)

## Context

LoreMCP is a local, read-only MCP server consumed by AI coding agents (primarily Claude Code) via stdio. It needs:
- An official/well-supported MCP SDK
- Easy distribution to a solo OSS maintainer's own repos and any future community users (low-friction install via Claude Code MCP config)
- Strong testability for error/warning paths (KPI-4/KPI-5 require near-exhaustive coverage of 4 structured error shapes and 2 warning types across multiple completeness levels)
- Good filesystem and markdown-adjacent ecosystem support

Constraints: solo maintainer, OSS (MIT-preferred), no CI yet, ~4-6 days total effort across 5 stories, no network/DB.

## Decision

Use **TypeScript (5.x) on Node.js LTS (>=20)** with the **official `@modelcontextprotocol/sdk`** (MIT license), distributed as an npm package with a `bin` entry runnable via `npx lore-mcp`.

## Alternatives Considered

### Python + official `mcp` Python SDK
- Pros: official SDK exists, mature fs/markdown ecosystem, mypy available
- Cons: distribution to Claude Code users typically requires `pip`/`uvx`, a less ubiquitous zero-install pattern than `npx` for MCP servers in this ecosystem; mypy type enforcement is opt-in and weaker by default than TS's compile-time checks for shaping the 4 error response contracts
- Rejected: distribution friction + weaker default compile-time contract enforcement for the heavily-tested response shapes

### Plain Node.js / JavaScript (no TypeScript)
- Pros: simplest setup, no build step, no type-checking overhead
- Cons: no compile-time enforcement of the `results`/`warnings`/error-shape contracts; regressions in response shape (the dominant test surface per KPI-4/5) would only be caught at runtime/test-time, not at edit-time
- Rejected: directly weakens the maintainability/testability priority that is the dominant quality driver for this feature

## Consequences

### Positive
- `npx lore-mcp` (or equivalent) gives near-zero-friction installation matching common MCP server distribution conventions
- TypeScript types for `RepoEntry`, `QueryContextResult`, `ErrorResponse` (4 variants) give compile-time safety for the response contracts that KPI-4/5 test exhaustively
- `@modelcontextprotocol/sdk` is the official, actively maintained SDK -- lowest risk of API churn relative to community alternatives

### Negative
- Requires a TS build step (`tsc`) before publishing/running -- minor additional tooling vs. plain JS
- Solo maintainer's prior TS familiarity not confirmed (flagged as open item for stakeholder confirmation, though TS is the dominant language across the broader nWave/Claude Code tooling ecosystem this stakeholder already operates in)
