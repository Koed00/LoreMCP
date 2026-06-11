# Branching Strategy -- ab-mcp (DEVOPS)

## Decision: GitHub Flow

**Confirmed by stakeholder.** Single `main` branch + short-lived feature branches
+ pull requests. Matches a solo-maintainer OSS cadence: each DELIVER slice
(slice-00 through slice-04) becomes one or more feature branches merged via PR.

## Rules

1. `main` is always releasable -- every commit on `main` has passed CI
   (build, lint, `vitest`, `dependency-cruiser` architecture check).
2. Feature branches named `slice-NN-{short-name}` (e.g., `slice-00-walking-skeleton`)
   to trace directly to `docs/feature/ab-mcp/slices/slice-NN-*.md`.
3. PRs into `main` trigger the full CI pipeline (see `ci-cd-pipeline.md`).
   Direct pushes to `main` are discouraged but not hard-blocked (solo
   maintainer -- branch protection requiring PR review from a second human is
   not meaningful here; CI status check is the real gate).
4. Releases are tagged on `main` (`vX.Y.Z`, semver) and trigger the npm publish
   job.
5. No `develop`, `release/*`, or `hotfix/*` branches (GitFlow) -- unnecessary
   overhead for a single-package npm CLI with no parallel release trains.

## CI Trigger Mapping

| Event | Pipeline stages run |
|---|---|
| Push to feature branch / PR opened against `main` | build, lint, typecheck, `dependency-cruiser` (`check:arch`), `vitest` (unit + integration) |
| Merge to `main` | same as above (re-run on merge commit) |
| Tag `v*` pushed | same as above, plus `npm publish` (manual approval gate, see `ci-cd-pipeline.md`) |
