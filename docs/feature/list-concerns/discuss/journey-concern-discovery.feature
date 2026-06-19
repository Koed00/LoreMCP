Feature: Agent discovers available concern topics before querying resolve_concern

  Background:
    Given lore-mcp is configured with fixture repos

  Scenario: Agent sees candidate concern topics across all configured repos
    Given the fixture repos have feature directories and ADRs with distinct topic names
    When the agent calls list_concerns()
    Then the response contains candidate concern strings drawn from feature directory names and ADR titles
    And the response lists which repos were searched

  Scenario: Repo with no nWave structure is silently excluded
    Given one fixture repo has nWave structure and another has none at all
    When the agent calls list_concerns()
    Then the response contains candidates only from the repo with nWave structure
    And the response is not an error

  Scenario: All configured repos lack nWave structure
    Given no fixture repo has any nWave structure
    When the agent calls list_concerns()
    Then the response contains an empty concerns list
    And the response lists which repos were searched
    And the response is not an error

  Scenario: Duplicate topic signals across repos are deduplicated
    Given two fixture repos both have a feature directory or ADR named after the same topic
    When the agent calls list_concerns()
    Then that topic appears only once in the response

  Scenario: Candidate list exceeding 200 entries is capped with a warning
    Given the fixture repos collectively have more than 200 distinct topic-like names
    When the agent calls list_concerns()
    Then the response contains at most 200 concern entries
    And the response includes a truncation warning
