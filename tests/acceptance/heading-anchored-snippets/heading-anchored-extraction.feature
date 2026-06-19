# Heading-Anchored Snippet Extraction (US-HAS-01)
#
# Driving port: lore-mcp MCP server over stdio (real subprocess), resolve_concern tool.
# Driven adapter: real local filesystem fixture repos (Strategy C: Real local).
#
# Scenario count: 6
# Error/edge scenarios: 2 of 6 (33%) -- below the 40% target, but scenario 6 is a
# regression scenario (upstream-issues.md Issue 1), not a new happy/error classification.
# Story coverage: US-HAS-01 (all 5 AC) + regression fix from post-merge dogfood finding.

@real-io
Feature: Agent receives a heading-anchored snippet instead of a whole-file dump

  Background:
    Given lore-mcp is configured with one fixture repo entry
    And the lore-mcp server is started as a subprocess over stdio with that
      configuration

  Scenario: Snippet is narrowed to the matched section in a multi-section file
    Given the fixture repo has a wave-decisions.md with three "## " sections
    And only the second section contains the word "caching"
    When the agent resolves the concern "caching"
    Then the match snippet contains the second section's heading
    And the match snippet does not contain the first or third section's heading

  Scenario: Headingless file falls back to whole-file truncation
    Given the fixture repo has a CLAUDE.md with no markdown headings
    And it contains the word "testing" in prose
    When the agent resolves the concern "testing"
    Then the match snippet is identical to today's whole-file-up-to-cap behavior

  Scenario: Concern keyword in a heading anchors the extracted section
    Given the fixture repo has a wave-decisions.md with a heading "## D-auth: JWT strategy"
    And the word "auth" appears only in that heading, not in the section body
    When the agent resolves the concern "auth"
    Then the match snippet starts at the "## D-auth: JWT strategy" heading

  Scenario: Concern present in multiple sections resolves to the most keyword-dense one
    Given the fixture repo has a wave-decisions.md where "rate-limiting" appears in two sections with different occurrence counts
    When the agent resolves the concern "rate-limiting"
    Then the match snippet is the section with three occurrences
    And the match snippet does not contain the section with one occurrence

  Scenario: Matched section exceeding the size cap is truncated with a warning
    Given the fixture repo has a wave-decisions.md with one section longer than the size cap containing the word "persistence"
    When the agent resolves the concern "persistence"
    Then the match snippet is truncated to the size cap
    And a truncation warning is present in the response

  Scenario: A document title heading does not steal the match from its own subsection
    Given the fixture repo has a wave-decisions.md with a single top-level title heading followed by three "## " subsections
    And only the second subsection contains the word "logging"
    When the agent resolves the concern "logging"
    Then the match snippet contains the second subsection's heading
    And the match snippet does not contain the first or third subsection's heading
    And the match snippet does not start at the top-level title heading
