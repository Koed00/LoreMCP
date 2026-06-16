import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  startAbMcp,
  repoPath,
  parseToolJson,
  type AbMcpHandle,
} from "./support/mcp-client.js";

const feature = await loadFeature(
  path.join(import.meta.dirname, "release-2-partial-structure.feature"),
);

/**
 * Creates a fixture ADR file at `rootDir/repoName/docs/product/architecture/{fileName}`.
 * Returns the absolute docPath (`rootDir/repoName/docs`).
 */
function createFixtureRepoWithAdr(
  rootDir: string,
  repoName: string,
  adrFileName: string,
  adrContent: string,
): string {
  const docPath = path.join(rootDir, repoName, "docs");
  const architectureDir = path.join(docPath, "product", "architecture");
  mkdirSync(architectureDir, { recursive: true });
  writeFileSync(path.join(architectureDir, adrFileName), adrContent);
  return docPath;
}

/**
 * Creates a fixture repo with only a CLAUDE.md at the repo root
 * (`rootDir/repoName/CLAUDE.md`). The docPath (`rootDir/repoName/docs`) is
 * created as an empty directory so the server can accept it as the configured
 * path. Returns the absolute docPath.
 */
function createFixtureRepoWithClaudeMdOnly(
  rootDir: string,
  repoName: string,
  claudeMdContent: string,
): string {
  const repoRoot = path.join(rootDir, repoName);
  const docPath = path.join(repoRoot, "docs");
  mkdirSync(docPath, { recursive: true });
  writeFileSync(path.join(repoRoot, "CLAUDE.md"), claudeMdContent);
  return docPath;
}

/**
 * Creates a fixture repo with no nWave artifacts: only a README.md and a
 * manuals/ folder. Returns the absolute docPath.
 */
function createFixtureRepoWithNoStructure(
  rootDir: string,
  repoName: string,
): string {
  const repoRoot = path.join(rootDir, repoName);
  const docPath = path.join(repoRoot, "docs");
  mkdirSync(docPath, { recursive: true });
  writeFileSync(path.join(repoRoot, "README.md"), "# No structure repo\n");
  mkdirSync(path.join(repoRoot, "manuals"), { recursive: true });
  return docPath;
}

describeFeature(
  feature,
  ({ Background, BeforeEachScenario, AfterEachScenario, Scenario }) => {
    let rootDir: string;
    let configDir: string;
    let configPath: string;
    let handle: AbMcpHandle | undefined;
    let adrsOnlyDocPath: string;
    let claudeMdOnlyDocPath: string;
    let noStructureDocPath: string;
    let response: any;

    Background(({ Given, And }) => {
      Given(
        'ab-mcp is configured with 4 entries: "ab-mcp" (full structure),',
        () => {},
      );

      And(
        "the ab-mcp MCP server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      rootDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-partial-struct-"));

      adrsOnlyDocPath = createFixtureRepoWithAdr(
        rootDir,
        "adrs-only-repo",
        "ADR-0012-policy-format.md",
        "# ADR-0012: Policy Format\n\nThis ADR defines the policy format.\n",
      );

      claudeMdOnlyDocPath = createFixtureRepoWithClaudeMdOnly(
        rootDir,
        "claude-md-only-repo",
        "# Project\n\n## API Conventions\n\nAll endpoints use REST.\n",
      );

      noStructureDocPath = createFixtureRepoWithNoStructure(
        rootDir,
        "no-structure-repo",
      );

      configDir = mkdtempSync(path.join(tmpdir(), "ab-mcp-partial-struct-config-"));
      configPath = path.join(configDir, "ab-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify([
          { "repo-name": "ab-mcp", "doc-path": repoPath("docs") },
          { "repo-name": "adrs-only-repo", "doc-path": adrsOnlyDocPath },
          { "repo-name": "claude-md-only-repo", "doc-path": claudeMdOnlyDocPath },
          { "repo-name": "no-structure-repo", "doc-path": noStructureDocPath },
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
      "Repo with ADRs but no feature-level decisions returns ADR content with a warning",
      ({ Given, When, Then, And }) => {
        Given(
          '"adrs-only-repo" has docs/product/architecture/ADR-0012-policy-format.md',
          () => {
            // Created in BeforeEachScenario via createFixtureRepoWithAdr
          },
        );

        And(
          '"adrs-only-repo" has no docs/feature/permission-policies/ directory',
          () => {
            // No feature directory created in BeforeEachScenario for this repo
          },
        );

        When(
          "the agent calls query_context for repo \"adrs-only-repo\" and feature",
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: {
                repo_name: "adrs-only-repo",
                feature_id: "permission-policies",
              },
            });
            response = parseToolJson(result as any);
          },
        );

        Then(
          "the response includes a result whose source file ends with",
          () => {
            const match = response.results?.find((r: any) =>
              r.source_file?.endsWith("product/architecture/ADR-0012-policy-format.md"),
            );
            expect(match).toBeDefined();
          },
        );

        And(
          "the response includes a warning mentioning \"no feature-level",
          () => {
            expect(response.warnings).toBeDefined();
            const hasWarning = response.warnings?.some((w: string) =>
              w.toLowerCase().includes("no feature-level"),
            );
            expect(hasWarning).toBe(true);
          },
        );

        And("the response is not an error", () => {
          expect(response.error).toBeUndefined();
        });
      },
    );

    Scenario(
      "Repo with only a CLAUDE.md returns its content with a distinct warning",
      ({ Given, When, Then, And }) => {
        Given(
          '"claude-md-only-repo" has only a CLAUDE.md file containing a section',
          () => {
            // Created in BeforeEachScenario via createFixtureRepoWithClaudeMdOnly
          },
        );

        When(
          "the agent calls query_context for repo \"claude-md-only-repo\" and",
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: {
                repo_name: "claude-md-only-repo",
                feature_id: "auth-pagination",
              },
            });
            response = parseToolJson(result as any);
          },
        );

        Then(
          'the response includes a result whose source file ends with "CLAUDE.md"',
          () => {
            const match = response.results?.find((r: any) =>
              r.source_file?.endsWith("CLAUDE.md"),
            );
            expect(match).toBeDefined();
          },
        );

        And('that result\'s snippet contains "API Conventions"', () => {
          const match = response.results?.find((r: any) =>
            r.source_file?.endsWith("CLAUDE.md"),
          );
          expect(match?.snippet).toContain("API Conventions");
        });

        And(
          "the response includes a warning mentioning \"only CLAUDE.md-level",
          () => {
            expect(response.warnings).toBeDefined();
            const hasWarning = response.warnings?.some((w: string) =>
              w.toLowerCase().includes("only claude.md-level context"),
            );
            expect(hasWarning).toBe(true);
          },
        );
      },
    );

    Scenario(
      "Repo with zero nWave artifacts returns NO_NWAVE_STRUCTURE",
      ({ Given, When, Then, And }) => {
        Given(
          '"no-structure-repo" contains only a README.md and a manuals/ folder',
          () => {
            // Created in BeforeEachScenario via createFixtureRepoWithNoStructure
          },
        );

        When(
          "the agent calls query_context for repo \"no-structure-repo\" and",
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: {
                repo_name: "no-structure-repo",
                feature_id: "any-feature-id",
              },
            });
            response = parseToolJson(result as any);
          },
        );

        Then('the response is an error "NO_NWAVE_STRUCTURE"', () => {
          expect(response.error).toBe("NO_NWAVE_STRUCTURE");
        });

        And(
          "the message explains that nWave-structured docs are required",
          () => {
            expect(typeof response.message).toBe("string");
            expect(response.message.length).toBeGreaterThan(0);
            // Message should reference nWave structured docs
            expect(response.message).toMatch(/nWave/i);
          },
        );
      },
    );

    Scenario(
      "list_features reports structure-completeness flags accurately",
      ({ When, Then, And }) => {
        let adrsOnlyResponse: any;
        let claudeMdOnlyResponse: any;

        When('the agent calls list_features for repo "adrs-only-repo"', async () => {
          const result = await handle!.client.callTool({
            name: "list_features",
            arguments: { repo_name: "adrs-only-repo" },
          });
          adrsOnlyResponse = parseToolJson(result as any);
        });

        Then("the response includes has_architecture_adrs true", () => {
          expect(adrsOnlyResponse.has_architecture_adrs).toBe(true);
        });

        When('the agent calls list_features for repo "claude-md-only-repo"', async () => {
          const result = await handle!.client.callTool({
            name: "list_features",
            arguments: { repo_name: "claude-md-only-repo" },
          });
          claudeMdOnlyResponse = parseToolJson(result as any);
        });

        Then("the response includes has_architecture_adrs false", () => {
          expect(claudeMdOnlyResponse.has_architecture_adrs).toBe(false);
        });

        And("the response includes has_claude_md true", () => {
          expect(claudeMdOnlyResponse.has_claude_md).toBe(true);
        });
      },
    );

    Scenario(
      "Full-structure repo returns no false-positive warnings",
      ({ Given, When, Then }) => {
        Given(
          '"ab-mcp" has docs/feature/ab-mcp/discover/wave-decisions.md',
          () => {
            // The BeforeEachScenario wires "ab-mcp" to repoPath("docs") which
            // is the actual repository docs/ directory containing
            // docs/feature/ab-mcp/discover/wave-decisions.md.
          },
        );

        When(
          'the agent calls query_context for repo "ab-mcp" and feature "ab-mcp"',
          async () => {
            const result = await handle!.client.callTool({
              name: "query_context",
              arguments: { repo_name: "ab-mcp", feature_id: "ab-mcp" },
            });
            response = parseToolJson(result as any);
          },
        );

        Then("the response includes no warnings entry", () => {
          expect(response.warnings).toBeUndefined();
        });
      },
    );
  },
);
