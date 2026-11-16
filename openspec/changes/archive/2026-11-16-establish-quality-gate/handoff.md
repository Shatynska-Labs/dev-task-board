# Handoff: `establish-quality-gate`

Identified by `project-foundation`, which decides the tooling and builds only the ignore entries.

## Why

The project has decisions and no quality layer, so no later change has a gate to pass.

## What it must build

Every item is recorded in `AGENTS.md`, `## Testing Strategy` and `## Development Tooling`, but for the carried tool, which `README.md`'s Technology records. Read them there, not in `project-foundation`'s `design.md`, which moves into the archive.

- The `package.json`, with `bin`, `engines`, `files` and `os`, `tsconfig.json` and a lock file; the test runner, Vitest, with `npm test`, and at least one real test, since Vitest fails with none and `--passWithNoTests` would be a skip the gate does not allow; `.nvmrc`.
- Biome for linting and formatting; `tsc --noEmit` with `strict`; the build to `dist/`, with enough of an entry point for `bin` and the build to work.
- `vendor/task-board`, copied from `ai-toolkit`'s `scripts/task-board`, and `vendor/task-board.source` with its commit, as `README.md`'s Technology records. The package check needs them.
- Local hooks, as a mirror of the gate.
- The release workflow: a merge raising the version publishes through npm trusted publishing, with `files` and `os` set in `package.json`. The first publish is the operator's, once, on their confirmation; they then set the trusted publisher, and the workflow takes over.
- The GitHub Actions gate on Ubuntu and macOS, running Biome, the type check, tests, the build, the audit and the package-contents check, and failing rather than skipping.
- Dependabot and `npm audit` in the gate.
- `.worktrees/` and `.claude/worktrees/` excluded from Vitest and Biome by configuration.
- Branch protection: once the gate's checks have reported at least once, and on the operator's confirmation, require them, require pull requests and bind administrators.

## What must not be undone

- `AGENTS.md`'s workflow block is regenerated, so project text stays outside it.
- The test command, glob and shared arrangement stay as `AGENTS.md` records them.

This change does not inherit foundation's exemption from test authoring.
