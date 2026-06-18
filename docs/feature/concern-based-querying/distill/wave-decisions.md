# Wave Decisions -- DISTILL (concern-based-querying)

## Summary

DISTILL produced 8 acceptance test files (4 feature files + 4 step definition files),
a RED scaffold for `src/core/concern-matcher.ts`, a stub tool registration in
`src/shell/server.ts`, and this file. All prior DISCUSS and DESIGN decisions are
carried forward without revision.

---

## Walking Skeleton Strategy

**Auto-detected: Strategy C (Real local)**

Rationale: `resolve_concern` depends exclusively on the local filesystem (tmpdir
fixture repos) with no costly external dependencies (no containers, no network, no
hosted services). All scenarios use real filesystem I/O under OS tmpdir.

Tags applied:
- Walking skeleton scenario: `@walking_skeleton @real-io`
- All other scenarios: `@real-io`
- No `@in-memory` or `@requires_external` tags used.

---

## Scope Decisions

Scenarios generated for:
- **US-CBQ-01**: Walking skeleton + single-repo matching (walking-skeleton.feature,
  release-1-single-repo-matching.feature)
- **US-CBQ-02**: Cross-repo scan (release-2-cross-repo.feature)
- **US-CBQ-03**: Rejected paths / roads not taken (release-3-rejected-paths.feature)
- **US-CBQ-04**: INVALID_CONCERN (release-1-single-repo-matching.feature scenarios 6-7)
  and partial-structure warning (release-3-rejected-paths.feature scenario 5)

Out of scope for this DISTILL wave (consistent with DISCUSS/DESIGN out-of-scope list):
- Semantic/vector search
- Caching
- Ownership/boundary mapping
- CLAUDE.md auto-injection

---

## Key DISTILL Decisions

### D-CBQ-DISTILL-1: One-at-a-time enablement

The walking skeleton scenario in `walking-skeleton.feature` is enabled first. All
other scenarios are registered in step files without skip markers at the Gherkin
level (following the existing project pattern where `Scenario` without `@skip` is
used, with vitest-cucumber's `Scenario` call providing the registration). The
software-crafter enables one scenario at a time by running the TDD loop and
advancing through the sequence.

Recommended implementation order (matching story-map.md release plan):
1. walking-skeleton.feature — WS scenario (US-CBQ-01 core loop)
2. release-1-single-repo-matching.feature — US-CBQ-01 focused scenarios + US-CBQ-04
   INVALID_CONCERN
3. release-2-cross-repo.feature — US-CBQ-02
4. release-3-rejected-paths.feature — US-CBQ-03 + US-CBQ-04 partial-structure warning

### D-CBQ-DISTILL-2: RED scaffold strategy

`src/core/concern-matcher.ts` is a RED scaffold — every exported function throws
`"Not yet implemented — RED scaffold"`. This ensures:
- TypeScript compiles (no import errors)
- The `resolve_concern` tool handler in `server.ts` is registered and callable
- Acceptance tests fail RED (assertion failures) rather than BROKEN (import errors
  or "tool not found" MCP errors)

The stub `resolve_concern` handler in `server.ts` returns a structured
`NOT_IMPLEMENTED` error, not a raw exception, so `parseToolJson` in the step files
can parse the response and the test fails on the assertion
`expect(lastResponse.matches).toBeDefined()` — a proper RED state.

### D-CBQ-DISTILL-3: Fixture design

Each step file creates fixture repos under `os.tmpdir()` in `BeforeEachScenario`
and tears them down in `AfterEachScenario` — matching the pattern established in
`release-1-multi-repo-and-errors.steps.ts`. No shared fixture state between scenarios.

Fixture content uses prose that clearly contains or does not contain the target
keyword, avoiding ambiguity in keyword matching assertions.

### D-CBQ-DISTILL-4: Business language verification

All `.feature` files verified clean of:
- Technical terms: JSON, HTTP, API, TypeScript, MCP, subprocess, filesystem,
  directory, function, module, import, class, interface, method, regex, string
- Status codes (200, 404, 500)
- Infrastructure terms (Redis, PostgreSQL, S3)

Domain terms used instead: "decision file", "decision record", "concern",
"architecture decisions directory", "repos that were searched", "live without caching".

---

## Error/Edge Scenario Ratio

| Feature file | Total | Error/edge | Ratio |
|---|---|---|---|
| walking-skeleton.feature | 1 | 0 | 0% (WS only, by design) |
| release-1-single-repo-matching.feature | 7 | 4 | 57% |
| release-2-cross-repo.feature | 4 | 2 | 50% |
| release-3-rejected-paths.feature | 5 | 2 | 40% |
| **Total** | **17** | **8** | **47%** |

Overall ratio: 47% -- exceeds the 40% mandate.

---

## Mandate Compliance Evidence

**CM-A (Hexagonal boundary)**: All step files call `handle!.client.callTool()`
via the MCP client connected to the real server subprocess. Zero direct imports
of `concern-matcher.ts`, `format-response.ts`, or `server.ts` handler functions.

**CM-B (Business language)**: Verified -- see D-CBQ-DISTILL-4. Zero technical
terms in `.feature` files.

**CM-C (User journey completeness)**: Walking skeleton scenario title: "Agent
resolves a concern and receives authoritative source with live timestamp" --
expresses user goal, Then steps are observable outcomes (matches present,
repo identified, live timestamp). Non-technical stakeholder can confirm.

**CM-D (Pure function extraction)**: `concern-matcher.ts` is specified as
pure functions with zero IO. The scaffold preserves this boundary (no `node:fs`
import). The software-crafter must maintain this invariant -- enforced by
`dependency-cruiser` (`npm run check:arch`).

---

## Peer Review

Critique-dimensions self-review (6 dimensions):

1. **Happy path bias**: 47% error/edge -- PASS (>= 40%).
2. **GWT format compliance**: All scenarios have exactly one When action,
   business-language Given context, and observable Then outcomes -- PASS.
3. **Business language purity**: Zero technical terms in Gherkin -- PASS.
4. **Coverage completeness**: US-CBQ-01 through US-CBQ-04 all covered -- PASS.
5. **Walking skeleton user-centricity**: WS title describes agent goal; Then steps
   describe observable outcomes (matches, repo identification, timestamp) -- PASS.
6. **Observable behavior assertions**: All Then steps assert return values from
   the `callTool()` driving port call (`lastResponse.matches`, `lastResponse.error`,
   `lastResponse.retrieved_at`). Zero internal state assertions -- PASS.

**Approval status: approved.**

---

## Handoff to DELIVER

Artifacts handed off:
- `tests/acceptance/concern-based-querying/walking-skeleton.feature` + `.steps.ts`
- `tests/acceptance/concern-based-querying/release-1-single-repo-matching.feature` + `.steps.ts`
- `tests/acceptance/concern-based-querying/release-2-cross-repo.feature` + `.steps.ts`
- `tests/acceptance/concern-based-querying/release-3-rejected-paths.feature` + `.steps.ts`
- `src/core/concern-matcher.ts` (RED scaffold)
- `src/shell/server.ts` (stub `resolve_concern` tool registration added)

Implementation sequence: walking-skeleton → release-1 → release-2 → release-3.
Enable one scenario at a time. Each failing acceptance test is the outer-loop
signal to drop into the inner TDD loop (`concern-matcher.ts` unit tests).
