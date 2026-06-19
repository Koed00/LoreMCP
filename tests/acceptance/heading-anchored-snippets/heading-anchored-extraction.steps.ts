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
  path.join(import.meta.dirname, "heading-anchored-extraction.feature"),
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
      rootDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-has-"));
      fixtureDocPath = makeDocPath(rootDir, "fixture-repo");

      configDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-has-config-"));
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
      "Snippet is narrowed to the matched section in a multi-section file",
      ({ Given, And, When, Then }) => {
        Given(
          'the fixture repo has a wave-decisions.md with three "## " sections',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "infra", "design", "wave-decisions.md"),
              [
                "## D-1: deployment target",
                "",
                "We deploy via Docker Compose on a single host.",
                "",
                "## D-2: caching layer",
                "",
                "We use Redis for caching session data across requests.",
                "",
                "## D-3: logging format",
                "",
                "We emit structured JSON logs to stdout.",
              ].join("\n"),
            );
          },
        );

        And('only the second section contains the word "caching"', () => {});

        When('the agent resolves the concern "caching"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "caching" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then("the match snippet contains the second section's heading", () => {
          const match = lastResponse.matches?.find((m: any) =>
            m.source_file?.includes("infra"),
          );
          expect(match).toBeDefined();
          expect(match.snippet).toContain("## D-2: caching layer");
        });

        And(
          "the match snippet does not contain the first or third section's heading",
          () => {
            const match = lastResponse.matches?.find((m: any) =>
              m.source_file?.includes("infra"),
            );
            expect(match.snippet).not.toContain("## D-1: deployment target");
            expect(match.snippet).not.toContain("## D-3: logging format");
          },
        );
      },
    );

    Scenario(
      "Headingless file falls back to whole-file truncation",
      ({ Given, And, When, Then }) => {
        let claudeMdContent: string;

        Given("the fixture repo has a CLAUDE.md with no markdown headings", () => {
          claudeMdContent =
            "All testing uses vitest for unit and integration tests. " +
            "No markdown headings appear anywhere in this file, only prose.";
          writeFile(path.join(rootDir, "fixture-repo", "CLAUDE.md"), claudeMdContent);
        });

        And('it contains the word "testing" in prose', () => {});

        When('the agent resolves the concern "testing"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "testing" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then(
          "the match snippet is identical to today's whole-file-up-to-cap behavior",
          () => {
            const match = lastResponse.matches?.find(
              (m: any) => m.relevance === "repo-conventions",
            );
            expect(match).toBeDefined();
            expect(match.snippet).toBe(claudeMdContent);
          },
        );
      },
    );

    Scenario(
      "Concern keyword in a heading anchors the extracted section",
      ({ Given, And, When, Then }) => {
        Given(
          'the fixture repo has a wave-decisions.md with a heading "## D-auth: JWT strategy"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "auth-flow", "design", "wave-decisions.md"),
              [
                "## D-0: unrelated decision",
                "",
                "We chose a monorepo layout for simplicity.",
                "",
                "## D-auth: JWT strategy",
                "",
                "We use signed tokens for session management without mentioning the word here.",
              ].join("\n"),
            );
          },
        );

        And(
          'the word "auth" appears only in that heading, not in the section body',
          () => {},
        );

        When('the agent resolves the concern "auth"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "auth" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then(
          'the match snippet starts at the "## D-auth: JWT strategy" heading',
          () => {
            const match = lastResponse.matches?.find((m: any) =>
              m.source_file?.includes("auth-flow"),
            );
            expect(match).toBeDefined();
            expect(match.snippet.trim().startsWith("## D-auth: JWT strategy")).toBe(
              true,
            );
          },
        );
      },
    );

    Scenario(
      "Concern present in multiple sections resolves to the most keyword-dense one",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a wave-decisions.md where "rate-limiting" appears in two sections with different occurrence counts',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "api-gateway", "design", "wave-decisions.md"),
              [
                "## D-1: rate-limiting strategy",
                "",
                "rate-limiting is applied at the gateway. rate-limiting uses a token",
                "bucket algorithm. rate-limiting thresholds are configurable per route.",
                "",
                "## D-2: monitoring",
                "",
                "We also reference rate-limiting briefly here for context on alerts.",
              ].join("\n"),
            );
          },
        );

        When('the agent resolves the concern "rate-limiting"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "rate-limiting" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then("the match snippet is the section with three occurrences", () => {
          const match = lastResponse.matches?.find((m: any) =>
            m.source_file?.includes("api-gateway"),
          );
          expect(match).toBeDefined();
          expect(match.snippet).toContain("## D-1: rate-limiting strategy");
        });

        And(
          "the match snippet does not contain the section with one occurrence",
          () => {
            const match = lastResponse.matches?.find((m: any) =>
              m.source_file?.includes("api-gateway"),
            );
            expect(match.snippet).not.toContain("## D-2: monitoring");
          },
        );
      },
    );

    Scenario(
      "Matched section exceeding the size cap is truncated with a warning",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a wave-decisions.md with one section longer than the size cap containing the word "persistence"',
          () => {
            const longBody = "persistence is discussed at length here. ".repeat(250);
            writeFile(
              path.join(fixtureDocPath, "feature", "storage", "design", "wave-decisions.md"),
              ["## D-1: persistence strategy", "", longBody].join("\n"),
            );
          },
        );

        When('the agent resolves the concern "persistence"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "persistence" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then("the match snippet is truncated to the size cap", () => {
          const match = lastResponse.matches?.find((m: any) =>
            m.source_file?.includes("storage"),
          );
          expect(match).toBeDefined();
          expect(match.snippet.length).toBeLessThanOrEqual(8000);
        });

        And("a truncation warning is present in the response", () => {
          const warnings: string[] = lastResponse.warnings ?? [];
          const hasTruncationWarning = warnings.some((w: string) =>
            w.toLowerCase().includes("truncat"),
          );
          expect(hasTruncationWarning).toBe(true);
        });
      },
    );
  },
);
