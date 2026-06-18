import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  startAbMcp,
  parseToolJson,
  type AbMcpHandle,
} from "../ab-mcp/support/mcp-client.js";

const feature = await loadFeature(
  path.join(import.meta.dirname, "release-1-single-repo-matching.feature"),
);

function makeDocPath(rootDir: string, repoName: string): string {
  return path.join(rootDir, repoName, "docs");
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

describeFeature(
  feature,
  ({ Background, BeforeEachScenario, AfterEachScenario, Scenario }) => {
    let rootDir: string;
    let configDir: string;
    let configPath: string;
    let handle: AbMcpHandle | undefined;
    let lastResponse: any;
    let fixtureDocPath: string;

    Background(({ Given, And }) => {
      Given("lore-mcp is configured with one fixture repo entry", () => {});
      And(
        "the lore-mcp server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      rootDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-r1-"));
      fixtureDocPath = makeDocPath(rootDir, "fixture-repo");

      configDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-r1-config-"));
      configPath = path.join(configDir, "lore-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify([
          { "repo-name": "fixture-repo", "doc-path": fixtureDocPath },
        ]),
      );

      handle = await startAbMcp(configPath);
    });

    AfterEachScenario(async () => {
      await handle?.close();
      handle = undefined;
      if (configDir) rmSync(configDir, { recursive: true, force: true });
      if (rootDir) rmSync(rootDir, { recursive: true, force: true });
    });

    Scenario(
      "Agent finds a concern matched in a feature-level decision file",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a feature-level decision file under "auth-flow"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "auth-flow", "design", "wave-decisions.md"),
              "# auth-flow decisions\n\nD-auth: We use auth tokens for session management.\n",
            );
          },
        );

        When('the agent resolves the concern "auth"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "auth" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains a match with source file under "auth-flow"', () => {
          const match = lastResponse.matches?.find((m: any) =>
            m.source_file?.includes("auth-flow"),
          );
          expect(match).toBeDefined();
        });

        And('that match has relevance "feature-level"', () => {
          const match = lastResponse.matches.find((m: any) =>
            m.source_file?.includes("auth-flow"),
          );
          expect(match.relevance).toBe("feature-level");
        });

        And('the match snippet contains "auth"', () => {
          const match = lastResponse.matches.find((m: any) =>
            m.source_file?.includes("auth-flow"),
          );
          expect(match.snippet).toContain("auth");
        });

        And("the response shows the read was performed live without caching", () => {
          expect(lastResponse.retrieved_at).toMatch(/live/i);
        });
      },
    );

    Scenario(
      "Agent finds a concern matched in an architecture decision record",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has an architecture decision record containing "persistence"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "product", "architecture", "ADR-0001-persistence.md"),
              "# ADR-0001: persistence\n\nWe chose PostgreSQL for data persistence.\n",
            );
          },
        );

        And(
          'the fixture repo has no feature-level files mentioning "persistence"',
          () => {
            // No feature directory created -- ADR only.
          },
        );

        When('the agent resolves the concern "persistence"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "persistence" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains a match with relevance "architecture-level"', () => {
          const match = lastResponse.matches?.find(
            (m: any) => m.relevance === "architecture-level",
          );
          expect(match).toBeDefined();
        });

        And("that match source file is under the architecture decisions directory", () => {
          const match = lastResponse.matches.find(
            (m: any) => m.relevance === "architecture-level",
          );
          expect(match.source_file).toContain("architecture");
        });
      },
    );

    Scenario(
      "Agent finds a concern matched in repo conventions",
      ({ Given, When, Then }) => {
        Given(
          'the fixture repo has repo conventions documentation mentioning "testing"',
          () => {
            writeFile(
              path.join(rootDir, "fixture-repo", "CLAUDE.md"),
              "# Repo conventions\n\nAll testing uses vitest for unit and integration tests.\n",
            );
          },
        );

        And(
          'the fixture repo has no feature-level or architecture files mentioning "testing"',
          () => {
            // No feature or ADR directories created.
          },
        );

        When('the agent resolves the concern "testing"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "testing" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains a match with relevance "repo-conventions"', () => {
          const match = lastResponse.matches?.find(
            (m: any) => m.relevance === "repo-conventions",
          );
          expect(match).toBeDefined();
        });
      },
    );

    Scenario(
      "Feature-level match ranks above architecture-level match for same concern",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a feature-level decision file containing "caching"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "cache-layer", "design", "wave-decisions.md"),
              "# cache-layer decisions\n\nD-caching: We use Redis for caching.\n",
            );
          },
        );

        And(
          'the fixture repo has an architecture decision record also containing "caching"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "product", "architecture", "ADR-0002-caching.md"),
              "# ADR-0002: caching strategy\n\nCaching is handled at the application layer.\n",
            );
          },
        );

        When('the agent resolves the concern "caching"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "caching" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then("the response contains at least two matches", () => {
          expect(lastResponse.matches?.length).toBeGreaterThanOrEqual(2);
        });

        And('the first match has relevance "feature-level"', () => {
          expect(lastResponse.matches[0].relevance).toBe("feature-level");
        });

        And('a later match has relevance "architecture-level"', () => {
          const archMatch = lastResponse.matches.find(
            (m: any) => m.relevance === "architecture-level",
          );
          expect(archMatch).toBeDefined();
          expect(lastResponse.matches.indexOf(archMatch)).toBeGreaterThan(0);
        });
      },
    );

    Scenario(
      "Agent receives no match found when concern is absent from all repo content",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has no files mentioning "graphql-federation"',
          () => {
            // BeforeEachScenario creates an empty fixture repo with no content.
            writeFile(
              path.join(fixtureDocPath, "feature", "unrelated", "design", "wave-decisions.md"),
              "# unrelated\n\nThis document discusses REST APIs.\n",
            );
          },
        );

        When('the agent resolves the concern "graphql-federation"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "graphql-federation" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response is an error "CONCERN_NOT_FOUND"', () => {
          expect(lastResponse.error).toBe("CONCERN_NOT_FOUND");
        });

        And('the error identifies "graphql-federation" as the concern', () => {
          expect(lastResponse.concern).toBe("graphql-federation");
        });

        And("the error lists the repos that were searched", () => {
          expect(Array.isArray(lastResponse.searched_repos)).toBe(true);
          expect(lastResponse.searched_repos).toContain("fixture-repo");
        });

        And("the response shows the read was performed live without caching", () => {
          expect(lastResponse.retrieved_at).toMatch(/live/i);
        });
      },
    );

    Scenario(
      "Agent receives invalid input error for an empty concern",
      ({ When, Then, And }) => {
        When('the agent resolves the concern ""', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response is an error "INVALID_CONCERN"', () => {
          expect(lastResponse.error).toBe("INVALID_CONCERN");
        });

        And(
          "the error message explains that the concern must contain at least one letter or number",
          () => {
            expect(lastResponse.message).toMatch(/alphanumeric|letter|number/i);
          },
        );

        And("the response shows the read was performed live without caching", () => {
          expect(lastResponse.retrieved_at).toMatch(/live/i);
        });
      },
    );

    Scenario(
      'Agent receives invalid input error for a concern with only punctuation',
      ({ When, Then, And }) => {
        When('the agent resolves the concern "???"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "???" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response is an error "INVALID_CONCERN"', () => {
          expect(lastResponse.error).toBe("INVALID_CONCERN");
        });

        And(
          "the error message explains that the concern must contain at least one letter or number",
          () => {
            expect(lastResponse.message).toMatch(/alphanumeric|letter|number/i);
          },
        );
      },
    );
  },
);
