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
  path.join(import.meta.dirname, "release-3-rejected-paths.feature"),
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
      rootDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-r3-"));
      fixtureDocPath = makeDocPath(rootDir, "fixture-repo");

      configDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-r3-config-"));
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
      "Rejected alternative surfaced from an architecture decision record",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has an architecture decision record for "auth" that',
          () => {
            writeFile(
              path.join(fixtureDocPath, "product", "architecture", "ADR-0007-auth-strategy.md"),
              [
                "# ADR-0007: auth strategy",
                "",
                "We selected JWT for auth session management.",
                "",
                "## Rejected Alternatives",
                "",
                "Rejected: OAuth2 — too complex for solo OSS maintainer. The auth",
                "overhead of OAuth2 does not justify the added complexity for this project.",
              ].join("\n"),
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

        Then("the response includes at least one rejected path", () => {
          expect(Array.isArray(lastResponse.rejected_paths)).toBe(true);
          expect(lastResponse.rejected_paths.length).toBeGreaterThan(0);
        });

        And("that rejected path source file is the architecture decision record", () => {
          const rp = lastResponse.rejected_paths[0];
          expect(rp.source_file).toContain("ADR-0007");
        });

        And('that rejected path snippet contains "OAuth2"', () => {
          const rp = lastResponse.rejected_paths[0];
          expect(rp.snippet).toContain("OAuth2");
        });

        And('that rejected path type is "rejected_alternative"', () => {
          const rp = lastResponse.rejected_paths[0];
          expect(rp.type).toBe("rejected_alternative");
        });
      },
    );

    Scenario(
      "Out-of-scope decision surfaced from a feature-level decision file",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a feature-level decision file for "ab-mcp" that',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "ab-mcp", "discuss", "wave-decisions.md"),
              [
                "# ab-mcp decisions",
                "",
                "D-scope: This tool provides live read access to nWave artifacts.",
                "",
                "Out of scope: caching/invalidation layer. Adding caching would",
                "contradict ADR-004 and is not justified at this scale.",
              ].join("\n"),
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

        Then("the response includes at least one rejected path", () => {
          expect(Array.isArray(lastResponse.rejected_paths)).toBe(true);
          expect(lastResponse.rejected_paths.length).toBeGreaterThan(0);
        });

        And('that rejected path snippet contains "caching"', () => {
          const hasSnippet = lastResponse.rejected_paths.some((rp: any) =>
            rp.snippet?.toLowerCase().includes("caching"),
          );
          expect(hasSnippet).toBe(true);
        });

        And('that rejected path type is "rejected_alternative"', () => {
          const rp = lastResponse.rejected_paths[0];
          expect(rp.type).toBe("rejected_alternative");
        });
      },
    );

    Scenario(
      "A file can appear in both matches and rejected paths for the same concern",
      ({ Given, When, Then, And }) => {
        Given(
          "the fixture repo has an architecture decision record that accepts \"auth\"",
          () => {
            writeFile(
              path.join(fixtureDocPath, "product", "architecture", "ADR-0007-auth-strategy.md"),
              [
                "# ADR-0007: auth strategy",
                "",
                "We chose JWT for auth. This approach is lightweight and fits our needs.",
                "",
                "## Rejected Alternatives",
                "",
                "Rejected: OAuth2 — auth via OAuth2 was considered but rejected due to",
                "complexity not justified for this project.",
              ].join("\n"),
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

        Then(
          "the same source file appears in both the matches list and the rejected paths list",
          () => {
            const matchSourceFiles = lastResponse.matches?.map((m: any) => m.source_file) ?? [];
            const rejectedSourceFiles =
              lastResponse.rejected_paths?.map((rp: any) => rp.source_file) ?? [];
            const overlap = matchSourceFiles.filter((sf: string) =>
              rejectedSourceFiles.includes(sf),
            );
            expect(overlap.length).toBeGreaterThan(0);
          },
        );

        And("the match entry carries the full-file snippet", () => {
          const adrMatch = lastResponse.matches?.find((m: any) =>
            m.source_file?.includes("ADR-0007"),
          );
          expect(adrMatch).toBeDefined();
          // Full-file snippet contains both the accepted decision and the rejection section.
          expect(adrMatch.snippet).toContain("JWT");
          expect(adrMatch.snippet).toContain("OAuth2");
        });

        And("the rejected path entry carries only the rejection paragraph", () => {
          const adrRejected = lastResponse.rejected_paths?.find((rp: any) =>
            rp.source_file?.includes("ADR-0007"),
          );
          expect(adrRejected).toBeDefined();
          // The rejection snippet is the paragraph containing the rejection keyword.
          expect(adrRejected.snippet).toContain("OAuth2");
        });
      },
    );

    Scenario(
      "Rejected paths field is present and empty when no rejection language exists",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a feature-level decision file containing "logging"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "logging", "design", "wave-decisions.md"),
              "# logging decisions\n\nD-logging: We use structured JSON output for all log lines.\n",
            );
          },
        );

        When('the agent resolves the concern "logging"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "logging" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains matches for "logging"', () => {
          expect(lastResponse.matches?.length).toBeGreaterThan(0);
        });

        And("the rejected paths field is present and contains no entries", () => {
          expect(lastResponse.rejected_paths).toBeDefined();
          expect(Array.isArray(lastResponse.rejected_paths)).toBe(true);
          expect(lastResponse.rejected_paths.length).toBe(0);
        });
      },
    );

    Scenario(
      "Agent receives partial-structure warning when only architecture-level matches exist",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has an architecture decision record containing "rate-limiting"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "product", "architecture", "ADR-0003-rate-limiting.md"),
              "# ADR-0003: rate-limiting\n\nWe apply rate-limiting at the API gateway layer.\n",
            );
          },
        );

        And(
          'the fixture repo has no feature-level files mentioning "rate-limiting"',
          () => {
            // No feature directory created -- ADR only.
          },
        );

        When('the agent resolves the concern "rate-limiting"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "rate-limiting" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains a match with relevance "architecture-level"', () => {
          const match = lastResponse.matches?.find(
            (m: any) => m.relevance === "architecture-level",
          );
          expect(match).toBeDefined();
        });

        And("the response includes a warning about the absence of feature-level decisions", () => {
          const warnings: string[] = lastResponse.warnings ?? [];
          const hasPartialWarning = warnings.some((w: string) =>
            w.toLowerCase().includes("feature-level") ||
            w.toLowerCase().includes("no feature"),
          );
          expect(hasPartialWarning).toBe(true);
        });

        And("the response is not an error", () => {
          expect(lastResponse.error).toBeUndefined();
        });
      },
    );
  },
);
