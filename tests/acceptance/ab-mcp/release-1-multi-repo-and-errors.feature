# Release 1 -- Multi-Repo Retrieval + Error Paths (US-02, US-03)
#
# Driving port: ab-mcp's MCP server over stdio (same as walking-skeleton.feature).
# Driven adapters: real local filesystem fixture repos created under a temp
# directory per scenario (Strategy C: Real local).
#
# One-at-a-time: each scenario is @skip until its DELIVER TDD cycle begins.
# Error/edge scenarios: 4 of 7 (~57%) -- exceeds the 40% target.

@real-io
Feature: Agent retrieves context across multiple configured repos, with structured errors

  Background:
    Given ab-mcp is configured with 3 entries: "ab-mcp", "repo-b", and "repo-c",
      each pointing at a real fixture repo's "docs" directory
    And the ab-mcp MCP server is started as a subprocess over stdio with that
      configuration

  Scenario: Agent retrieves a feature's design decision from the second configured repo
    Given "repo-b" has a docs/feature/widgets/design/wave-decisions.md file
      containing the text "D-widget-shape: rounded corners"
    When the agent calls query_context for repo "repo-b" and feature "widgets"
    Then the response includes a result whose source file is rooted in
      "repo-b"'s configured doc path
    And that result's snippet contains "D-widget-shape: rounded corners"

  Scenario: Results from different repos do not cross-contaminate
    Given both "repo-b" and "repo-c" have a docs/feature/logging/ directory
      with different wave-decisions.md content
    When the agent calls query_context for repo "repo-b" and feature "logging"
    And the agent separately calls query_context for repo "repo-c" and
      feature "logging"
    Then the first response's source file is rooted in "repo-b"'s configured
      doc path
    And the second response's source file is rooted in "repo-c"'s configured
      doc path
    And the two responses' snippets differ

  Scenario: list_features returns distinct feature lists per repo
    When the agent calls list_features for repo "ab-mcp"
    And the agent separately calls list_features for repo "repo-b"
    Then the two responses' feature lists reflect each repo's own
      docs/feature/ contents
    And the two responses' doc paths differ, each matching that repo's
      configured path

  Scenario: Agent queries a repo name that is not configured
    When the agent calls list_features for repo "repo-not-configured"
    Then the response is an error "REPO_NOT_CONFIGURED"
    And the response's available repos include "ab-mcp", "repo-b", and "repo-c"

  @adapter-integration
  Scenario: Agent receives REPO_PATH_NOT_FOUND for a configured repo whose path moved
    Given "repo-c" is configured with a doc path that does not exist on disk
    When the agent calls query_context for repo "repo-c" and feature "anything"
    Then the response is an error "REPO_PATH_NOT_FOUND"
    And the response includes the configured path that was checked
    And the response's available repos include the other 2 configured repos

  Scenario: Agent receives FEATURE_NOT_FOUND with accurate available features
    Given "repo-b" has a docs/feature/logging/ directory but no
      docs/feature/loggin/ directory
    When the agent calls query_context for repo "repo-b" and feature "loggin"
    Then the response is an error "FEATURE_NOT_FOUND"
    And the response's available features include "logging"

  @adapter-integration
  Scenario: A permission-denied repo path never leaks a raw exception
    Given "repo-c" is configured with a doc path that exists but is not
      readable by the current user
    When the agent calls query_context for repo "repo-c" and feature "anything"
    Then the response is a structured JSON error
    And the response does not contain a raw stack trace or unhandled
      exception text
