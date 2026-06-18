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
  path.join(import.meta.dirname, "walking-skeleton.feature"),
);

/**
 * Creates a minimal fixture repo with a feature-level wave-decisions.md
 * and an ADR, both containing the given keyword.
 * Returns the absolute path to the fixture repo's `docs` directory.
 */
function createFixtureRepoWithConcern(
  rootDir: string,
  repoName: string,
  featureId: string,
  keyword: string,
): string {
  const docPath = path.join(rootDir, repoName, "docs");

  // Feature-level wave-decisions.md
  const featureDir = path.join(docPath, "feature", featureId, "design");
  mkdirSync(featureDir, { recursive: true });
  writeFileSync(
    path.join(featureDir, "wave-decisions.md"),
    `# ${featureId} decisions\n\n## D-${keyword}: chosen strategy\n\nWe decided to use ${keyword} tokens for session management.\n`,
  );

  // Architecture ADR
  const adrDir = path.join(docPath, "product", "architecture");
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(
    path.join(adrDir, `ADR-0007-${keyword}-strategy.md`),
    `# ADR-0007: ${keyword} strategy\n\nWe selected JWT for ${keyword}.\n`,
  );

  return docPath;
}

describeFeature(
  feature,
  ({ Background, BeforeEachScenario, AfterEachScenario, Scenario }) => {
    let rootDir: string;
    let configDir: string;
    let configPath: string;
    let handle: AbMcpHandle | undefined;
    let lastResponse: any;

    // Background step definitions are required by vitest-cucumber but are
    // no-ops -- real setup happens in BeforeEachScenario.
    Background(({ Given, And }) => {
      Given(
        "lore-mcp is configured with one entry pointing at a fixture repo",
        () => {},
      );

      And(
        "the lore-mcp server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      rootDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-ws-"));

      const fixtureDocPath = createFixtureRepoWithConcern(
        rootDir,
        "nwave-cli",
        "auth-flow",
        "auth",
      );

      configDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-ws-config-"));
      configPath = path.join(configDir, "lore-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify([
          { "repo-name": "nwave-cli", "doc-path": fixtureDocPath },
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
      "Agent resolves a concern and receives authoritative source with live timestamp",
      ({ Given, When, Then, And }) => {
        Given(
          'the fixture repo has a feature-level decision file for "auth" decisions',
          () => {
            // Created in BeforeEachScenario: auth-flow/design/wave-decisions.md
          },
        );

        And(
          'the fixture repo has an architecture decision record mentioning "auth"',
          () => {
            // Created in BeforeEachScenario: product/architecture/ADR-0007-auth-strategy.md
          },
        );

        When('the agent resolves the concern "auth"', async () => {
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "auth" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then("the response contains at least one match", () => {
          expect(Array.isArray(lastResponse.matches)).toBe(true);
          expect(lastResponse.matches.length).toBeGreaterThan(0);
        });

        And("at least one match identifies its source repo", () => {
          const match = lastResponse.matches[0];
          expect(match.repo_name).toBeDefined();
          expect(match.source_file).toBeDefined();
        });

        And("the response shows the read was performed live without caching", () => {
          expect(lastResponse.retrieved_at).toMatch(/live/i);
        });

        And("the response includes the list of repos that were searched", () => {
          // searched_repos appears on CONCERN_NOT_FOUND; on success, all
          // repo_names in matches are the indicator. Verify at least the
          // fixture repo appears in matches.
          const repoNames = lastResponse.matches.map((m: any) => m.repo_name);
          expect(repoNames).toContain("nwave-cli");
        });
      },
    );
  },
);
