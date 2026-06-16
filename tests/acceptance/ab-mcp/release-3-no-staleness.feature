# Release 3 -- No-Staleness Property Verification (US-05)
#
# Driving port: ab-mcp's MCP server over stdio.
# Driven adapter: real local filesystem -- this is the property KPI-2 (zero
# staleness) guards permanently (devops/kpi-instrumentation.md). This
# .feature file IS the permanent CI guardrail referenced there.
#
# One-at-a-time: each scenario is @skip until its DELIVER TDD cycle begins.
# This story is itself a property-verification/regression-guard story (US-05
# Technical Notes: "primarily VERIFICATION, not new build") -- there is no
# separate error-path surface beyond what US-03 already covers, so the 40%
# error/edge target is met at the MILESTONE level (Release 1 is 57%,
# Release 2 is 40%) rather than within this single-property-focused file.
# See distill/wave-decisions.md for the aggregate accounting.

@real-io
Feature: query_context always reflects the current on-disk state, never a stale snapshot

  Background:
    Given ab-mcp is configured with one entry: repo "ab-mcp" pointing at a
      real fixture repo's "docs" directory
    And the ab-mcp MCP server is started as a subprocess over stdio with that
      configuration

  @adapter-integration
  Scenario: An edit to a source repo's doc file is reflected in the very next query
    Given "ab-mcp"'s docs/feature/ab-mcp/discover/wave-decisions.md does not
      contain the line "TEMP-VERIFY-LIVE-READ"
    When the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"
    Then the response's snippet does not contain "TEMP-VERIFY-LIVE-READ"
    When the line "TEMP-VERIFY-LIVE-READ" is appended to that file on disk
    And the agent calls query_context again for repo "ab-mcp" and feature
      "ab-mcp", with no server restart
    Then the response's snippet contains "TEMP-VERIFY-LIVE-READ"

  @skip
  Scenario: retrieved_at marker is present on every response, even with unchanged content
    When the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"
      twice in a row with no file changes in between
    Then both responses include a retrieved_at field indicating a live,
      uncached read
    And the snippet content is identical between the two responses

  @skip
  Scenario: Successive queries each reflect the latest on-disk state
    When the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"
      (call 1)
    And the line "D-temp: temporary verification line" is appended to
      docs/feature/ab-mcp/discover/wave-decisions.md on disk
    And the agent calls query_context again for repo "ab-mcp" and feature
      "ab-mcp" (call 2)
    Then call 1's snippet does not contain "D-temp: temporary verification line"
    And call 2's snippet contains "D-temp: temporary verification line"
