# Release 2 -- Partial nWave Structure (US-04)
#
# Driving port: ab-mcp's MCP server over stdio.
# Driven adapters: real local filesystem fixture repos at 3 completeness
# levels (full, ADRs-only, CLAUDE.md-only) plus a no-structure repo
# (Strategy C: Real local).
#
# One-at-a-time: each scenario is @skip until its DELIVER TDD cycle begins.
# Error/edge scenarios: 2 of 5 (40%).

@real-io
Feature: Agent receives the best available context, with warnings when structure is incomplete

  Background:
    Given ab-mcp is configured with 4 entries: "ab-mcp" (full structure),
      "adrs-only-repo" (ADRs but no feature-level decisions), "claude-md-only-repo"
      (only a CLAUDE.md), and "no-structure-repo" (no nWave artifacts at all),
      each pointing at a real fixture repo's "docs" directory
    And the ab-mcp MCP server is started as a subprocess over stdio with that
      configuration

  Scenario: Repo with ADRs but no feature-level decisions returns ADR content with a warning
    Given "adrs-only-repo" has docs/product/architecture/ADR-0012-policy-format.md
    And "adrs-only-repo" has no docs/feature/permission-policies/ directory
    When the agent calls query_context for repo "adrs-only-repo" and feature
      "permission-policies"
    Then the response includes a result whose source file ends with
      "product/architecture/ADR-0012-policy-format.md"
    And the response includes a warning mentioning "no feature-level
      wave-decisions.md"
    And the response is not an error

  Scenario: Repo with only a CLAUDE.md returns its content with a distinct warning
    Given "claude-md-only-repo" has only a CLAUDE.md file containing a section
      "## API Conventions"
    When the agent calls query_context for repo "claude-md-only-repo" and
      feature "auth-pagination"
    Then the response includes a result whose source file ends with "CLAUDE.md"
    And that result's snippet contains "API Conventions"
    And the response includes a warning mentioning "only CLAUDE.md-level
      context"

  Scenario: Repo with zero nWave artifacts returns NO_NWAVE_STRUCTURE
    Given "no-structure-repo" contains only a README.md and a manuals/ folder
    When the agent calls query_context for repo "no-structure-repo" and
      feature "any-feature-id"
    Then the response is an error "NO_NWAVE_STRUCTURE"
    And the message explains that nWave-structured docs are required

  @skip
  Scenario: list_features reports structure-completeness flags accurately
    When the agent calls list_features for repo "adrs-only-repo"
    Then the response includes has_architecture_adrs true
    When the agent calls list_features for repo "claude-md-only-repo"
    Then the response includes has_architecture_adrs false
    And the response includes has_claude_md true

  @skip
  Scenario: Full-structure repo returns no false-positive warnings
    Given "ab-mcp" has docs/feature/ab-mcp/discover/wave-decisions.md
    When the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"
    Then the response includes no warnings entry
