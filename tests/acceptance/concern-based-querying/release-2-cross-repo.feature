# Release 2 -- Cross-Repo Scan (US-CBQ-02)
#
# Driving port: lore-mcp MCP server over stdio (real subprocess).
# Driven adapter: real local filesystem fixture repos (Strategy C: Real local).
#
# Scenario count: 4
# Error/edge scenarios: 2 of 4 (50%) -- exceeds 40% target.
# Story coverage: US-CBQ-02 (all AC).

@real-io
Feature: Agent resolves a concern across all configured repos

  Background:
    Given lore-mcp is configured with multiple fixture repo entries
    And the lore-mcp server is started as a subprocess over stdio with that
      configuration

  Scenario: Agent finds a concern present in multiple repos
    Given "repo-alpha" has a feature-level decision file containing "data persistence"
    And "repo-beta" has an architecture decision record containing "data persistence"
    When the agent resolves the concern "data persistence"
    Then the response contains matches from both "repo-alpha" and "repo-beta"
    And each match correctly identifies its source repo
    And the match from "repo-alpha" with feature-level relevance appears before
      the architecture-level match from "repo-beta"

  Scenario: Agent finds a concern in one repo but not the other
    Given "repo-alpha" has a feature-level decision file containing "logging"
    And "repo-beta" has no content mentioning "logging"
    When the agent resolves the concern "logging"
    Then the response contains matches only from "repo-alpha"
    And the response shows both repos were searched

  Scenario: Scan continues when one configured repo is unreachable
    Given "repo-alpha" has a feature-level decision file containing "observability"
    And "repo-gamma" is configured with a doc path that does not exist on disk
    When the agent resolves the concern "observability"
    Then the response contains matches from "repo-alpha"
    And the response includes a notice that "repo-gamma" was skipped
    And the response is not an error

  Scenario: Agent receives no match found when all configured repos are unreachable
    Given all configured repos have doc paths that do not exist on disk
    When the agent resolves the concern "auth"
    Then the response is an error "CONCERN_NOT_FOUND"
    And the error includes a notice for each skipped repo
    And the error lists no successfully searched repos
    And the response shows the read was performed live without caching
