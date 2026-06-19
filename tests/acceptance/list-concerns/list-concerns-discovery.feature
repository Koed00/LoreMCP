# Concern Discovery (US-LC-01)
#
# Driving port: lore-mcp MCP server over stdio (real subprocess), list_concerns tool.
# Driven adapter: real local filesystem fixture repos (Strategy C: Real local).
#
# Scenario count: 5
# Error/edge scenarios: 2 of 5 (40%) -- meets 40% target (all-structureless,
# over-200-candidates truncation).
# Story coverage: US-LC-01 (all 5 AC).

@real-io
Feature: Agent browses candidate concern topics before querying resolve_concern

  Background:
    Given lore-mcp is configured with fixture repo entries
    And the lore-mcp server is started as a subprocess over stdio with that
      configuration

  Scenario: Candidate topics are drawn from feature directories and ADR titles across repos
    Given "repo-a" has feature directories "auth-flow" and "rate-limiting"
    And "repo-a" has an architecture decision record titled "Concern Matching Strategy"
    When the agent calls list_concerns
    Then the response contains "auth-flow"
    And the response contains "rate-limiting"
    And the response contains "Concern Matching Strategy"
    And the response lists "repo-a" as a searched repo

  Scenario: A structureless repo is silently excluded, not an error
    Given "repo-a" has a feature directory "auth-flow"
    And "repo-b" has no nWave structure at all
    When the agent calls list_concerns
    Then the response contains "auth-flow"
    And the response lists "repo-a" as a searched repo
    And the response is not an error

  Scenario: All configured repos lack nWave structure
    Given "repo-a" has no nWave structure at all
    And "repo-b" has no nWave structure at all
    When the agent calls list_concerns
    Then the response contains an empty concerns list
    And the response lists "repo-a" and "repo-b" as searched repos
    And the response is not an error

  Scenario: The same topic surfacing in two repos is deduplicated
    Given "repo-a" has a feature directory "rate-limiting"
    And "repo-b" has a feature directory "rate-limiting"
    When the agent calls list_concerns
    Then "rate-limiting" appears exactly once in the response

  Scenario: A candidate list exceeding 200 entries is capped with a truncation warning
    Given the fixture repos collectively have more than 200 distinct candidate topics
    When the agent calls list_concerns
    Then the response contains at most 200 concern entries
    And the response includes a truncation warning
