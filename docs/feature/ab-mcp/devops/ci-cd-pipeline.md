# CI/CD Pipeline -- ab-mcp (DEVOPS)

## Platform: GitHub Actions

Single workflow file, `.github/workflows/ci.yml`, created during DELIVER
slice-00 (walking skeleton) since it gates every subsequent slice's PRs.

## Pipeline Stages

All stages run on `ubuntu-latest` (matches `platform_coverage.CI` in
`environments.yaml`), Node.js LTS >=20 (per brief.md Technology Stack).

| Stage | Command | Gate |
|---|---|---|
| Install | `npm ci` | Lockfile must be committed and consistent |
| Typecheck | `tsc --noEmit` | Zero TS errors |
| Architecture check | `npm run check:arch` (`dependency-cruiser`) | Zero violations of core/shell boundary (CLAUDE.md Development Paradigm) |
| Unit + integration tests | `npm run test` (`vitest`) | All tests pass; covers core (in-memory fixtures, no fs mocking per CLAUDE.md) and shell (real fs against fixture dirs) |
| Mutation testing | `npm run test:mutation` (e.g., StrykerJS), **per-feature** scope | Kill rate >=80% on files touched by the PR's slice (see Mutation Testing Strategy below) |
| Build | `npm run build` (`tsc`) | Compiles cleanly to `dist/` |

Stages run in the order above; each stage short-circuits the pipeline on
failure (fail-fast).

## Trigger Rules (from `branching-strategy.md`)

- **PR to `main`**: Install -> Typecheck -> Architecture check -> Tests -> Mutation
  testing (scoped to changed files) -> Build. No publish.
- **Push to `main`** (post-merge): same stages, re-verifying the merge commit.
- **Tag `v*`**: same stages, plus a final **Publish** job gated on a manual
  `workflow_dispatch` approval (or GitHub Environments protection rule)
  before `npm publish --access public`.

## Mutation Testing Strategy (Decision 9: per-feature)

**Confirmed**: per-feature mutation testing.

> This project uses **per-feature** mutation testing. Runs after refactoring
> during each delivery, scoped to modified files. Kill rate gate: >= 80%.

This text is added to root `CLAUDE.md` under `## Mutation Testing Strategy`
(see "CLAUDE.md Updates" below). Tooling choice (StrykerJS vs. alternatives)
is deferred to DELIVER slice-00 setup -- StrykerJS is the de facto standard
for TS/`vitest` and is the expected default, but not binding at DEVOPS time.

## Secrets / Credentials

- `NPM_TOKEN` (GitHub Actions secret) required only for the tag-triggered
  publish job. No other secrets needed -- ab-mcp has zero external
  integrations (confirmed in DESIGN wave-decisions.md Constraints).

## CLAUDE.md Updates (to be applied)

Append to root `CLAUDE.md`:

```markdown
## Mutation Testing Strategy

This project uses **per-feature** mutation testing. Runs after refactoring
during each delivery, scoped to modified files. Kill rate gate: >= 80%.
```
