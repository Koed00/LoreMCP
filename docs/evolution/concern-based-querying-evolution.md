# Evolution Archive — concern-based-querying

## Feature Summary
Adds `resolve_concern(concern: string)` MCP tool to lore-mcp. Cross-repo keyword search returning matches (with relevance tier), rejected alternatives, and partial-structure warnings. No repo_name required.

## Delivered
- 2026-06-18 / 2026-06-19

## Steps
| Step | Description | Outcome |
|------|-------------|---------|
| 01-01 | Wire resolve_concern handler end-to-end | PASS |
| 02-01 | validateConcern INVALID_CONCERN | PASS |
| 02-02 | matchConcernInSnapshot + format-response types | PASS |
| 03-01 | Cross-repo aggregation + probe-failure resilience | PASS |
| 04-01 | detectRejectedPaths + partial-structure warning | PASS |

## Key Decisions
- Keyword matching at paragraph granularity for rejection detection (D-CBQ-D2)
- Cross-repo scan loop in shell handler, not a new module (D-CBQ-D3)
- INVALID_CONCERN checked before any IO (D-CBQ-D4)
- searched_repos = probe-succeeded repos only (D-CBQ-D5)

## Quality Gates
- 303/303 tests passing
- Architecture constraints clean (dependency-cruiser)
- Mutation score: 93.99% (threshold: 80%)
- DES integrity: 5/5 steps with complete traces
