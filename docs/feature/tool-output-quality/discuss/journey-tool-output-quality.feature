Feature: All four LoreMCP tools stay within usable size/signal bounds

  Background:
    Given lore-mcp is configured with a fixture repo

  Scenario: query_context caps an oversized aggregated response with a warning
    Given the fixture repo has a feature with enough wave-decisions files that their combined content exceeds the total response cap
    When the agent calls query_context for that feature
    Then the response is truncated to the total response cap
    And the response includes a truncation warning
    And the most recent wave's content is preserved over older waves

  Scenario: query_context does not truncate a normally-sized response
    Given the fixture repo has a feature with a small amount of wave-decisions content
    When the agent calls query_context for that feature
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
    When the agent calls list_features for that repo
    Then the phases for that feature include "deliver"

  Scenario: list_features omits the deliver phase when execution-log.json has no COMMIT entry
    Given the fixture repo has a feature with a deliver directory containing an execution-log.json with zero COMMIT phase entries
    When the agent calls list_features for that repo
    Then the phases for that feature do not include "deliver"

  Scenario: resolve_concern's not-found message nudges the agent toward list_concerns
    Given the fixture repo has no files mentioning a made-up concern
    When the agent resolves that concern
    Then the response is an error "CONCERN_NOT_FOUND"
    And the error message mentions "list_concerns"
