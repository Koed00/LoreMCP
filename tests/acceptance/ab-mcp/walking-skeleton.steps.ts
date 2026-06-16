import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  startAbMcp,
  repoPath,
  parseToolJson,
  type AbMcpHandle,
} from "./support/mcp-client.js";

const feature = await loadFeature(
  path.join(import.meta.dirname, "walking-skeleton.feature"),
);

describeFeature(
  feature,
  ({ Background, BeforeEachScenario, AfterEachScenario, Scenario }) => {
    let configDir: string;
    let configPath: string;
    let handle: AbMcpHandle | undefined;
    let lastResponse: any;

    // The actual Background setup/teardown is performed via
    // BeforeEachScenario/AfterEachScenario (which run once per scenario in
    // correct sequence via beforeAll/afterAll). The Background step
    // definitions below are required by vitest-cucumber (Background must be
    // "called") but are no-ops -- the real work happens in the hooks.
    Background(({ Given, And }) => {
      Given(
        'ab-mcp is configured with one entry: repo "ab-mcp" pointing at this',
        () => {},
      );

      And(
        "the ab-mcp MCP server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      configDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-ws-"));
      configPath = path.join(configDir, "lore-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify([
          { "repo-name": "ab-mcp", "doc-path": repoPath("docs") },
        ]),
      );
      handle = await startAbMcp(configPath);
    });

    AfterEachScenario(async () => {
      await handle?.close();
      handle = undefined;
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
    });

    Scenario(
      "Agent retrieves the Critical Reframe decision text end-to-end",
      ({ When, Then, And }) => {
        When(
          'the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"',
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            lastResponse = parseToolJson(result as any);
          },
        );

        Then(
          "the response includes a result whose source file ends with",
          () => {
            const match = lastResponse.results?.find((r: any) =>
              r.source_file?.endsWith(
                "docs/feature/ab-mcp/discover/wave-decisions.md",
              ),
            );
            expect(match).toBeDefined();
          },
        );

        And('that result\'s snippet contains "Critical Reframe"', () => {
          const match = lastResponse.results.find((r: any) =>
            r.source_file?.endsWith(
              "docs/feature/ab-mcp/discover/wave-decisions.md",
            ),
          );
          expect(match.snippet).toContain("Critical Reframe");
        });

        And("the response indicates a live, uncached read", () => {
          expect(lastResponse.retrieved_at).toMatch(/live/i);
        });
      },
    );

    Scenario(
      "Server boots and exposes both tools to the calling agent",
      ({ Then }) => {
        Then(
          'both "list_features" and "query_context" are available as callable',
          async () => {
            const { tools } = await handle!.client.listTools();
            const toolNames = tools.map((t) => t.name);
            expect(toolNames).toEqual(
              expect.arrayContaining(["list_features", "query_context"]),
            );
          },
        );
      },
    );

    Scenario(
      "Agent discovers ab-mcp's own feature documentation",
      ({ When, Then, And }) => {
        When('the agent calls list_features for repo "ab-mcp"', async () => {
          const result = await handle!.client.callTool({
            name: "list_features",
            arguments: { repo_name: "ab-mcp" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response includes feature "ab-mcp"', () => {
          const ids = lastResponse.features?.map((f: any) => f.feature_id);
          expect(ids).toContain("ab-mcp");
        });

        And("the response's doc path matches the configured path", () => {
          expect(lastResponse.doc_path).toBe(repoPath("docs"));
        });

        And(
          'the response includes phase "discover" for feature "ab-mcp"',
          () => {
            const feature = lastResponse.features.find(
              (f: any) => f.feature_id === "ab-mcp",
            );
            expect(feature.phases).toContain("discover");
          },
        );
      },
    );

  },
);
