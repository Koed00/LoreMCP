import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { afterEach, expect } from "vitest";
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

describeFeature(feature, ({ Background, Scenario }) => {
  let configDir: string;
  let configPath: string;
  let handle: AbMcpHandle | undefined;
  let lastResponse: any;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
    if (configDir) {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  Background(({ Given, And }) => {
    Given(
      'ab-mcp is configured with one entry: repo "ab-mcp" pointing at this repository\'s own "docs" directory',
      () => {
        configDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-ws-"));
        configPath = path.join(configDir, "ab-mcp.config.json");
        writeFileSync(
          configPath,
          JSON.stringify([
            { "repo-name": "ab-mcp", "doc-path": repoPath("docs") },
          ]),
        );
      },
    );

    And(
      "the ab-mcp MCP server is started as a subprocess over stdio with that configuration",
      async () => {
        handle = await startAbMcp(configPath);
      },
    );
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
        'the response includes a result whose source file ends with "docs/feature/ab-mcp/discover/wave-decisions.md"',
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
        'both "list_features" and "query_context" are available as callable tools',
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

      And('the response includes phase "discover" for feature "ab-mcp"', () => {
        const feature = lastResponse.features.find(
          (f: any) => f.feature_id === "ab-mcp",
        );
        expect(feature.phases).toContain("discover");
      });
    },
  );

  Scenario(
    "Agent receives a clear error for a feature that does not exist yet",
    ({ When, Then, And }) => {
      When(
        'the agent calls query_context for repo "ab-mcp" and feature "nonexistent-feature"',
        async () => {
          const result = await handle!.client.callTool({
            name: "query_context",
            arguments: {
              repo_name: "ab-mcp",
              feature_id: "nonexistent-feature",
            },
          });
          lastResponse = parseToolJson(result as any);
        },
      );

      Then('the response is an error "FEATURE_NOT_FOUND"', () => {
        expect(lastResponse.error).toBe("FEATURE_NOT_FOUND");
      });

      And('the response\'s available features include "ab-mcp"', () => {
        expect(lastResponse.available_features).toContain("ab-mcp");
      });
    },
  );
});
