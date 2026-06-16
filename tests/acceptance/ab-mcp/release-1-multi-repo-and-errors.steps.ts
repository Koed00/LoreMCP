import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  startAbMcp,
  repoPath,
  parseToolJson,
  type AbMcpHandle,
} from "./support/mcp-client.js";

const feature = await loadFeature(
  path.join(import.meta.dirname, "release-1-multi-repo-and-errors.feature"),
);

/**
 * Creates a fixture repo under `rootDir/repoName` with a
 * `docs/feature/{featureId}/design/wave-decisions.md` containing
 * `decisionText`. Returns the absolute path to the repo's `docs` directory
 * (the configured `doc-path`).
 */
function createFixtureRepoWithFeature(
  rootDir: string,
  repoName: string,
  featureId: string,
  decisionText: string,
): string {
  const docPath = path.join(rootDir, repoName, "docs");
  const phaseDir = path.join(docPath, "feature", featureId, "design");
  mkdirSync(phaseDir, { recursive: true });
  writeFileSync(
    path.join(phaseDir, "wave-decisions.md"),
    `# ${featureId} decisions\n\n${decisionText}\n`,
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
    let repoBDocPath: string;
    let repoCDocPath: string;
    let firstResponse: any;
    let secondResponse: any;
    let permissionDeniedDir: string | undefined;

    // The Background setup/teardown is performed via
    // BeforeEachScenario/AfterEachScenario (matching walking-skeleton.steps.ts
    // convention). The Background step definitions below are required by
    // vitest-cucumber (Background must be "called") but are no-ops -- the
    // real work happens in the hooks.
    Background(({ Given, And }) => {
      Given(
        'ab-mcp is configured with 3 entries: "ab-mcp", "repo-b", and "repo-c",',
        () => {},
      );

      And(
        "the ab-mcp MCP server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      rootDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-multi-repo-"));

      // repo-b: docs/feature/widgets/design/wave-decisions.md
      repoBDocPath = createFixtureRepoWithFeature(
        rootDir,
        "repo-b",
        "widgets",
        "D-widget-shape: rounded corners",
      );

      // repo-b and repo-c each get a docs/feature/logging/ with distinct content
      createFixtureRepoWithFeature(
        rootDir,
        "repo-b",
        "logging",
        "D-logging-format: repo-b uses structured JSON logs",
      );
      repoCDocPath = createFixtureRepoWithFeature(
        rootDir,
        "repo-c",
        "logging",
        "D-logging-format: repo-c uses plain-text logs",
      );

      configDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-multi-repo-config-"));
      configPath = path.join(configDir, "lore-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify([
          { "repo-name": "ab-mcp", "doc-path": repoPath("docs") },
          { "repo-name": "repo-b", "doc-path": repoBDocPath },
          { "repo-name": "repo-c", "doc-path": repoCDocPath },
        ]),
      );

      handle = await startAbMcp(configPath);
    });

    AfterEachScenario(async () => {
      await handle?.close();
      handle = undefined;
      if (permissionDeniedDir) {
        // Restore permissions so rmSync below (and rootDir cleanup) can
        // recurse into this directory.
        chmodSync(permissionDeniedDir, 0o755);
        permissionDeniedDir = undefined;
      }
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
      if (rootDir) {
        rmSync(rootDir, { recursive: true, force: true });
      }
    });

    Scenario(
      "Agent retrieves a feature's design decision from the second configured repo",
      ({ Given, When, Then, And }) => {
        Given(
          '"repo-b" has a docs/feature/widgets/design/wave-decisions.md file',
          () => {},
        );

        When(
          'the agent calls query_context for repo "repo-b" and feature "widgets"',
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "repo-b", feature_id: "widgets" },
            });
            firstResponse = parseToolJson(result as any);
          },
        );

        Then(
          'the response includes a result whose source file is rooted in',
          () => {
            const match = firstResponse.results?.find((r: any) =>
              r.source_file?.startsWith("docs/feature/widgets/"),
            );
            expect(match).toBeDefined();
          },
        );

        And(
          'that result\'s snippet contains "D-widget-shape: rounded corners"',
          () => {
            const match = firstResponse.results.find((r: any) =>
              r.source_file?.startsWith("docs/feature/widgets/"),
            );
            expect(match.snippet).toContain("D-widget-shape: rounded corners");
          },
        );
      },
    );

    Scenario(
      "Results from different repos do not cross-contaminate",
      ({ Given, When, Then, And }) => {
        Given(
          'both "repo-b" and "repo-c" have a docs/feature/logging/ directory',
          () => {},
        );

        When(
          'the agent calls query_context for repo "repo-b" and feature "logging"',
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "repo-b", feature_id: "logging" },
            });
            firstResponse = parseToolJson(result as any);
          },
        );

        And(
          'the agent separately calls query_context for repo "repo-c" and',
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "repo-c", feature_id: "logging" },
            });
            secondResponse = parseToolJson(result as any);
          },
        );

        Then(
          'the first response\'s source file is rooted in "repo-b"\'s configured',
          () => {
            const match = firstResponse.results?.find((r: any) =>
              r.source_file?.startsWith("docs/feature/logging/"),
            );
            expect(match).toBeDefined();
          },
        );

        And(
          'the second response\'s source file is rooted in "repo-c"\'s configured',
          () => {
            const match = secondResponse.results?.find((r: any) =>
              r.source_file?.startsWith("docs/feature/logging/"),
            );
            expect(match).toBeDefined();
          },
        );

        And("the two responses' snippets differ", () => {
          const firstMatch = firstResponse.results.find((r: any) =>
            r.source_file?.startsWith("docs/feature/logging/"),
          );
          const secondMatch = secondResponse.results.find((r: any) =>
            r.source_file?.startsWith("docs/feature/logging/"),
          );
          expect(firstMatch.snippet).not.toEqual(secondMatch.snippet);
        });
      },
    );

    Scenario(
      "list_features returns distinct feature lists per repo",
      ({ When, And, Then }) => {
        When('the agent calls list_features for repo "ab-mcp"', async () => {
          const result = await handle!.client.callTool({
            name: "list_features",
            arguments: { repo_name: "ab-mcp" },
          });
          firstResponse = parseToolJson(result as any);
        });

        And(
          'the agent separately calls list_features for repo "repo-b"',
          async () => {
            const result = await handle!.client.callTool({
              name: "list_features",
              arguments: { repo_name: "repo-b" },
            });
            secondResponse = parseToolJson(result as any);
          },
        );

        Then(
          "the two responses' feature lists reflect each repo's own",
          () => {
            const firstIds = firstResponse.features.map((f: any) => f.feature_id);
            const secondIds = secondResponse.features.map((f: any) => f.feature_id);
            expect(firstIds).toContain("ab-mcp");
            expect(secondIds).toEqual(
              expect.arrayContaining(["widgets", "logging"]),
            );
            expect(secondIds).not.toContain("ab-mcp");
          },
        );

        And(
          "the two responses' doc paths differ, each matching that repo's",
          () => {
            expect(firstResponse.doc_path).toBe(repoPath("docs"));
            expect(secondResponse.doc_path).toBe(repoBDocPath);
            expect(firstResponse.doc_path).not.toBe(secondResponse.doc_path);
          },
        );
      },
    );

    // The remaining scenarios in this feature file (REPO_NOT_CONFIGURED,
    // REPO_PATH_NOT_FOUND, FEATURE_NOT_FOUND, permission-denied) remain
    // @skip-tagged DISTILL scaffolding for later DELIVER steps. They must
    // still be "called" (vitest-cucumber requires every scenario to be
    // referenced), so they are registered via Scenario.skip with no step
    // implementations.
    Scenario(
      "Agent queries a repo name that is not configured",
      ({ When, Then, And }) => {
        When(
          'the agent calls list_features for repo "repo-not-configured"',
          async () => {
            const result = await handle!.client.callTool({
              name: "list_features",
              arguments: { repo_name: "repo-not-configured" },
            });
            firstResponse = parseToolJson(result as any);
          },
        );

        Then('the response is an error "REPO_NOT_CONFIGURED"', () => {
          expect(firstResponse.error).toBe("REPO_NOT_CONFIGURED");
        });

        And(
          'the response\'s available repos include "ab-mcp", "repo-b", and "repo-c"',
          () => {
            expect(firstResponse.available_repos).toEqual(
              expect.arrayContaining(["ab-mcp", "repo-b", "repo-c"]),
            );
          },
        );
      },
    );

    Scenario(
      "Agent receives REPO_PATH_NOT_FOUND for a configured repo whose path moved",
      ({ Given, When, Then, And }) => {
        let movedRepoCDocPath: string;
        let movedConfigDir: string;
        let movedHandle: AbMcpHandle | undefined;

        Given('"repo-c" is configured with a doc path that does not exist on disk', async () => {
          movedRepoCDocPath = path.join(rootDir, "repo-c-moved", "docs");

          movedConfigDir = mkdtempSync(
            path.join(tmpdir(), "ab-mcp-multi-repo-moved-config-"),
          );
          const movedConfigPath = path.join(movedConfigDir, "lore-mcp.config.json");
          writeFileSync(
            movedConfigPath,
            JSON.stringify([
              { "repo-name": "ab-mcp", "doc-path": repoPath("docs") },
              { "repo-name": "repo-b", "doc-path": repoBDocPath },
              { "repo-name": "repo-c", "doc-path": movedRepoCDocPath },
            ]),
          );

          movedHandle = await startAbMcp(movedConfigPath);
        });

        When(
          'the agent calls query_context for repo "repo-c" and feature "anything"',
          async () => {
            const result = await movedHandle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "repo-c", feature_id: "anything" },
            });
            firstResponse = parseToolJson(result as any);

            await movedHandle!.close();
            rmSync(movedConfigDir, { recursive: true, force: true });
          },
        );

        Then('the response is an error "REPO_PATH_NOT_FOUND"', () => {
          expect(firstResponse.error).toBe("REPO_PATH_NOT_FOUND");
        });

        And("the response includes the configured path that was checked", () => {
          expect(firstResponse.configured_path).toBe(movedRepoCDocPath);
        });

        And("the response's available repos include the other 2 configured repos", () => {
          expect(firstResponse.available_repos).toEqual(
            expect.arrayContaining(["ab-mcp", "repo-b"]),
          );
        });
      },
    );

    Scenario(
      "Agent receives FEATURE_NOT_FOUND with accurate available features",
      ({ Given, When, Then, And }) => {
        Given(
          '"repo-b" has a docs/feature/logging/ directory but no',
          () => {
            // Set up in BeforeEachScenario: repo-b has docs/feature/widgets/
            // and docs/feature/logging/, but no docs/feature/loggin/.
          },
        );

        When(
          'the agent calls query_context for repo "repo-b" and feature "loggin"',
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "repo-b", feature_id: "loggin" },
            });
            firstResponse = parseToolJson(result as any);
          },
        );

        Then('the response is an error "FEATURE_NOT_FOUND"', () => {
          expect(firstResponse.error).toBe("FEATURE_NOT_FOUND");
        });

        And('the response\'s available features include "logging"', () => {
          expect(firstResponse.available_features).toEqual(
            expect.arrayContaining(["logging"]),
          );
        });
      },
    );

    Scenario(
      "A permission-denied repo path never leaks a raw exception",
      ({ Given, When, Then, And }) => {
        let permissionDeniedHandle: AbMcpHandle | undefined;
        let permissionDeniedConfigDir: string | undefined;

        Given(
          '"repo-c" is configured with a doc path that exists but is not',
          async () => {
            permissionDeniedDir = path.join(rootDir, "repo-c-readonly", "docs");
            mkdirSync(permissionDeniedDir, { recursive: true });

            // Remove read permission for everyone -- fs.access(R_OK) in
            // probe() should fail and surface REPO_PATH_NOT_FOUND, never a
            // raw exception.
            chmodSync(permissionDeniedDir, 0o000);

            permissionDeniedConfigDir = mkdtempSync(
              path.join(tmpdir(), "ab-mcp-multi-repo-perm-config-"),
            );
            const permissionDeniedConfigPath = path.join(
              permissionDeniedConfigDir,
              "lore-mcp.config.json",
            );
            writeFileSync(
              permissionDeniedConfigPath,
              JSON.stringify([
                { "repo-name": "ab-mcp", "doc-path": repoPath("docs") },
                { "repo-name": "repo-b", "doc-path": repoBDocPath },
                { "repo-name": "repo-c", "doc-path": permissionDeniedDir },
              ]),
            );

            permissionDeniedHandle = await startAbMcp(permissionDeniedConfigPath);
          },
        );

        When(
          'the agent calls query_context for repo "repo-c" and feature "anything"',
          async () => {
            const result = await permissionDeniedHandle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "repo-c", feature_id: "anything" },
            });
            firstResponse = parseToolJson(result as any);

            await permissionDeniedHandle!.close();
            if (permissionDeniedConfigDir) {
              rmSync(permissionDeniedConfigDir, { recursive: true, force: true });
            }
          },
        );

        Then("the response is a structured JSON error", () => {
          // process.getuid is unavailable on Windows; root (uid 0) bypasses
          // permission checks entirely, so REPO_PATH_NOT_FOUND cannot be
          // exercised in that environment. Either way, the response must be
          // a well-formed structured JSON object with an `error` field.
          expect(typeof firstResponse).toBe("object");
          expect(firstResponse).not.toBeNull();

          if (process.getuid?.() !== 0) {
            expect(firstResponse.error).toBe("REPO_PATH_NOT_FOUND");
          } else {
            expect(typeof firstResponse.error === "string" || firstResponse.results).toBeTruthy();
          }
        });

        And("the response does not contain a raw stack trace or unhandled", () => {
          const serialized = JSON.stringify(firstResponse);
          expect(serialized).not.toContain("Error:");
          expect(serialized).not.toContain(" at ");
        });
      },
    );
  },
);
