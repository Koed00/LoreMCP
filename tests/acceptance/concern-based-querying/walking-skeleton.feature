# Walking Skeleton -- concern-based-querying (US-CBQ-01)
#
# Driving port: lore-mcp's MCP server over stdio (real subprocess, same
# driving adapter as ab-mcp acceptance tests). Every scenario below spawns
# the server and calls resolve_concern via the real MCP protocol.
#
# Driven adapter: real local filesystem -- fixture repo created under a
# temp directory per scenario (Strategy C: Real local).
#
# WS strategy: C (Real local) -- feature uses only filesystem I/O (tmpdir).
# No InMemory doubles needed.

@real-io
Feature: Agent resolves a concern against a single configured repo

  Background:
    Given lore-mcp is configured with one entry pointing at a fixture repo
    And the lore-mcp server is started as a subprocess over stdio with that
      configuration

  @walking_skeleton @real-io
  Scenario: Agent resolves a concern and receives authoritative source with live timestamp
    Given the fixture repo has a feature-level decision file for "auth" decisions
    And the fixture repo has an architecture decision record mentioning "auth"
    When the agent resolves the concern "auth"
    Then the response contains at least one match
    And at least one match identifies its source repo
    And the response shows the read was performed live without caching
    And the response includes the list of repos that were searched
