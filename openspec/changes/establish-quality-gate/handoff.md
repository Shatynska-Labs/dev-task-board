# Handoff: `establish-quality-gate`

Identified by `project-foundation`, which decides the tooling and builds only the ignore entries.

## Why

The project has decisions and no quality layer, so no later change has a gate to pass.

## What it must build

Every item is recorded in `AGENTS.md`, `## Testing Strategy` and `## Development Tooling`. Read them there, not in `project-foundation`'s `design.md`, which moves into the archive.

- The `package.json`, `tsconfig.json` and a lock file; the test runner, Vitest, with `npm test`; `.nvmrc`.
- Biome for linting and formatting; `tsc --noEmit` with `strict`; the build to `dist/`.
- Local hooks, as a mirror of the gate.
- The GitHub Actions gate, which fails rather than skips.
- Dependabot and `npm audit` in the gate.
- `.worktrees/` and `.claude/worktrees/` excluded from Vitest and Biome by configuration.
- Branch protection: once the gate's checks have reported at least once, and on the operator's confirmation, require them, require pull requests and bind administrators.

## What must not be undone

- `AGENTS.md`'s workflow block is regenerated, so project text stays outside it.
- The test command, glob and shared arrangement stay as `AGENTS.md` records them.

This change does not inherit foundation's exemption from test authoring.
