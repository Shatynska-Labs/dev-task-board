## Why

The project has decisions and no quality layer, so no later change has a gate to pass, and nothing can be installed. `project-foundation` decided the tooling and left it to this change, in `handoff.md`.

- **Workstream**: `see-my-projects-live`, of which this is the first step. The workstream's file is committed with this plan.

## What Changes

- A TypeScript package named `dev-task-board` at `0.1.0`, whose command prints its version and does nothing else yet.
- The carried copy of `scripts/task-board` at `vendor/task-board`, with its source commit.
- Vitest, Biome, `tsc`, local hooks, Dependabot and the audit, as `AGENTS.md` records them.
- The GitHub Actions gate on Ubuntu and macOS, and the release workflow.
- Branch protection on `main`, once the gate has reported and the operator confirms.
- The operator's first publish, and their setting of the trusted publisher.

## Capabilities

### New Capabilities

- `package`: what the published package holds, and what its command does.
- `release`: how a merge decides whether to publish.

### Modified Capabilities

None.

## Impact

- New: `docs/workstreams/see-my-projects-live.md`, already on this branch.
- New: `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `tsconfig.build.json`, `biome.json`, `vitest.config.ts`, `src/`, `tests/`, `tools/`, `vendor/`, `.github/`.
- The repository's settings on GitHub change: `main` is protected, with administrators bound.
- From then on nothing reaches `main` without the gate, including the operator's own work.
