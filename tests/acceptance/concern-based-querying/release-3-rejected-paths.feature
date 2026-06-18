# Release 3 -- Rejected Paths / Roads Not Taken (US-CBQ-03)
#
# Driving port: lore-mcp MCP server over stdio (real subprocess).
# Driven adapter: real local filesystem fixture repos (Strategy C: Real local).
#
# Scenario count: 5
# Error/edge scenarios: 2 of 5 (40%) -- meets 40% target.
# Story coverage: US-CBQ-03 (all AC), US-CBQ-04 partial-structure warning (AC 1-2).

@real-io
Feature: Agent discovers roads not taken when resolving a concern

  Background:
    Given lore-mcp is configured with one fixture repo entry
    And the lore-mcp server is started as a subprocess over stdio with that
      configuration

  Scenario: Rejected alternative surfaced from an architecture decision record
    Given the fixture repo has an architecture decision record for "auth" that
      includes a "Rejected:" section mentioning "OAuth2"
    When the agent resolves the concern "auth"
    Then the response includes at least one rejected path
    And that rejected path source file is the architecture decision record
    And that rejected path snippet contains "OAuth2"
    And that rejected path type is "rejected_alternative"

  Scenario: Out-of-scope decision surfaced from a feature-level decision file
    Given the fixture repo has a feature-level decision file for "ab-mcp" that
      contains "Out of scope: caching/invalidation layer"
    When the agent resolves the concern "caching"
    Then the response includes at least one rejected path
    And that rejected path snippet contains "caching"
    And that rejected path type is "rejected_alternative"

  Scenario: A file can appear in both matches and rejected paths for the same concern
    Given the fixture repo has an architecture decision record that accepts "auth"
      and also explicitly rejects an alternative in the same document
    When the agent resolves the concern "auth"
    Then the same source file appears in both the matches list and the rejected paths list
    And the match entry carries the full-file snippet
    And the rejected path entry carries only the rejection paragraph

  Scenario: Rejected paths field is present and empty when no rejection language exists
    Given the fixture repo has a feature-level decision file containing "logging"
      with no rejection language
    When the agent resolves the concern "logging"
    Then the response contains matches for "logging"
    And the rejected paths field is present and contains no entries

  Scenario: Agent receives partial-structure warning when only architecture-level matches exist
    Given the fixture repo has an architecture decision record containing "rate-limiting"
    And the fixture repo has no feature-level files mentioning "rate-limiting"
    When the agent resolves the concern "rate-limiting"
    Then the response contains a match with relevance "architecture-level"
    And the response includes a warning about the absence of feature-level decisions
    And the response is not an error
