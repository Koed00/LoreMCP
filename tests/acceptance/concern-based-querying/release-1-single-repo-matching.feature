# Release 1 -- Single-Repo Keyword Match (US-CBQ-01)
#
# Driving port: lore-mcp MCP server over stdio (real subprocess).
# Driven adapter: real local filesystem fixture repos (Strategy C: Real local).
#
# Scenario count: 7
# Error/edge scenarios: 4 of 7 (57%) -- exceeds 40% target.
# Story coverage: US-CBQ-01 (all AC), US-CBQ-04 (INVALID_CONCERN).

@real-io
Feature: Agent resolves a concern against a single configured repo

  Background:
    Given lore-mcp is configured with one fixture repo entry
    And the lore-mcp server is started as a subprocess over stdio with that
      configuration

  Scenario: Agent finds a concern matched in a feature-level decision file
    Given the fixture repo has a feature-level decision file under "auth-flow"
      containing the word "auth"
    When the agent resolves the concern "auth"
    Then the response contains a match with source file under "auth-flow"
    And that match has relevance "feature-level"
    And the match snippet contains "auth"
    And the response shows the read was performed live without caching

  Scenario: Agent finds a concern matched in an architecture decision record
    Given the fixture repo has an architecture decision record containing "persistence"
    And the fixture repo has no feature-level files mentioning "persistence"
    When the agent resolves the concern "persistence"
    Then the response contains a match with relevance "architecture-level"
    And that match source file is under the architecture decisions directory

  Scenario: Agent finds a concern matched in repo conventions
    Given the fixture repo has repo conventions documentation mentioning "testing"
    And the fixture repo has no feature-level or architecture files mentioning "testing"
    When the agent resolves the concern "testing"
    Then the response contains a match with relevance "repo-conventions"

  Scenario: Feature-level match ranks above architecture-level match for same concern
    Given the fixture repo has a feature-level decision file containing "caching"
    And the fixture repo has an architecture decision record also containing "caching"
    When the agent resolves the concern "caching"
    Then the response contains at least two matches
    And the first match has relevance "feature-level"
    And a later match has relevance "architecture-level"

  Scenario: Agent receives no match found when concern is absent from all repo content
    Given the fixture repo has no files mentioning "graphql-federation"
    When the agent resolves the concern "graphql-federation"
    Then the response is an error "CONCERN_NOT_FOUND"
    And the error identifies "graphql-federation" as the concern
    And the error lists the repos that were searched
    And the response shows the read was performed live without caching

  Scenario: Agent receives invalid input error for an empty concern
    When the agent resolves the concern ""
    Then the response is an error "INVALID_CONCERN"
    And the error message explains that the concern must contain at least one letter or number
    And the response shows the read was performed live without caching

  Scenario: Agent receives invalid input error for a concern with only punctuation
    When the agent resolves the concern "???"
    Then the response is an error "INVALID_CONCERN"
    And the error message explains that the concern must contain at least one letter or number
