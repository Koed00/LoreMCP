Feature: Heading-anchored snippet extraction in resolve_concern

  Background:
    Given lore-mcp is configured with a fixture repo

  Scenario: Snippet is narrowed to the matched section in a multi-section file
    Given the fixture repo has a wave-decisions.md with multiple "## " sections
    And only one section contains the word "caching"
    When the agent resolves the concern "caching"
    Then the match snippet contains only that section's content
    And the match snippet does not contain unrelated sections from the same file

  Scenario: Headingless file falls back to whole-file truncation
    Given the fixture repo has a CLAUDE.md with no markdown headings
    And it contains the word "testing"
    When the agent resolves the concern "testing"
    Then the match snippet is the whole-file-up-to-cap content (today's existing behavior)

  Scenario: Concern keyword in a heading anchors the extracted section
    Given the fixture repo has a wave-decisions.md with a heading "## D-auth: JWT strategy"
    When the agent resolves the concern "auth"
    Then the match snippet starts at that heading

  Scenario: Concern present in multiple sections of the same file
    Given the fixture repo has a wave-decisions.md where "rate-limiting" appears in two separate sections
    And one section mentions "rate-limiting" three times and the other mentions it once
    When the agent resolves the concern "rate-limiting"
    Then the match snippet is the section with three mentions
    And the match snippet does not contain the section with only one mention

  Scenario: Extracted section longer than the cap is truncated with a warning
    Given the fixture repo has a wave-decisions.md with one section longer than 8000 characters containing "persistence"
    When the agent resolves the concern "persistence"
    Then the match snippet is truncated within that section
    And a truncation warning is present in the response
