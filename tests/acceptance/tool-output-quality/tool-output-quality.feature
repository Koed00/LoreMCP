# Tool Output Quality (US-TOQ-01 through 04)
#
# Driving port: lore-mcp MCP server over stdio (real subprocess) -- query_context,
# list_concerns, list_features, resolve_concern tools.
# Driven adapter: real local filesystem fixture repos (Strategy C: Real local).
#
# Scenario count: 8
# Error/edge scenarios: 4 of 8 (50%) -- exceeds 40% target (normal-sized response,
# legitimately-named directory, incomplete DELIVER, no-deliver-dir regression).
# Story coverage: US-TOQ-01 (all 3 AC), US-TOQ-02 (all 3 AC), US-TOQ-03 (all 3 AC),
# US-TOQ-04 (AC1). 4 independent slices, regression-recovery round.

@real-io
Feature: All four LoreMCP tools stay within usable size/signal bounds

  Background:
    Given lore-mcp is configured with one fixture repo entry
    And the lore-mcp server is started as a subprocess over stdio with that
      configuration

  Scenario: query_context caps an oversized aggregated response with a warning
    Given the fixture repo has a feature with 5 phases of wave-decisions content whose combined length exceeds the total response cap
    When the agent queries context for that feature
    Then the response is truncated to the total response cap
    And the response includes a truncation warning
    And the most recent phase's content is present in the response
    And the oldest phase's content is absent from the response

  Scenario: query_context does not truncate a normally-sized response
    Given the fixture repo has a feature with one phase of wave-decisions content well under the total response cap
    When the agent queries context for that feature
    Then the response is not truncated
    And the response includes no truncation warning

  Scenario: list_concerns filters generic heading text but keeps genuine topics
    Given the fixture repo has a wave-decisions.md with headings "Decisions", "Summary", and "D-auth: JWT strategy"
    When the agent calls list_concerns
    Then the response contains "D-auth: JWT strategy"
    And the response does not contain "Decisions"
    And the response does not contain "Summary"

  Scenario: list_concerns does not filter a feature directory literally named after a stoplist term
    Given the fixture repo has a feature directory literally named "Decisions"
    When the agent calls list_concerns
    Then the response contains "Decisions"

  Scenario: list_features reports the deliver phase when execution-log.json has a COMMIT entry
    Given the fixture repo has a feature with a deliver directory containing an execution-log.json with at least one COMMIT phase entry
    When the agent lists features for the fixture repo
    Then the phases for that feature include "deliver"

  Scenario: list_features omits the deliver phase when execution-log.json has no COMMIT entry
    Given the fixture repo has a feature with a deliver directory containing an execution-log.json with zero COMMIT phase entries
    When the agent lists features for the fixture repo
    Then the phases for that feature do not include "deliver"

  Scenario: list_features behaves identically to today when no deliver directory exists
    Given the fixture repo has a feature with design and discuss phases but no deliver directory at all
    When the agent lists features for the fixture repo
    Then the phases for that feature include "design"
    And the phases for that feature include "discuss"
    And the phases for that feature do not include "deliver"

  Scenario: resolve_concern's not-found message nudges the agent toward list_concerns
    Given the fixture repo has no files mentioning a made-up concern
    When the agent resolves that concern
    Then the response is an error "CONCERN_NOT_FOUND"
    And the error message mentions "list_concerns"
