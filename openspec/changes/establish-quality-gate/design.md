## Context

`AGENTS.md`'s `## Testing Strategy` and `## Development Tooling`, and `README.md`'s Technology, hold what is decided. This records only what they leave open. `handoff.md` lists what was owed.

## Goals / Non-Goals

**Goals:** every item the handoff lists exists and the gate runs on every pull request.

**Non-Goals:** the board itself. `smol-toml` arrives with the first change that reads settings, so this change has no runtime dependency.

## Decisions

**A command that does almost nothing.** `src/cli.ts` handles `--version` and refuses everything else, so there is a real entry point, a real test and something to confirm, and nothing is promised before it exists.

**ESM, with two TypeScript configurations.** `type: module`. `tsconfig.json` covers `src/` and `tests/` with `strict` and `noEmit`, for the type check. `tsconfig.build.json` extends it with `noEmit: false`, `include: ["src"]`, `rootDir: src` and `outDir: dist`. `src/cli.ts` begins with `#!/usr/bin/env node`, and the command reads its version from `package.json` beside `dist/`.

**Tests build once, first.** `dist/` is ignored, so a fresh checkout has none. A Vitest `globalSetup` runs the build once before any test, so no test file builds and none races another.

**The package check is a test.** `tests/package.test.ts` lists the package with `npm pack --dry-run --json --ignore-scripts`, against that build, and reads `package.json` for `repository` and the shebang in `dist/cli.js`. `prepack` still builds, for a real publish. `npm test` excludes that file, and `npm run check:package` runs it alone, so the gate's own step after the build is what fails and names the package. It therefore does not run in the pre-push hook, which is a mirror and never the gate.

**Fixtures are isolated from the surrounding Git.** Git exports `GIT_DIR` to hooks in a linked worktree, and `.worktrees/` is how this project works, so a `npm test` in a pre-push hook could otherwise commit into the real repository. `tests/support/` holds the fixture builder, which removes every `GIT_*` variable from its environment and sets its own identity and `commit.gpgsign=false`, and every test running Git or the carried tool uses that environment.

**Gate steps.** One job, `gate`, on a matrix of `ubuntu-latest` and `macos-latest`, with `node-version-file: .nvmrc`. Its first step fails where `bash`, `git` or `awk` is missing. Then `npm ci`, `biome ci`, `tsc --noEmit`, `npm test`, the build, `npm audit --audit-level=high`, `npm run check:package`. `fail-fast` is off, so both platforms report. The required checks are `gate (ubuntu-latest)` and `gate (macos-latest)`.

**The release decision is a small script.** `tools/release-decision.mjs`, outside `files`, takes no arguments, reads `package.json` from the working directory, runs `npm view dev-task-board version` and prints `publish=true` or `publish=false` for `$GITHUB_OUTPUT`. YAML could not be run; this can, against a stub `npm` on `PATH`. It compares `MAJOR.MINOR.PATCH` numerically, and a version of any other form fails. An E404, read from `npm`'s standard error as `npm error code E404`, publishes nothing, with a notice, so merging this change cannot fail on a publisher not yet set. An equal version publishes nothing. A raised version publishes. A lower version, or any other `npm view` failure, fails the run, so an outage is never read as nothing to do. `release.yml` runs on a push to `main`, and where the decision says so, builds and runs `npm publish --provenance`, with `id-token: write` and no stored token. Provenance needs `repository.url` in `package.json` and a public repository, which this is.

**Version `0.1.0`.** Pre-release range: the command is not yet useful, and `README.md` says so until the workstream delivers.

**Carried tool.** Copied from `ai-toolkit` at `2cc5bd80ad7bd1dd15205aa26f9a6263c58c0de5`, unchanged. The source record holds that one line.

**Hook installation.** `prepare` runs `simple-git-hooks`, so `npm ci` in a checkout installs them, and every worktree is provisioned with `npm ci` as `AGENTS.md` says. Hooks live in the common Git directory, so they bind every worktree once installed. They call tools through `npm exec --no`, so a checkout not provisioned fails rather than downloading, which is `No stand-down` as decided. Until this merges the main checkout has no `package.json` and its commits fail those hooks; nothing is committed there meanwhile, and it is provisioned after the merge.

**What Biome and Vitest leave out.** Biome also excludes `dist/` and `coverage/`, and markdown, since it would reformat `AGENTS.md`'s managed block and this project's prose. `AGENTS.md`'s formatting item therefore covers code and configuration. Vitest extends `configDefaults.exclude` rather than replacing it.

## Risks / Trade-offs

- A package name taken before the first publish: free today, and the publish follows this change directly. Renaming would need a change.
- macOS's bash 3.2 may fail the carried tool, which is the check doing its job; a fix belongs in `ai-toolkit`, then a bump here.
- Protection binds administrators, so a broken gate stops the operator too. Undoing it is one settings change, and it is theirs.

## Migration Plan

Merge, then the operator publishes once from a clean `main` and sets the trusted publisher: repository `Shatynska-Labs/dev-task-board`, workflow `release.yml`. Then `npx dev-task-board@0.1.0 --version` confirms. That publish is this project's deploy, so it comes before `confirm`.

## Open Questions

- The licence. The operator has not chosen one, so `package.json` names none, and they settle it before the first publish.
