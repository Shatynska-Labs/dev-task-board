# Test plan: establish-quality-gate

Replaced wholesale on any repeat pass. Not an artifact the OpenSpec schema knows about, so it does not appear among `openspec instructions apply`'s context files and must be read on purpose.

Test files: `tests/cli.test.ts`, `tests/carried-tool.test.ts`, `tests/release-decision.test.ts`, and `tests/package.test.ts`, which `npm test` excludes and `npm run check:package` runs alone.

Tests are named as `<file> -t "<name pattern>"`, the form `npx vitest run` selects. `check:package` is what selects `tests/package.test.ts` once the configuration excludes it.

## Baseline

No baseline was taken. `npm test` does not exist: there is no `package.json`, no Vitest, and before this pass no `tests/` directory, so no suite existed to run.

**The tests were not run under Vitest**, for that reason, and no claim below rests on a Vitest run. They were executed once under a throwaway stand-in for Vitest's API, kept in the scratchpad and in no way part of the project, using Node 24's type stripping. That establishes that the files load, that the local arrangement works (the fixture repository built, the isolation test passed) and how each test fails today. It is not a baseline, and it type-checked nothing: `tsc` and Biome have not seen these files.

Observed there: 20 tests passed, all of them checks over supplied material or the isolation test. 33 failed, every one on an absent target (second failure state): `package.json`, `dist/`, `vendor/` or `tools/`. The assertions of those 33 have therefore not executed.

## Scenarios

13 scenarios in the delta specs (7 package, 6 release); 13 accounted for; none uncovered.

| Scenario | Delta | Covering tests |
| --- | --- | --- |
| Contents of the packed package | package, ADDED | `tests/package.test.ts -t "Contents of the packed package"` |
| Repository field | package, ADDED | `tests/package.test.ts -t "Repository field"` |
| Asked for its version | package, ADDED | `tests/cli.test.ts -t "Asked for its version"` |
| Run with no supported argument | package, ADDED | `tests/cli.test.ts -t "Run with no supported argument"` |
| Source record | package, ADDED | `tests/carried-tool.test.ts -t "Source record"` |
| Reading a project | package, ADDED | `tests/carried-tool.test.ts -t "Reading a project"` |
| A repository the tool cannot read | package, ADDED | `tests/carried-tool.test.ts -t "A repository the tool cannot read"` |
| The package is not on the registry | release, ADDED | `tests/release-decision.test.ts -t "The package is not on the registry"` |
| The version is unchanged | release, ADDED | `tests/release-decision.test.ts -t "The version is unchanged"` |
| The version is raised | release, ADDED | `tests/release-decision.test.ts -t "The version is raised"` |
| The version is lowered | release, ADDED | `tests/release-decision.test.ts -t "The version is lowered"` |
| A version of another form | release, ADDED | `tests/release-decision.test.ts -t "A version of another form"` |
| The registry cannot be read | release, ADDED | `tests/release-decision.test.ts -t "The registry cannot be read"` |

## Uncovered scenarios

None. Behaviour the change states outside its delta specs (gate workflow, release workflow, hooks, Dependabot, branch protection, Biome and Vitest exclusions, `check:package`) has no scenario and is verified by the task that delivers it in `tasks.md`.

## Assertion classification

### Specified

- `tests/package.test.ts`: the required and forbidden paths in the packed list, the shebang, `repository.url`.
- `tests/cli.test.ts`, `Asked for its version`: exit zero and the printed version. `Run with no supported argument`: non-zero exit, non-empty standard error, empty standard output, for no arguments and for an unknown option or word.
- `tests/cli.test.ts`, `refuses --version with something else`: from the requirement's "any other invocation", which the scenario does not itself list.
- `tests/cli.test.ts`, `reads the package.json beside dist/...`: from the requirement and `design.md` ("reads its version from `package.json` beside `dist/`"). Runs a copy of `dist/` under a different `package.json`, from a directory holding a decoy one, so a hard-coded version or a read from the working directory fails.
- `tests/carried-tool.test.ts`: 40-character hexadecimal commit; exit zero, `schema_version` 1 and `project` for `docs/backlog/AGENTS.md`; exit 2 and empty standard output for neither directory.
- `tests/carried-tool.test.ts`, the `docs/workstreams/AGENTS.md` case of `Reading a project`: from the requirement's "`docs/backlog/` or `docs/workstreams/`", which the scenario does not itself list.
- `tests/release-decision.test.ts`: every exit status, `publish=` result, notice and absence of a `publish=` line in the scenarios, including `0.9.0` against `0.10.0`.
- `tests/release-decision.test.ts`, `A version of another form` with an E404: the scenario's GIVEN sets no condition on the registry, so a malformed `package.json` version must fail even where the package is not on the registry. An implementation testing for E404 first fails this.
- `tests/release-decision.test.ts`, `fails where the registry's version is of another form`: from `design.md`, "a version of any other form fails", and the requirement's "failing where it cannot decide".
- The `npm` stub answering only `view dev-task-board version`: `design.md` names that command. Any other arguments exit 64.

### Derived

- `tests/cli.test.ts`, `Run with no supported argument`: standard error holds no stack frame. A message, not an uncaught throw, which would otherwise satisfy the scenario.
- `tests/cli.test.ts`, `Run with no supported argument`: `dist/cli.js` exists, and the status is not null. Without the first, a missing build satisfies the refusal.
- `Asked for its version` and `The package is not on the registry` and the like compare trimmed output for exact equality: the version alone, and only the `publish=` line. Inferred from `tasks.md` 5.3 (prints `0.1.0`) and from `design.md` printing for `$GITHUB_OUTPUT`.
- `tests/release-decision.test.ts`: `tools/release-decision.mjs` exists, and `askedTheRegistry` is true in the failing scenarios that reach the registry. Without them a missing script satisfies every "exits non-zero" scenario, or a failure before reading the registry satisfies a scenario about what it reported.
- `tests/release-decision.test.ts`: the extra version pairs beyond the spec's example (`0.1.10`/`0.1.9`, `10.0.0`/`9.0.0` and so on), and the forms `0.1` and `1.2.3.4`, and `E403`, `E500`. Each falsifies a string comparison or a partial form check.
- `tests/package.test.ts`, `namesRepository`: accepts exactly the stated URL with an optional `git+` prefix and `.git` suffix, since `npm pkg fix` normalises to that form.
- `tests/carried-tool.test.ts`, `Fixtures are isolated from the surrounding Git`: no scenario covers it. From `design.md`'s isolation decision: building a fixture under a surrounding `GIT_DIR` and `GIT_WORK_TREE` leaves that repository's `HEAD` unchanged. It tests this file's local builder and will need moving with it (see below).

### Deliberately untested

- The `dist/cli.js` executable bit: `tsc` does not set it and npm sets it at install, so it is `npm`'s behaviour. The tests run the command through `node`.
- `npx dev-task-board@0.1.0 --version`: needs a published package; `tasks.md` 5.3.
- `tools/` absent from `files` in `package.json` as such: the packed list is what the scenario asks about.
- The exact `npm error code E404` reading against text merely mentioning E404: `design.md` states the reading, and no scenario distinguishes them, so a case would design behaviour.

### Static checks and their discriminators

Four checks do not execute what they assert once their target exists: the packed-list check (over a list), the shebang read, the `repository.url` read and the source-record read. Each has fixture-driven discriminators in the same file: `tests/package.test.ts -t "over material chosen to falsify"` and `tests/carried-tool.test.ts -t "over material chosen to falsify"`.

- The four real checks are red at authoring, on: `dist/cli.js` and `vendor/` absent from the packed list; no shebang line; `repository.url` absent; no commit in the source record. Observed under the stand-in only, as absent targets, so the property itself has not been seen to fail.
- The discriminators were executed under the stand-in and came back as designed: each falsifying case was rejected. They have not been executed under Vitest, for the reason under Baseline.
- The packed list's discriminators work on lists, so they do not exercise `listPackedFiles`' parse of `npm pack --json`. `tasks.md` 2.3 (fails when `files` drops `vendor/`) is that check.

## Obsolete tests

Not applicable: every delta in the change is `ADDED`, so no behaviour is superseded or removed.

## Unresolved project questions

1. **How the carried tool takes its target.** The spec says "with `--json` and the fixture as target"; nothing in the read set states the form, and the tool is the implementation under test. Assumed: `bash vendor/task-board --json <path>`, positional, run from a directory other than the fixture. Depends on it: `tests/carried-tool.test.ts -t "Reading a project"`, `tests/carried-tool.test.ts -t "A repository the tool cannot read"`. If wrong, the invocation in `runCarriedTool` is a broken test (third state): change the invocation only. Note that a usage error may also exit 2, so `A repository the tool cannot read` alone does not prove the form; `Reading a project`, through the same function, does.
2. **What the `gh` stub answers.** No convention states it. Assumed: exits 1 with a message, as an unauthenticated `gh`. With no remote the tool may never call it. Depends on it: `tests/carried-tool.test.ts -t "Reading a project"`, `tests/carried-tool.test.ts -t "A repository the tool cannot read"`.
3. **Isolation beyond `GIT_*`.** The design names removing `GIT_*`, an identity and `commit.gpgsign=false`. Added: `HOME` and `XDG_CONFIG_HOME` point into the fixture, so a user's global Git configuration and `gh` login do not reach it. Identity is passed as `-c` on the commit rather than through `GIT_AUTHOR_*`, so the environment holds no `GIT_*` variable at all. `/etc/gitconfig` still applies. Depends on it: all of `tests/carried-tool.test.ts`.
4. **Biome's and `tsc`'s view of these files.** Neither configuration exists. The files are written in Biome's defaults (tabs, double quotes) and for `strict`, unverified by either tool. Should `biome ci` object to formatting, a format-only edit does not change what a test asserts. Depends on it: all four test files.
5. **Vitest's API.** `vi.setConfig`, `vi.stubEnv`, `vi.unstubAllEnvs` and `it.each` are used without a pinned version to check them against; no stack skill for TypeScript or Vitest exists in the library, so the floor alone applied. Depends on it: all four test files.
6. **`tests/support/` does not exist.** The conventions and the dispatch name it and describe its fixture builder, but it is absent from this worktree, and `tasks.md` 1.4 has it written "if the derived tests did not". This pass may not write it (see below). Assumed: 1.4 writes it, after these tests. Depends on it: the entries below.

## Missing shared arrangement

The dispatch named `tests/support/`; the directory does not exist, so it holds no arrangement and no near-miss for any entry. Each entry's proposed home is a module there, for `tasks.md` 1.4 and the `apply` step's promote-or-keep decision. None was found in another test module; these are the first test files. Checks (`packageContentProblems`, `beginsWithShebang`, `namesRepository`, `holdsFullCommit`) are not arrangement and are not listed.

| Declared name | Declared in | Stands in for | Used by | Near-miss | Found in a test module | Proposed home |
| --- | --- | --- | --- | --- | --- | --- |
| `isolatedEnvironment` | `tests/carried-tool.test.ts` | The isolated environment `design.md` assigns to `tests/support/`'s fixture builder, including the `gh` stub written on `PATH` | every test in the file that runs Git or the tool: `-t "Reading a project"`, `-t "A repository the tool cannot read"`, `-t "Fixtures are isolated"` | none | no | `tests/support/`, fixture builder |
| `git` | `tests/carried-tool.test.ts` | Running Git in that environment | same | none | no | `tests/support/`, fixture builder |
| `buildFixtureRepository` | `tests/carried-tool.test.ts` | The fixture builder itself: one commit on `main`, no remote, identity and `commit.gpgsign=false` per command | same | none | no | `tests/support/`, fixture builder |
| `temporaryDirectory` | `tests/carried-tool.test.ts`, `tests/cli.test.ts` | A cleaned-up temporary directory | `tests/carried-tool.test.ts -t "Reading a project"`, `-t "A repository the tool cannot read"`, `-t "Fixtures are isolated"`; `tests/cli.test.ts -t "Asked for its version"`, `-t "Run with no supported argument"` | none | no | `tests/support/`, one module for both files |
| `stubNpm`, with `reports` and `failsWith` | `tests/release-decision.test.ts` | `npm` on `PATH`: answers `view dev-task-board version` with a version, or fails with `npm error code <code>` on standard error; logs its calls | every test in `tests/release-decision.test.ts` | none | no | `tests/support/`, if a later change needs an `npm` stub; otherwise keep local |
| `repositoryRoot` | all four test files | The repository's root, from the test file's own location | every test in those files | none | no | `tests/support/`, or keep local: one line |

If the isolation builder is promoted, move `tests/carried-tool.test.ts -t "Fixtures are isolated"` onto it unchanged in what it asserts: it then holds the shared builder, which is what `tasks.md` 1.4's verification reaches for.
