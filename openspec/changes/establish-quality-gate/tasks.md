## 1. Package

- [x] 1.1 Write `package.json` (`bin`, `engines`, `files`, `os`, `repository`, scripts) with Vitest, Biome, TypeScript, `@types/node` and `simple-git-hooks`, `.nvmrc`, both TypeScript configurations and the lock file, leaving `prepare` to 2.2, and verify `npm ci` succeeds
- [x] 1.2 Write `src/cli.ts`
- [x] 1.3 Configure Vitest with the build in `globalSetup`, and verify from a checkout with no `dist/` that the derived tests of the command pass
- [x] 1.4 Write `tests/support/`'s fixture isolation if the derived tests did not, and verify a test run under `GIT_DIR` pointing at this repository leaves its branch unchanged
- [x] 1.5 Copy the carried tool and write its source record, and verify the derived tests of the tool pass
- [x] 1.6 Write `tools/release-decision.mjs` and verify the derived tests of the decision pass

## 2. Local tooling

- [x] 2.1 Configure Biome, and exclude `.worktrees/` and `.claude/worktrees/` from it and Vitest, and verify a seeded failing file under each is ignored by `npx biome ci .` and `npm test`, and that a built `dist/` is not linted
- [x] 2.2 Configure the local hooks and `prepare`, and verify from this worktree and from a second provisioned one that a commit runs Biome and a push runs the type check and tests, leaving the branch unchanged by the tests, and from an unprovisioned one that a commit fails with nothing downloaded
- [x] 2.3 Write `check:package` and verify it fails when `files` drops `vendor/`

## 3. Forge files

- [x] 3.1 Write the gate workflow, and verify with the `actionlint` release binary, fetched once into a temporary directory and no project dependency, that it parses
- [x] 3.2 Write the release workflow, and verify the same way
- [x] 3.3 Write the Dependabot configuration, and verify it parses as YAML with both ecosystems
- [x] 3.4 Say in `README.md` how to run and develop the project, and that it does nothing useful yet

## 4. Once the pull request is open

- [ ] 4.1 Verify both platforms report on the pull request, and that a commit breaking a check fails the gate, reverting it afterwards
- [ ] 4.2 On the operator's confirmation, require both checks and pull requests on `main`, with zero required approvals since the operator works alone, and administrators bound, and verify by reading the setting back

## 5. After the merge

- [ ] 5.1 The operator settles the licence, then publishes once from a clean, provisioned `main`, on their own confirmation
- [ ] 5.2 The operator sets the trusted publisher: repository `Shatynska-Labs/dev-task-board`, workflow `release.yml`
- [ ] 5.3 Verify `npx dev-task-board@0.1.0 --version` prints `0.1.0`, and that the release workflow's run on `main` published nothing, and that GitHub reports no error for the Dependabot configuration
