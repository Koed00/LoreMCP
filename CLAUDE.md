# CLAUDE.md -- AB-MCP

Crafter guidance for AI agents working in this repository.

## Project

ab-mcp is a local, read-only MCP server that gives an AI coding agent live access
to nWave-structured documentation (`wave-decisions.md`/`feature-delta.md`, ADRs,
`CLAUDE.md`) from a configured list of sibling repos. See
`docs/product/architecture/brief.md` for the full architecture and
`docs/feature/ab-mcp/` for this feature's wave artifacts.

## Development Paradigm

This project follows **functional core / imperative shell** within TypeScript:

- **Core** (`src/core/`): pure functions only -- config validation, nWave
  structure classification, snippet-extraction rules, response formatting.
  No imports of `node:fs`, `node:fs/promises`, `node:child_process`, or `node:net`.
  Test with in-memory fixtures, no fs mocking.
- **Shell** (`src/shell/`): the only layer that touches the filesystem or the
  MCP transport (`@modelcontextprotocol/sdk`). Thin -- reads files/directories
  and hands plain data to the core.

This boundary is enforced via `dependency-cruiser` (`npm run check:arch`).
See `docs/product/architecture/brief.md` Section 6 for rationale.

## Mutation Testing Strategy

This project uses **per-feature** mutation testing. Runs after refactoring
during each delivery, scoped to modified files. Kill rate gate: >= 80%.
