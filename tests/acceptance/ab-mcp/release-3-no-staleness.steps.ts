import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  startAbMcp,
  parseToolJson,
  type AbMcpHandle,
} from "./support/mcp-client.js";

const feature = await loadFeature(
  path.join(import.meta.dirname, "release-3-no-staleness.feature"),
);

describeFeature(
  feature,
  ({ Background, BeforeEachScenario, AfterEachScenario, Scenario }) => {
    let rootDir: string;
    let configDir: string;
    let configPath: string;
    let handle: AbMcpHandle | undefined;
    let waveDecisionsFixturePath: string;
    let firstResponse: any;
    let secondResponse: any;

    // Background step definitions are no-ops -- real setup is in
    // BeforeEachScenario following the convention of release-1/2 steps files.
    Background(({ Given, And }) => {
      Given(
        'ab-mcp is configured with one entry: repo "ab-mcp" pointing at a',
        () => {},
      );

      And(
        "the ab-mcp MCP server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      // Create a tmpdir fixture that mirrors the real repo structure
      rootDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-no-staleness-"));

      // Build docs/feature/ab-mcp/discover/ inside the fixture
      const discoverDir = path.join(
        rootDir,
        "docs",
        "feature",
        "ab-mcp",
        "discover",
      );
      mkdirSync(discoverDir, { recursive: true });

      // Write a minimal wave-decisions.md containing "Critical Reframe"
      // so the query_context call returns a predictable snippet.
      waveDecisionsFixturePath = path.join(discoverDir, "wave-decisions.md");
      writeFileSync(
        waveDecisionsFixturePath,
        "# Wave Decisions -- DISCOVER (ab-mcp)\n\n## Critical Reframe\n\nInitial content for live-read test.\n",
      );

      configDir = mkdtempSync(
        path.join(tmpdir(), "ab-mcp-no-staleness-config-"),
      );
      configPath = path.join(configDir, "lore-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify([
          {
            "repo-name": "ab-mcp",
            "doc-path": path.join(rootDir, "docs"),
          },
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
      if (rootDir) {
        rmSync(rootDir, { recursive: true, force: true });
      }
    });

    Scenario(
      "An edit to a source repo's doc file is reflected in the very next query",
      ({ Given, When, Then, And }) => {
        Given(
          '"ab-mcp"\'s docs/feature/ab-mcp/discover/wave-decisions.md does not',
          () => {
            // Fixture was created in BeforeEachScenario without TEMP-VERIFY-LIVE-READ.
            // Nothing to do here.
          },
        );

        When(
          'the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"',
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            firstResponse = parseToolJson(result as any);
          },
        );

        Then(
          'the response\'s snippet does not contain "TEMP-VERIFY-LIVE-READ"',
          () => {
            const allSnippets = (firstResponse.results ?? [])
              .map((r: any) => r.snippet ?? "")
              .join("\n");
            expect(allSnippets).not.toContain("TEMP-VERIFY-LIVE-READ");
          },
        );

        When(
          'the line "TEMP-VERIFY-LIVE-READ" is appended to that file on disk',
          () => {
            appendFileSync(waveDecisionsFixturePath, "\nTEMP-VERIFY-LIVE-READ\n");
          },
        );

        And(
          "the agent calls query_context again for repo \"ab-mcp\" and feature",
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            secondResponse = parseToolJson(result as any);
          },
        );

        Then(
          'the response\'s snippet contains "TEMP-VERIFY-LIVE-READ"',
          () => {
            const allSnippets = (secondResponse.results ?? [])
              .map((r: any) => r.snippet ?? "")
              .join("\n");
            expect(allSnippets).toContain("TEMP-VERIFY-LIVE-READ");
          },
        );
      },
    );

    Scenario(
      "retrieved_at marker is present on every response, even with unchanged content",
      ({ When, Then, And }) => {
        When(
          "the agent calls query_context for repo \"ab-mcp\" and feature \"ab-mcp\"",
          async () => {
            const result1 = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            firstResponse = parseToolJson(result1 as any);

            const result2 = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            secondResponse = parseToolJson(result2 as any);
          },
        );
        Then(
          "both responses include a retrieved_at field indicating a live,",
          () => {
            expect(firstResponse.retrieved_at).toBeDefined();
            expect(firstResponse.retrieved_at).toContain("live (uncached) read at");
            expect(secondResponse.retrieved_at).toBeDefined();
            expect(secondResponse.retrieved_at).toContain("live (uncached) read at");
          },
        );
        And("the snippet content is identical between the two responses", () => {
          const snippets1 = (firstResponse.results ?? [])
            .map((r: any) => r.snippet ?? "")
            .join("\n");
          const snippets2 = (secondResponse.results ?? [])
            .map((r: any) => r.snippet ?? "")
            .join("\n");
          expect(snippets1).toEqual(snippets2);
        });
      },
    );

    Scenario(
      "Successive queries each reflect the latest on-disk state",
      ({ When, And, Then }) => {
        let firstSnippets: string;
        let secondSnippets: string;

        When(
          "the agent calls query_context for repo \"ab-mcp\" and feature \"ab-mcp\"",
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            firstResponse = parseToolJson(result as any);
            firstSnippets = (firstResponse.results ?? [])
              .map((r: any) => r.snippet ?? "")
              .join("\n");
          },
        );
        And(
          "the line \"D-temp: temporary verification line\" is appended to",
          () => {
            appendFileSync(waveDecisionsFixturePath, "\nD-temp: temporary verification line\n");
          },
        );
        And(
          "the agent calls query_context again for repo \"ab-mcp\" and feature",
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            secondResponse = parseToolJson(result as any);
            secondSnippets = (secondResponse.results ?? [])
              .map((r: any) => r.snippet ?? "")
              .join("\n");
          },
        );
        Then(
          "call 1's snippet does not contain \"D-temp: temporary verification line\"",
          () => {
            expect(firstSnippets).not.toContain("D-temp: temporary verification line");
          },
        );
        And(
          "call 2's snippet contains \"D-temp: temporary verification line\"",
          () => {
            expect(secondSnippets).toContain("D-temp: temporary verification line");
          },
        );
      },
    );
  },
);
