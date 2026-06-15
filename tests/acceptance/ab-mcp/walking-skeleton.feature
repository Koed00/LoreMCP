# Walking Skeleton -- ab-mcp (US-01, Feature 0 / slice-00)
#
# Driving port: ab-mcp's MCP server over stdio (the real `npx ab-mcp` /
# `node dist/index.js` entry point). Every scenario below spawns the server
# as a real subprocess and talks to it via the MCP protocol -- no scenario
# calls handler functions directly (Driving Adapter Verification).
#
# Driven adapter: the real local filesystem, rooted at this repo's own
# `docs/` tree (dogfooding -- ab-mcp is its own first user, per US-01).

@real-io
Feature: Agent retrieves ab-mcp's own wave decisions through the MCP server

  Background:
    Given ab-mcp is configured with one entry: repo "ab-mcp" pointing at this
      repository's own "docs" directory
    And the ab-mcp MCP server is started as a subprocess over stdio with that
      configuration

  @walking_skeleton @real-io @driving_adapter @adapter-integration
  Scenario: Agent retrieves the Critical Reframe decision text end-to-end
    When the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"
    Then the response includes a result whose source file ends with
      "docs/feature/ab-mcp/discover/wave-decisions.md"
    And that result's snippet contains "Critical Reframe"
    And the response indicates a live, uncached read

  @real-io
  Scenario: Server boots and exposes both tools to the calling agent
    Then both "list_features" and "query_context" are available as callable
      tools

  @real-io
  Scenario: Agent discovers ab-mcp's own feature documentation
    When the agent calls list_features for repo "ab-mcp"
    Then the response includes feature "ab-mcp"
    And the response's doc path matches the configured path
    And the response includes phase "discover" for feature "ab-mcp"
