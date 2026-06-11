Feature: Cross-Repo Context Retrieval via ab-mcp
  As an AI coding agent working in Repo A
  I want to retrieve relevant, current, source-attributed documentation
  from sibling repos (Repo B/C/D) configured in ab-mcp
  So that I can ground my work in those repos' established conventions
  without manual copy-paste and without staleness

  Background:
    Given ab-mcp is running with a config containing a list of
      {repo-name, doc-path} entries

  Scenario: Agent recognizes a cross-repo question
    Given an AI coding agent is implementing pagination in Repo A
    When the agent determines the pagination convention was decided elsewhere
    Then the agent plans to query ab-mcp for cross-repo context

  Scenario: Agent lists features available in a configured sibling repo
    Given ab-mcp is configured with repo "backend-service" pointing at
      "/Users/dev/code/backend-service/docs"
    And "backend-service" has a docs/feature/auth-pagination/ directory
    When the agent calls list_features("backend-service")
    Then the response includes feature_id "auth-pagination"
    And the response includes "has_architecture_adrs": true if
      docs/product/architecture/ exists
    And the response includes "doc_path" matching the configured path

  Scenario: Configured repo path does not exist on disk
    Given ab-mcp is configured with repo "billing-service" pointing at
      "/Users/dev/code/billing-service/docs"
    And that path does not exist on disk
    When the agent calls list_features("billing-service")
    Then the response is an error "REPO_PATH_NOT_FOUND"
    And the response includes the configured_path that was checked
    And the response includes available_repos from the rest of the config

  Scenario: Configured repo has no nWave documentation structure
    Given ab-mcp is configured with repo "legacy-payments" pointing at
      "/Users/dev/code/legacy-payments/docs"
    And that path exists but contains no docs/feature/**/wave-decisions.md,
      no docs/product/architecture/, and no CLAUDE.md
    When the agent calls list_features("legacy-payments")
    Then the response is an error "NO_NWAVE_STRUCTURE"
    And the message explains MVP requires nWave-structured docs

  Scenario: Agent retrieves wave decisions and ADR context for a known feature
    Given ab-mcp is configured with repo "backend-service" pointing at
      "/Users/dev/code/backend-service/docs"
    And "backend-service" has docs/feature/auth-pagination/design/wave-decisions.md
      containing "Cursor-based pagination... opaque cursor tokens"
    And "backend-service" has docs/product/architecture/ADR-0007-pagination.md
      containing "Decision: cursor-based over offset-based"
    When the agent calls query_context("backend-service", "auth-pagination")
    Then the response includes a result with source_file ending in
      "feature/auth-pagination/design/wave-decisions.md"
    And the response includes a result with source_file ending in
      "product/architecture/ADR-0007-pagination.md"
    And each result's snippet contains the relevant decision text
    And "retrieved_at" indicates a live (uncached) read

  Scenario: Requested feature_id does not exist in the target repo
    Given ab-mcp is configured with repo "frontend-web" pointing at
      "/Users/dev/code/frontend-web/docs"
    And "frontend-web" has no docs/feature/auth-pagination/ directory
    When the agent calls query_context("frontend-web", "auth-pagination")
    Then the response is an error "FEATURE_NOT_FOUND"
    And the response includes available_features from "frontend-web"

  Scenario: Repo has ADRs but no wave-decisions.md for the feature (partial nWave structure)
    Given ab-mcp is configured with repo "cerbos" pointing at
      "/Users/dev/code/cerbos/docs"
    And "cerbos" has docs/product/architecture/ADR-0012-policy-format.md
    And "cerbos" has no docs/feature/permission-policies/wave-decisions.md
    When the agent calls query_context("cerbos", "permission-policies")
    Then the response includes a result sourced from
      "product/architecture/ADR-0012-policy-format.md"
    And the response includes a warning that no feature-level wave-decisions.md
      was found
    And the response is not an error

  Scenario: Repo has only CLAUDE.md (minimal nWave structure)
    Given ab-mcp is configured with repo "frontend-mobile" pointing at
      "/Users/dev/code/frontend-mobile/docs"
    And "frontend-mobile" has only a CLAUDE.md file with a section on
      "API conventions"
    When the agent calls query_context("frontend-mobile", "auth-pagination")
    Then the response includes a result sourced from "CLAUDE.md"
    And the response includes a warning that only CLAUDE.md-level context
      was found

  Scenario: Agent grounds its implementation decision with source attribution
    Given the agent received a query_context response with results from
      "backend-service/docs/product/architecture/ADR-0007-pagination.md"
    When the agent implements pagination for Repo A's /api/v2/orders endpoint
    Then the agent's implementation uses cursor-based pagination
    And the agent's explanation cites
      "backend-service/docs/product/architecture/ADR-0007-pagination.md"
      as the source of the convention

  Scenario: Agent surfaces a caveat when context is partial
    Given the agent received a query_context response with a warnings array
      stating "no feature-level wave-decisions.md found"
    When the agent uses the returned ADR-only context to make a decision
    Then the agent's response to the developer includes the caveat that
      only architecture-level (ADR) context was available
    And the agent does not present the decision as fully feature-grounded
