# Walking Skeleton -- ab-mcp

## Scope

US-01 (Feature 0 / slice-00, per `discuss/story-map.md`): an AI coding agent
in the AB-MCP repo itself calls `query_context("ab-mcp", "ab-mcp")` via the
real MCP stdio server and gets back the `## Critical Reframe (Read First)`
section of `docs/feature/ab-mcp/discover/wave-decisions.md`, with
`source_file` and `retrieved_at`.

## Driving Adapter

`tests/acceptance/ab-mcp/support/mcp-client.ts` spawns
`node --import tsx src/index.ts` (the real `npx ab-mcp` bin entry, per
`package.json` `bin`) as a subprocess, with `AB_MCP_CONFIG` pointing at a
temp `ab-mcp.config.json`, and connects an `@modelcontextprotocol/sdk`
`Client` over `StdioClientTransport`. Every acceptance scenario goes through
this real protocol path -- no scenario calls `classifyStructure`/
`formatResponse`/handler functions directly.

## Driven Adapter

The real local filesystem, rooted at THIS repo's own `docs/` directory
(dogfooding, per US-01's "Solution": `{repo-name: "ab-mcp", doc-path: "<AB-MCP repo>/docs"}`).
No fixture repos are needed for the walking skeleton itself -- `docs/feature/ab-mcp/discover/wave-decisions.md`
already exists and contains the `## Critical Reframe (Read First)` section
(verified present, see `docs/feature/ab-mcp/discover/wave-decisions.md`).

## End-to-End Path

```
walking-skeleton.steps.ts
  -> spawns subprocess: src/index.ts
       -> StdioServerTransport.connect(server)
            -> src/shell/server.ts: createServer()
                 registers "list_features", "query_context"
  -> MCP Client.callTool("query_context", {repo_name:"ab-mcp", feature_id:"ab-mcp"})
       -> server.ts handler:
            loadConfig(AB_MCP_CONFIG)              [src/shell/config-loader.ts -- SCAFFOLD]
            reader.probe(docPath)                  [src/shell/fs-doc-tree-reader.ts -- SCAFFOLD]
            classifyStructure(snapshot, featureId) [src/core/classify-structure.ts -- SCAFFOLD]
            formatQueryContextResponse(...)        [src/core/format-response.ts -- SCAFFOLD]
       -> MCP SDK catches thrown "Not yet implemented -- RED scaffold"
          -> returns { isError: true, content: [...] }
  -> step asserts response.results[0].source_file ends with
     "docs/feature/ab-mcp/discover/wave-decisions.md"  -- FAILS (RED)
```

## Status at Handoff

**RED, not BROKEN.** The subprocess starts, the MCP handshake succeeds, both
tools are registered and listable (`Server boots and exposes both tools`
scenario should currently PASS once `npm install` is run -- it does not
depend on the scaffolded core/shell logic). The 3 scenarios that call
`query_context`/`list_features` and assert on response SHAPE will fail with
`AssertionError` (or `expect(...).toBeDefined()` failures), not with
`ImportError`/connection errors/process crashes.

## DELIVER Slice-00 Order (suggested, one-at-a-time)

1. `src/shell/config-loader.ts` -- `loadConfig()`: parse + validate
   `ab-mcp.config.json` into `RepoEntry[]`.
2. `src/shell/fs-doc-tree-reader.ts` -- `probe()`, `pathExists()`,
   `listDir()`, `readFile()` against real `node:fs`.
3. `src/core/classify-structure.ts` -- `classifyStructure()` /
   `classifyRepoForListFeatures()`: pure logic per brief.md Decision 4/5,
   testable with in-memory `TreeSnapshot` fixtures (no fs).
4. `src/core/format-response.ts` -- response/error shaping per brief.md
   Section 8.
5. Wire the `TODO (DELIVER)` comments in `src/shell/server.ts` (build a real
   `TreeSnapshot` via `reader.listDir`/`reader.probe`, read matched files via
   `reader.readFile`, pass through to the now-implemented core functions).
6. Run `npm test` -- the `@walking_skeleton` scenario should go GREEN. The 3
   remaining `@real-io` scenarios in `walking-skeleton.feature` (not
   `@skip`) should also go GREEN at this point, since they exercise the same
   modules.
7. Proceed to `release-1-multi-repo-and-errors.feature`, one `@skip` scenario
   at a time (remove `@skip`, implement, go green, repeat).

## What Strategy C Cannot Model

Not applicable -- Strategy C uses real adapters for everything ab-mcp
touches (local filesystem). There are no InMemory doubles in the acceptance
suite, so there is nothing such doubles "cannot model" to document. (Pure
`src/core/*` unit tests, written during DELIVER, WILL use in-memory
`TreeSnapshot` fixtures -- that is the intended fast-feedback layer beneath
these `@real-io` acceptance tests, per brief.md Section 6's testability
rationale.)
