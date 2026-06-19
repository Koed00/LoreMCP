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
  path.join(import.meta.dirname, "list-concerns-discovery.feature"),
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
    let docPathA: string;
    let docPathB: string;

    Background(({ Given, And }) => {
      Given("lore-mcp is configured with fixture repo entries", () => {});
      And(
        "the lore-mcp server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      rootDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-lc-"));
      docPathA = makeDocPath(rootDir, "repo-a");
      docPathB = makeDocPath(rootDir, "repo-b");

      configDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-lc-config-"));
      configPath = path.join(configDir, "lore-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify([
          { "repo-name": "repo-a", "doc-path": docPathA },
          { "repo-name": "repo-b", "doc-path": docPathB },
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

    async function callListConcerns(): Promise<void> {
      const result = await handle!.client.callTool({
        name: "list_concerns",
        arguments: {},
      });
      lastResponse = parseToolJson(result as any);
    }

    Scenario(
      "Candidate topics are drawn from feature directories and ADR titles across repos",
      ({ Given, And, When, Then }) => {
        Given('"repo-a" has feature directories "auth-flow" and "rate-limiting"', () => {
          writeFile(
            path.join(docPathA, "feature", "auth-flow", "design", "wave-decisions.md"),
            "# auth-flow decisions\n\nD-auth: We use JWT.\n",
          );
          writeFile(
            path.join(docPathA, "feature", "rate-limiting", "design", "wave-decisions.md"),
            "# rate-limiting decisions\n\nD-rl: Token bucket algorithm.\n",
          );
        });

        And(
          '"repo-a" has an architecture decision record titled "Concern Matching Strategy"',
          () => {
            writeFile(
              path.join(docPathA, "product", "architecture", "adr-005-concern-matching-strategy.md"),
              "# ADR-005: Concern Matching Strategy\n\nWe use keyword matching.\n",
            );
          },
        );

        When("the agent calls list_concerns", async () => {
          await callListConcerns();
        });

        Then('the response contains "auth-flow"', () => {
          expect((lastResponse.concerns ?? [])).toContain("auth-flow");
        });

        And('the response contains "rate-limiting"', () => {
          expect((lastResponse.concerns ?? [])).toContain("rate-limiting");
        });

        And('the response contains "Concern Matching Strategy"', () => {
          expect((lastResponse.concerns ?? [])).toContain("Concern Matching Strategy");
        });

        And('the response lists "repo-a" as a searched repo', () => {
          expect((lastResponse.searched_repos ?? [])).toContain("repo-a");
        });
      },
    );

    Scenario(
      "A structureless repo is silently excluded, not an error",
      ({ Given, And, When, Then }) => {
        Given('"repo-a" has a feature directory "auth-flow"', () => {
          writeFile(
            path.join(docPathA, "feature", "auth-flow", "design", "wave-decisions.md"),
            "# auth-flow decisions\n\nD-auth: We use JWT.\n",
          );
        });

        And('"repo-b" has no nWave structure at all', () => {
          // BeforeEachScenario does not create docPathB unless a file is written --
          // leaving it absent on disk reproduces "no nWave structure at all".
        });

        When("the agent calls list_concerns", async () => {
          await callListConcerns();
        });

        Then('the response contains "auth-flow"', () => {
          expect((lastResponse.concerns ?? [])).toContain("auth-flow");
        });

        And('the response lists "repo-a" as a searched repo', () => {
          expect((lastResponse.searched_repos ?? [])).toContain("repo-a");
        });

        And("the response is not an error", () => {
          expect(lastResponse.error).toBeUndefined();
        });
      },
    );

    Scenario(
      "All configured repos lack nWave structure",
      ({ Given, And, When, Then }) => {
        Given('"repo-a" has no nWave structure at all', () => {});
        And('"repo-b" has no nWave structure at all', () => {});

        When("the agent calls list_concerns", async () => {
          await callListConcerns();
        });

        Then("the response contains an empty concerns list", () => {
          expect((lastResponse.concerns ?? ["__unset__"])).toEqual([]);
        });

        And('the response lists "repo-a" and "repo-b" as searched repos', () => {
          expect((lastResponse.searched_repos ?? [])).toEqual(
            expect.arrayContaining(["repo-a", "repo-b"]),
          );
        });

        And("the response is not an error", () => {
          expect(lastResponse.error).toBeUndefined();
        });
      },
    );

    Scenario(
      "The same topic surfacing in two repos is deduplicated",
      ({ Given, And, When, Then }) => {
        Given('"repo-a" has a feature directory "rate-limiting"', () => {
          writeFile(
            path.join(docPathA, "feature", "rate-limiting", "design", "wave-decisions.md"),
            "# rate-limiting decisions\n\nD-rl: Token bucket at the gateway.\n",
          );
        });

        And('"repo-b" has a feature directory "rate-limiting"', () => {
          writeFile(
            path.join(docPathB, "feature", "rate-limiting", "design", "wave-decisions.md"),
            "# rate-limiting decisions\n\nD-rl: Sliding window at the edge.\n",
          );
        });

        When("the agent calls list_concerns", async () => {
          await callListConcerns();
        });

        Then('"rate-limiting" appears exactly once in the response', () => {
          const occurrences = (lastResponse.concerns ?? []).filter(
            (c: string) => c === "rate-limiting",
          );
          expect(occurrences.length).toBe(1);
        });
      },
    );

    Scenario(
      "A candidate list exceeding 200 entries is capped with a truncation warning",
      ({ Given, When, Then, And }) => {
        Given("the fixture repos collectively have more than 200 distinct candidate topics", () => {
          for (let i = 0; i < 210; i++) {
            writeFile(
              path.join(docPathA, "feature", `topic-${i}`, "design", "wave-decisions.md"),
              `# topic-${i} decisions\n\nD-${i}: placeholder decision.\n`,
            );
          }
        });

        When("the agent calls list_concerns", async () => {
          await callListConcerns();
        });

        Then("the response contains at most 200 concern entries", () => {
          expect((lastResponse.concerns ?? []).length).toBeLessThanOrEqual(200);
        });

        And("the response includes a truncation warning", () => {
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
