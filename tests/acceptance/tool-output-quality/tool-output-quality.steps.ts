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
  path.join(import.meta.dirname, "tool-output-quality.feature"),
);

function makeDocPath(rootDir: string, repoName: string): string {
  return path.join(rootDir, repoName, "docs");
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  writeFile(filePath, JSON.stringify(value, null, 2));
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
      rootDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-toq-"));
      fixtureDocPath = makeDocPath(rootDir, "fixture-repo");

      configDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-toq-config-"));
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
      "query_context caps an oversized aggregated response with a warning",
      ({ Given, When, Then, And }) => {
        Given(
          "the fixture repo has a feature with 5 phases of wave-decisions content whose combined length exceeds the total response cap",
          () => {
            const phases = ["discover", "discuss", "design", "devops", "distill"];
            phases.forEach((phase, index) => {
              const longBody = `phase ${phase} decision content. `.repeat(400);
              writeFile(
                path.join(fixtureDocPath, "feature", "deep-history", phase, "wave-decisions.md"),
                `# ${phase} decisions (phase index ${index})\n\n${longBody}`,
              );
            });
          },
        );

        When("the agent queries context for that feature", async () => {
          const result = await handle!.client.callTool({
            name: "query_context",
            arguments: { repo_name: "fixture-repo", feature_id: "deep-history" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then("the response is truncated to the total response cap", () => {
          const totalLength = (lastResponse.results ?? []).reduce(
            (sum: number, r: any) => sum + (r.snippet?.length ?? 0),
            0,
          );
          expect(totalLength).toBeLessThanOrEqual(24000);
        });

        And("the response includes a truncation warning", () => {
          const warnings: string[] = lastResponse.warnings ?? [];
          expect(warnings.some((w) => w.toLowerCase().includes("truncat"))).toBe(true);
        });

        And("the most recent phase's content is present in the response", () => {
          const hasDistill = (lastResponse.results ?? []).some((r: any) =>
            r.source_file?.includes("distill"),
          );
          expect(hasDistill).toBe(true);
        });

        And("the oldest phase's content is absent from the response", () => {
          const hasDiscover = (lastResponse.results ?? []).some((r: any) =>
            r.source_file?.includes("discover"),
          );
          expect(hasDiscover).toBe(false);
        });
      },
    );

    Scenario(
      "query_context does not truncate a normally-sized response",
      ({ Given, When, Then, And }) => {
        Given(
          "the fixture repo has a feature with one phase of wave-decisions content well under the total response cap",
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "small-feature", "design", "wave-decisions.md"),
              "# small-feature decisions\n\nD-1: a short decision.\n",
            );
          },
        );

        When("the agent queries context for that feature", async () => {
          const result = await handle!.client.callTool({
            name: "query_context",
            arguments: { repo_name: "fixture-repo", feature_id: "small-feature" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then("the response is not truncated", () => {
          const result = (lastResponse.results ?? [])[0];
          expect(result?.snippet).toBe("# small-feature decisions\n\nD-1: a short decision.\n");
        });

        And("the response includes no truncation warning", () => {
          const warnings: string[] = lastResponse.warnings ?? [];
          expect(warnings.some((w) => w.toLowerCase().includes("truncat"))).toBe(false);
        });
      },
    );

    Scenario(
      "list_concerns filters generic heading text but keeps genuine topics",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a wave-decisions.md with headings "Decisions", "Summary", and "D-auth: JWT strategy"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "auth-flow", "design", "wave-decisions.md"),
              [
                "## Decisions",
                "",
                "We made some decisions.",
                "",
                "## Summary",
                "",
                "Here is a summary.",
                "",
                "## D-auth: JWT strategy",
                "",
                "We use signed tokens.",
              ].join("\n"),
            );
          },
        );

        When("the agent calls list_concerns", async () => {
          const result = await handle!.client.callTool({ name: "list_concerns", arguments: {} });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains "D-auth: JWT strategy"', () => {
          expect(lastResponse.concerns ?? []).toContain("D-auth: JWT strategy");
        });

        And('the response does not contain "Decisions"', () => {
          expect(lastResponse.concerns ?? []).not.toContain("Decisions");
        });

        And('the response does not contain "Summary"', () => {
          expect(lastResponse.concerns ?? []).not.toContain("Summary");
        });
      },
    );

    Scenario(
      "list_concerns does not filter a feature directory literally named after a stoplist term",
      ({ Given, When, Then }) => {
        Given(
          'the fixture repo has a feature directory literally named "Decisions"',
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "Decisions", "design", "wave-decisions.md"),
              "# Decisions feature\n\nD-1: this feature is literally named Decisions.\n",
            );
          },
        );

        When("the agent calls list_concerns", async () => {
          const result = await handle!.client.callTool({ name: "list_concerns", arguments: {} });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains "Decisions"', () => {
          expect(lastResponse.concerns ?? []).toContain("Decisions");
        });
      },
    );

    Scenario(
      "list_features reports the deliver phase when execution-log.json has a COMMIT entry",
      ({ Given, When, Then }) => {
        Given(
          "the fixture repo has a feature with a deliver directory containing an execution-log.json with at least one COMMIT phase entry",
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "shipped-feature", "design", "wave-decisions.md"),
              "# shipped-feature decisions\n\nD-1: decided.\n",
            );
            writeJson(
              path.join(fixtureDocPath, "feature", "shipped-feature", "deliver", "execution-log.json"),
              {
                schema_version: "3.0",
                feature_id: "shipped-feature",
                events: [
                  { sid: "01-01", p: "PREPARE", s: "EXECUTED", d: "PASS", t: "2026-06-19T00:00:00Z" },
                  { sid: "01-01", p: "COMMIT", s: "EXECUTED", d: "PASS", t: "2026-06-19T00:00:01Z" },
                ],
              },
            );
          },
        );

        When("the agent lists features for the fixture repo", async () => {
          const result = await handle!.client.callTool({
            name: "list_features",
            arguments: { repo_name: "fixture-repo" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the phases for that feature include "deliver"', () => {
          const f = (lastResponse.features ?? []).find((x: any) => x.feature_id === "shipped-feature");
          expect(f?.phases ?? []).toContain("deliver");
        });
      },
    );

    Scenario(
      "list_features omits the deliver phase when execution-log.json has no COMMIT entry",
      ({ Given, When, Then }) => {
        Given(
          "the fixture repo has a feature with a deliver directory containing an execution-log.json with zero COMMIT phase entries",
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "mid-deliver", "design", "wave-decisions.md"),
              "# mid-deliver decisions\n\nD-1: decided.\n",
            );
            writeJson(
              path.join(fixtureDocPath, "feature", "mid-deliver", "deliver", "execution-log.json"),
              {
                schema_version: "3.0",
                feature_id: "mid-deliver",
                events: [
                  { sid: "01-01", p: "PREPARE", s: "EXECUTED", d: "PASS", t: "2026-06-19T00:00:00Z" },
                  { sid: "01-01", p: "RED_ACCEPTANCE", s: "EXECUTED", d: "PASS", t: "2026-06-19T00:00:01Z" },
                ],
              },
            );
          },
        );

        When("the agent lists features for the fixture repo", async () => {
          const result = await handle!.client.callTool({
            name: "list_features",
            arguments: { repo_name: "fixture-repo" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the phases for that feature do not include "deliver"', () => {
          const f = (lastResponse.features ?? []).find((x: any) => x.feature_id === "mid-deliver");
          expect(f?.phases ?? []).not.toContain("deliver");
        });
      },
    );

    Scenario(
      "list_features behaves identically to today when no deliver directory exists",
      ({ Given, When, Then, And }) => {
        Given(
          "the fixture repo has a feature with design and discuss phases but no deliver directory at all",
          () => {
            writeFile(
              path.join(fixtureDocPath, "feature", "no-deliver-yet", "design", "wave-decisions.md"),
              "# no-deliver-yet design decisions\n\nD-1: decided.\n",
            );
            writeFile(
              path.join(fixtureDocPath, "feature", "no-deliver-yet", "discuss", "wave-decisions.md"),
              "# no-deliver-yet discuss decisions\n\nD-2: discussed.\n",
            );
          },
        );

        When("the agent lists features for the fixture repo", async () => {
          const result = await handle!.client.callTool({
            name: "list_features",
            arguments: { repo_name: "fixture-repo" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the phases for that feature include "design"', () => {
          const f = (lastResponse.features ?? []).find((x: any) => x.feature_id === "no-deliver-yet");
          expect(f?.phases ?? []).toContain("design");
        });

        And('the phases for that feature include "discuss"', () => {
          const f = (lastResponse.features ?? []).find((x: any) => x.feature_id === "no-deliver-yet");
          expect(f?.phases ?? []).toContain("discuss");
        });

        And('the phases for that feature do not include "deliver"', () => {
          const f = (lastResponse.features ?? []).find((x: any) => x.feature_id === "no-deliver-yet");
          expect(f?.phases ?? []).not.toContain("deliver");
        });
      },
    );

    Scenario(
      "resolve_concern's not-found message nudges the agent toward list_concerns",
      ({ Given, When, Then, And }) => {
        Given("the fixture repo has no files mentioning a made-up concern", () => {
          writeFile(
            path.join(fixtureDocPath, "feature", "unrelated", "design", "wave-decisions.md"),
            "# unrelated\n\nThis document discusses something else entirely.\n",
          );
        });

        When("the agent resolves that concern", async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "rate-limiting" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response is an error "CONCERN_NOT_FOUND"', () => {
          expect(lastResponse.error).toBe("CONCERN_NOT_FOUND");
        });

        And('the error message mentions "list_concerns"', () => {
          expect(lastResponse.message).toContain("list_concerns");
        });
      },
    );
  },
);
