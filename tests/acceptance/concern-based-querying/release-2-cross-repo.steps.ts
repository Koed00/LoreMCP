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
  path.join(import.meta.dirname, "release-2-cross-repo.feature"),
);

function makeDocPath(rootDir: string, repoName: string): string {
  return path.join(rootDir, repoName, "docs");
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function createRepoWithFeature(
  rootDir: string,
  repoName: string,
  featureId: string,
  content: string,
): string {
  const docPath = makeDocPath(rootDir, repoName);
  writeFile(
    path.join(docPath, "feature", featureId, "design", "wave-decisions.md"),
    content,
  );
  return docPath;
}

function createRepoWithAdr(
  rootDir: string,
  repoName: string,
  adrName: string,
  content: string,
): string {
  const docPath = makeDocPath(rootDir, repoName);
  writeFile(
    path.join(docPath, "product", "architecture", adrName),
    content,
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
    let repoAlphaDocPath: string;
    let repoBetaDocPath: string;

    Background(({ Given, And }) => {
      Given("lore-mcp is configured with multiple fixture repo entries", () => {});
      And(
        "the lore-mcp server is started as a subprocess over stdio with that",
        () => {},
      );
    });

    BeforeEachScenario(async () => {
      rootDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-r2-"));
      // Paths are set up per-scenario in Given steps.
      // Placeholder doc paths created here; actual content written in Given steps.
      repoAlphaDocPath = makeDocPath(rootDir, "repo-alpha");
      repoBetaDocPath = makeDocPath(rootDir, "repo-beta");

      configDir = mkdtempSync(path.join(tmpdir(), "lore-mcp-cbq-r2-config-"));
    });

    AfterEachScenario(async () => {
      await handle?.close();
      handle = undefined;
      if (configDir) rmSync(configDir, { recursive: true, force: true });
      if (rootDir) rmSync(rootDir, { recursive: true, force: true });
    });

    async function startWithRepos(entries: Array<{ name: string; docPath: string }>) {
      configPath = path.join(configDir, "lore-mcp.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          entries.map((e) => ({ "repo-name": e.name, "doc-path": e.docPath })),
        ),
      );
      handle = await startAbMcp(configPath);
    }

    Scenario(
      "Agent finds a concern present in multiple repos",
      ({ Given, When, Then, And }) => {
        Given(
          '"repo-alpha" has a feature-level decision file containing "data persistence"',
          () => {
            repoAlphaDocPath = createRepoWithFeature(
              rootDir,
              "repo-alpha",
              "storage-layer",
              "# storage-layer decisions\n\nD-storage: We chose PostgreSQL for data persistence.\n",
            );
          },
        );

        And(
          '"repo-beta" has an architecture decision record containing "data persistence"',
          () => {
            repoBetaDocPath = createRepoWithAdr(
              rootDir,
              "repo-beta",
              "ADR-0002-data-persistence.md",
              "# ADR-0002: data persistence\n\nShared data persistence uses S3.\n",
            );
          },
        );

        When('the agent resolves the concern "data persistence"', async () => {
          await startWithRepos([
            { name: "repo-alpha", docPath: repoAlphaDocPath },
            { name: "repo-beta", docPath: repoBetaDocPath },
          ]);
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "data persistence" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then(
          'the response contains matches from both "repo-alpha" and "repo-beta"',
          () => {
            const repoNames = lastResponse.matches?.map((m: any) => m.repo_name);
            expect(repoNames).toContain("repo-alpha");
            expect(repoNames).toContain("repo-beta");
          },
        );

        And("each match correctly identifies its source repo", () => {
          for (const match of lastResponse.matches) {
            expect(match.repo_name).toBeDefined();
            expect(["repo-alpha", "repo-beta"]).toContain(match.repo_name);
          }
        });

        And(
          'the match from "repo-alpha" with feature-level relevance appears before',
          () => {
            const alphaIdx = lastResponse.matches.findIndex(
              (m: any) => m.repo_name === "repo-alpha" && m.relevance === "feature-level",
            );
            const betaIdx = lastResponse.matches.findIndex(
              (m: any) => m.repo_name === "repo-beta" && m.relevance === "architecture-level",
            );
            expect(alphaIdx).toBeGreaterThanOrEqual(0);
            expect(betaIdx).toBeGreaterThanOrEqual(0);
            expect(alphaIdx).toBeLessThan(betaIdx);
          },
        );
      },
    );

    Scenario(
      "Agent finds a concern in one repo but not the other",
      ({ Given, When, Then, And }) => {
        Given(
          '"repo-alpha" has a feature-level decision file containing "logging"',
          () => {
            repoAlphaDocPath = createRepoWithFeature(
              rootDir,
              "repo-alpha",
              "logging",
              "# logging decisions\n\nD-logging: Structured JSON logs for all services.\n",
            );
          },
        );

        And('"repo-beta" has no content mentioning "logging"', () => {
          repoBetaDocPath = createRepoWithFeature(
            rootDir,
            "repo-beta",
            "auth",
            "# auth decisions\n\nD-auth: JWT for session management.\n",
          );
        });

        When('the agent resolves the concern "logging"', async () => {
          await startWithRepos([
            { name: "repo-alpha", docPath: repoAlphaDocPath },
            { name: "repo-beta", docPath: repoBetaDocPath },
          ]);
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "logging" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains matches only from "repo-alpha"', () => {
          const repoNames = lastResponse.matches?.map((m: any) => m.repo_name);
          expect(repoNames).toContain("repo-alpha");
          expect(repoNames).not.toContain("repo-beta");
        });

        And("the response shows both repos were searched", () => {
          // On a successful response, both repos were scanned if both were
          // reachable. The repo_names in matches + absence of warnings about
          // skipping indicate both were searched. Alternatively, verify no
          // skip warning for repo-beta exists.
          const warnings: string[] = lastResponse.warnings ?? [];
          const repoBetaSkipped = warnings.some((w: string) =>
            w.includes("repo-beta") && w.toLowerCase().includes("skip"),
          );
          expect(repoBetaSkipped).toBe(false);
        });
      },
    );

    Scenario(
      "Scan continues when one configured repo is unreachable",
      ({ Given, When, Then, And }) => {
        Given(
          '"repo-alpha" has a feature-level decision file containing "observability"',
          () => {
            repoAlphaDocPath = createRepoWithFeature(
              rootDir,
              "repo-alpha",
              "monitoring",
              "# monitoring decisions\n\nD-observability: Prometheus for observability metrics.\n",
            );
          },
        );

        And(
          '"repo-gamma" is configured with a doc path that does not exist on disk',
          () => {
            // repo-gamma's doc path is set to a non-existent directory.
          },
        );

        When('the agent resolves the concern "observability"', async () => {
          const nonExistentPath = path.join(rootDir, "repo-gamma-gone", "docs");
          await startWithRepos([
            { name: "repo-alpha", docPath: repoAlphaDocPath },
            { name: "repo-gamma", docPath: nonExistentPath },
          ]);
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "observability" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response contains matches from "repo-alpha"', () => {
          const repoNames = lastResponse.matches?.map((m: any) => m.repo_name);
          expect(repoNames).toContain("repo-alpha");
        });

        And('the response includes a notice that "repo-gamma" was skipped', () => {
          const warnings: string[] = lastResponse.warnings ?? [];
          const gammaSkipped = warnings.some((w: string) =>
            w.includes("repo-gamma"),
          );
          expect(gammaSkipped).toBe(true);
        });

        And("the response is not an error", () => {
          expect(lastResponse.error).toBeUndefined();
          expect(Array.isArray(lastResponse.matches)).toBe(true);
        });
      },
    );

    Scenario(
      "Agent receives no match found when all configured repos are unreachable",
      ({ Given, When, Then, And }) => {
        Given(
          "all configured repos have doc paths that do not exist on disk",
          () => {
            // Both doc paths point at non-existent directories.
          },
        );

        When('the agent resolves the concern "auth"', async () => {
          const gone1 = path.join(rootDir, "repo-alpha-gone", "docs");
          const gone2 = path.join(rootDir, "repo-beta-gone", "docs");
          await startWithRepos([
            { name: "repo-alpha", docPath: gone1 },
            { name: "repo-beta", docPath: gone2 },
          ]);
          const result = await handle!.client.callTool({
            name: "resolve_concern",
            arguments: { concern: "auth" },
          });
          lastResponse = parseToolJson(result as any);
        });

        Then('the response is an error "CONCERN_NOT_FOUND"', () => {
          expect(lastResponse.error).toBe("CONCERN_NOT_FOUND");
        });

        And("the error includes a notice for each skipped repo", () => {
          const warnings: string[] = lastResponse.warnings ?? [];
          expect(warnings.some((w: string) => w.includes("repo-alpha"))).toBe(true);
          expect(warnings.some((w: string) => w.includes("repo-beta"))).toBe(true);
        });

        And("the error lists no successfully searched repos", () => {
          expect(lastResponse.searched_repos).toEqual([]);
        });

        And("the response shows the read was performed live without caching", () => {
          expect(lastResponse.retrieved_at).toMatch(/live/i);
        });
      },
    );
  },
);
