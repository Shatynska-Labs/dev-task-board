# Test plan: switch-between-workspaces

Derived from the delta specs of the committed plan (`9fd8bfc`), before implementation. This file is not an artifact the OpenSpec schema knows about, so it does not appear among `openspec instructions apply`'s context files and has to be read on purpose.

Select a test with `npx vitest run <file> -t "<describe> <describe> <it>"`, the names below joined by spaces; `-t` matches a substring, so a describe or scenario name alone selects its group. Below, `R`, `P`, `S`, `B` and `T` stand for these files:

- `R` = `tests/account-reads.test.ts`
- `P` = `tests/account-render.test.ts`
- `S` = `tests/account-settings.test.ts`
- `B` = `tests/account-board.test.ts`
- `T` = `tests/tabs-server.test.ts`

## Baseline

**Full**, before any test was written, on `9fd8bfc`: `npm test` gave 14 files passed, 295 tests passed, 1 skipped, none failing. The skipped one is `starts on 8766 with no arguments`, which skips where the port is taken. `npm test` excludes `tests/package.test.ts`, which was not run.

After this pass: 14 existing files still pass with the same 295 tests. The 5 new files hold 71 tests: 54 fail and 17 pass. `npx biome ci .` passes. `npx tsc --noEmit` reports two errors, both in `T` at the `draws no tabs given %s` calls (`renderOverview` with 3 arguments, `renderProject` with 4). Both are the absent argument and go when `src/render.ts` gains it.

## Scenarios

29 scenarios in the delta specs: 10 in `settings`, 9 in `project-reads`, 10 in `board-pages`. 29 accounted for here: 29 covered, 0 uncovered. No `REMOVED` or `RENAMED` delta.

### settings: Bad settings refuse the start (MODIFIED)

The revision adds the `github_account` clause and drops "not yet supported". Seven scenarios carry the same text as the current spec and state no behavior this change introduces, so they are accounted for by existing tests that were green at baseline. No new test was written for those seven. Only `A github account` has revised text.

| Scenario | Covering tests |
| --- | --- |
| Missing file | existing `tests/board.test.ts`: `Bad settings refuse the start Missing file` |
| Two projects of one name | existing `tests/settings.test.ts`: `Bad settings refuse the start Two projects of one name` |
| A reserved name | existing `tests/settings.test.ts`: `Bad settings refuse the start A reserved name` |
| A name unusable in an address | existing `tests/settings.test.ts`: `Bad settings refuse the start A name unusable in an address` |
| Paths are checked before duplicates | existing `tests/settings.test.ts`: `Bad settings refuse the start Paths are checked before duplicates` |
| A project with no usable name | existing `tests/settings.test.ts`: `Bad settings refuse the start A project with no usable name` |
| A project that does not exist | existing `tests/settings.test.ts`: `Bad settings refuse the start A project that does not exist` |
| A github account | `S`: `Bad settings refuse the start A github account` (all); `B`: `Bad settings refuse the start A github account` (all) |

### settings: A workspace may name a GitHub account (ADDED)

| Scenario | Covering tests |
| --- | --- |
| With an account | `S`: `A workspace may name a GitHub account With an account` (all); `B`: `A workspace may name a GitHub account With an account starts the board` |
| Without an account | `S`: `A workspace may name a GitHub account Without an account holds no account` |

### project-reads: A read uses its workspace's GitHub account (ADDED)

| Scenario | Covering tests, all in `R` unless marked, under `A read uses its workspace's GitHub account` |
| --- | --- |
| A token for the account | `A token for the account` (all 5); `B`: `A read uses its workspace's GitHub account A token for the account neither logs the token nor shows it` |
| Two workspaces, two accounts | `Two workspaces, two accounts gives each read the token of its own workspace's account` |
| Asked for each read | `Asked for each read` (both) |
| No token | `No token` (all 7 selected by the name, which also selects the `No token, and the tool fails` group) |
| Without gh | `Without gh reads with forge none, and the project holds the account's name` |
| A token that does not come | `A token that does not come` (all 3) |
| No token, and the tool fails | `No token, and the tool fails` (all 3) |
| Stopping while a token is taken | `Stopping while a token is taken stops gh, and no tool is started` |
| No account | `No account does not ask gh for a token, and the tool sees the same GH_TOKEN` |

### board-pages: Several workspaces show as tabs (ADDED)

| Scenario | Covering tests, in `T` under `Several workspaces show as tabs` unless marked |
| --- | --- |
| Several workspaces | `Several workspaces` (all 4); `B`: `Several workspaces show as tabs Several workspaces shows them on a running board, in the order of the file` |
| On a project's page | `On a project's page links to each overview, and marks only its workspace` |
| One workspace | `One workspace` (all 3) |
| A name needing care | `A name needing care` (both) |
| Another workspace is not read | `Another workspace is not read` (both) |

The requirement's sentence that `/` stays a list has no scenario of its own. `The list of workspaces stays a list at /, with no tab marked and nothing read` covers it.

### board-pages: A page names an account it could not use (ADDED)

| Scenario | Covering tests, under `A page names an account it could not use` |
| --- | --- |
| No token, nothing held before | `P`: `No token, nothing held before` (all 3); `R`: `No token, nothing held before names the account and says statuses may be wrong on its page and overview`; `B`: `No token, nothing held before names the account on a running board's pages` |
| No token, a full document held | `P`: `No token, a full document held` (both); `R`: `No token, a full document held keeps the document, and the latest read names the account` |
| No token, and the read failed | `R`: `No token, and the read failed shows the reason, naming the account, on its page and overview` |
| An account's name needing care | `P`: `An account's name needing care` (both) |
| A token again | `R`: `A token again names no account after a later full read` |

The requirement's sentence that the line appears once is covered by `P`: `The line of what was missed` (both). The line's content is covered by `P`: `What a document missed` (both).

## Uncovered scenarios

None. What is left out at the level of a clause, not of a scenario, is under *Deliberately untested*.

## What each failure establishes now

All new tests execute the behavior they assert, so this is the first situation of `testing`. There are no static checks and no fixture-driven discriminators are owed.

- **Absent target, 27 tests in `R` and 4 in `S`, with `Error: ... github_account is not yet supported`.** The arrangement goes through `parseSettings`, so these stop at the refusal and **their assertions have not executed yet**. Their first real result comes once task 1.1 lands.
- **Absent target, 3 tests in `B`** (`starts the board`, `neither logs the token nor shows it`, `names the account on a running board's pages`). The board refuses the settings, for the same reason.
- **Wrong value, the assertions ran: 12 tests.** 10 in `P` (`whatMissed` and the render do not name the account) and the 2 `does not call one that is %s unsupported` in `S`.
- **Wrong value, the assertions ran: 8 tests.** 7 in `T` and 1 in `B`: no tabs are drawn.

That is 34 absent and 20 wrong value, the 54 failing.

**Passes on first run, 17 tests, each investigated.** In each the behavior already exists, and the test stands as a guard that this change must not break it. None is coverage of new behavior.

- `S`: `refuses one that is %s...` (5) and `is checked ahead of the projects`; `B`: `exits non-zero where it is %s...` (2). Everything naming `github_account` is refused today. These turn meaningful once the field is accepted. The red `does not call one that is %s unsupported` tests are what discriminate today.
- `S`: `Without an account holds no account`.
- `R`: `No account does not ask gh for a token, and the tool sees the same GH_TOKEN`.
- `P`: `names no account for a document with none`.
- `T`: `One workspace` (3), `Another workspace is not read` (2), `The list of workspaces` (1). No tabs exist yet, so they cannot yet add a read or a mark. They guard the implementation that draws them.

## Assertion classification

**Specified** means it traces to a delta-spec scenario or requirement sentence. **Specified (design)** means it traces to a decision stated in `design.md`, not to the delta spec. **Derived** means no stated requirement covers it, so it may be reconsidered, and a mismatch there is not by itself proof the code is wrong.

Everything not listed under the other two headings is **specified**.

**Specified (design):**

- `R`: the literal `GH_CONFIG_DIR` value `/dev/null/gh` in `No token runs the tool with no login where gh %s` and `Without gh`.
- `R`: the field `no_token_for` on the document (every `R` and `P` use of it; also the arrangement in `P`).
- `R`: the reason's opening `no token for GitHub account someone: ` in `A token that does not come` and `No token, and the tool fails`. The spec requires only that the reason name the account.
- `R`: `keeps what gh wrote on standard error out of every reason`.
- `R`: `prints only a line break`, read as design's "empty output". See derived, below, for the trimming.
- `T`: `draws no tabs given %s` (the render signature, as an optional last argument of names).
- `P`: `is a line naming the account, beside the forge line`, for the two-line length (design: "The `forge` line beside it stays true").
- `S`: `is checked ahead of the projects` traces to task 1.1 in `tasks.md`, the closest stated source, not to the spec.

**Derived:**

- `S`: `does not call one that is %s unsupported`. The spec removes the phrase but does not forbid it in a type refusal. A number being called unsupported would be false.
- `S`: `refuses one that is a boolean / a list / a table`. Covered by the requirement's "not a non-empty string", beyond the scenario's empty and number.
- `S`: `keeps each workspace's account apart from another's`.
- `S`: `reads it as given` uses a value with surrounding spaces, so it pins that whitespace is neither trimmed nor refused.
- `R`: `prints only a line break` counts whitespace-only output as no token.
- `R`: `does not change the active login` (no `auth switch`). The spec states the board's environment; the proposal states the login.
- `R`: `reports nothing about the account` (with a token, the document is exactly what was printed).
- `R`: `does not name the account where a token came and the tool failed`.
- `R`: `takes the time gh took out of the tool's limit`: the 600 ms margin. The bound itself is specified.
- `R`: `reads forge full through the same gh with a token, so that test can fail`. A control for the carried-tool test beside it.
- `R`, `A token that does not come`: the 1000 ms margin on elapsed time.
- `P`: `names the account where the document shown still reached the forge` (`no_token_for` with `forge` `full`). It follows from the requirement, but no scenario states it.
- `P`: `names no account for a document with none`, for the word `account`.
- `T`: `names each tab`, that a tab's text is exactly the name.
- `T`: `needs no script`, the specific reading: no `<script` and no `on*=` attribute.
- `T`: `shows no tabs`, read as no `aria-current` anywhere.
- `B`: `shows them on a running board`, for the tab order on a real start.

**Deliberately untested:**

- That a real `gh` under the no-token environment cannot use a login. The suite stubs `gh`, and task 2.1 records it as a one-off manual check. The stub in `R` models `design.md`'s statement that an unusable `GH_CONFIG_DIR` makes `gh` exit 1.
- That `GH_TOKEN` is preferred to `GITHUB_TOKEN`, and to stored logins, by a real `gh`. `gh`'s behavior, as above.
- That a token never reaches a log inside the tool. The tool does not change here, and a token in the child's environment is the stated design.
- `git fetch` behavior under each environment, Enterprise hosts, SSH remotes: the design's listed risks, out of scope.
- The tabs' styling in `src/style.ts`: no stated behavior.
- `README.md` and version edits in tasks 4.1: no delta scenario, and `check:package` and the plan's own task verify them.

## Obsolete tests

Each is a **candidate for human confirmation**, not a conclusion. Search: the `Bad settings refuse the start` requirement against everything matching `tests/**/*.test.ts`, by `github_account`, `not yet supported`, `GH_TOKEN` and `GITHUB_TOKEN`. Both were found by the first two terms. No earlier `test-plan.md` was supplied. I edited neither.

1. `tests/settings.test.ts`, `Bad settings refuse the start A github account is refused, saying it is not yet supported`.
   - Superseded by: `settings`, MODIFIED `Bad settings refuse the start`, and ADDED `A workspace may name a GitHub account`.
   - Evidence: it asserts that `github_account = "someone"` is refused with `/not yet supported/i`. The current requirement's last sentence says this, the delta removes it, and the scenario `With an account` now accepts that value. Task 1.1 names it for removal.
2. `tests/board.test.ts`, `Bad settings refuse the start A fault in the file refuses a github account, naming the settings file and the fault`.
   - Superseded by: `settings`, the same MODIFIED and ADDED deltas.
   - Evidence: the case's text is `projects = ["/"]` with `github_account = "x"`, and it expects `github_account` on standard error. A non-empty string is now accepted, so the refusal is for the path `/` and will not name the field. Task 1.1 names it, to change to `github_account = ""`, which then relies on the check coming ahead of the one on `projects` (see `S`, `is checked ahead of the projects`).

No other bearing test was found by this search. That means none was found, not that none exists: the search matched terms, and a test depending on this behavior without naming them would not appear.

## Unresolved project questions

1. **The stack has no skill.** The library carries no TypeScript or Vitest skill, so this pass stands on `testing` alone and takes its idiom from the existing tests. Nothing depends on it beyond style.
2. **What a parsed workspace calls its account.** No artifact names the property. Assumption: none is taken. `S` looks for the value among the workspace's values, and `R` passes `parseSettings`' output straight to `createReads`. The tests depend on `createReads` accepting what `parseSettings` returns, and on the value being a direct property of the workspace. Dependent tests: `S` `With an account`, and all of `R`.
3. **How the board passes a workspace with no account.** `S`, `Without an account holds no account`, uses `toEqual`, which passes for an absent or undefined field and fails for `null` or `""`. Assumption: absent or undefined. The existing `A valid file` tests make the same one.
4. **The type of a render function's new argument.** The dispatch and `design.md` say a list of workspace names. Assumption: `string[]`, optional, last. Dependent test: `T` `draws no tabs given %s`.
5. **Where tests for a change go.** The conventions do not say. Assumption: new files named for the subject, as `keep-*` and `refresh-*` are, grouped by requirement and scenario in `describe`, as those are.

## Missing shared arrangement

`tests/support/` was read and holds `isolatedEnvironment` (with an always-failing `gh` stub), `git`, `buildFixtureRepository`, `temporaryDirectory`, `removeTemporaryDirectories` and the build setup. All are used as they stand. Nothing was written to it. The proposed home for every entry is in `tests/support/`, as named. Each is declared in the file named, and the tests using it are that file's groups named.

| Declared in | Name | Stands in for | Tests using it | Near-miss in shared arrangement | Found in a test module | Proposed home |
| --- | --- | --- | --- | --- | --- | --- |
| `R` | `machine`, `writeGh` | the `gh` port: tokens per account, unusable `GH_CONFIG_DIR`, logging; also the process environment | all of `R` | `isolatedEnvironment`'s `gh`: always exits 1 and logs nothing, so it cannot give a token or a forge `full` | the environment half is `useIsolatedProcessEnvironment` in `tests/reads.test.ts` | a new `tests/support/gh.ts`, or extending `isolatedEnvironment` with an optional `gh` body |
| `R` | `ghThatDoesNotAnswer`, `pidIn`, `holdsPid`, `isRunning` | a `gh` that hangs, and process inspection | `A token that does not come`, `Stopping while a token is taken` | as above | `slowGh` in `tests/board.test.ts`; `readPid`, `holdsPid`, `isRunning` in `tests/reads.test.ts` | `tests/support/gh.ts`, `tests/support/process.ts` |
| `R` | `pathWithNoGh` | a `PATH` lacking `gh` | `Without gh` | none | `pathWithout` in `tests/board.test.ts` | `tests/support/fixture.ts` |
| `R` | `scriptedTool`, the `project-is-token` tool, `fullDocument` | the carried tool, with `forge` decided by `gh` | most of `R` | none | `scriptedBoard` in `tests/keep-reads.test.ts`, near but with no environment log or `gh` rule | `tests/support/tool.ts` |
| `R` | `settings`, `board`, `get`, `held`, `failedReason`, `lines`, `tokenRequests`, `missedBy`, `page`, `overview`, `textOf`, `waitUntil` | settings text, and reads helpers | all of `R` | none | `held`, `lines`, `missedBy`, `waitUntil` in `tests/keep-reads.test.ts`; `textOf` in `tests/render.test.ts` | `tests/support/reads.ts`; or keep local, being short |
| `P` | `fullDocument`, `noToken`, `task`, `read`, `keptPast`, `missedBy`, `page`, `row`, `textOf`, `count` | document and project-state builders, page text | all of `P` | none | near-identical in `tests/keep-render.test.ts` | `tests/support/documents.ts` |
| `S` | `workspace`, `refusal`, the logging `gh` | a settings table with a field; a refusal | all of `S` | `isolatedEnvironment`'s `gh`, as above | `refusal` and a different `workspace` in `tests/settings.test.ts` | keep local, or `tests/support/gh.ts` for the `gh` |
| `T` | `document`, `read`, `workspaces`, `recordingReads`, `anyReads`, `serve`, `body`, `links`, `address`, `addresses`, `marked` | the `reads` port and an HTTP client | all of `T` | none | `readEverything`, `serve`, `request` in `tests/server.test.ts`; `stubReads` in `tests/keep-reads.test.ts`, which does not record `get` | `tests/support/server.ts` |
| `B` | `settingsFile`, `writeSettings`, `ghHolding`, `start`, `freePort`, `listening`, `body`, `project` | a running board and its settings | all of `B` | `isolatedEnvironment`'s `gh`, as above | all but `ghHolding` in `tests/board.test.ts` | `tests/support/board.ts` |

**Disposition**: every entry above is kept local. The backlog entry `share-the-test-arrangement` moves what several test files declare into `tests/support/` as one change, and promoting these alone would do part of it twice, once for this change's names and again for the older files that are their near-misses. That entry is to name these files when this change archives.

## What the implementation must make pass

Everything in `R`, `P`, `S`, `B` and `T`, plus the two obsolete candidates resolved, as task 1.1 says. Task map:

- Task 1.1: `S`, and `B`'s `Bad settings refuse the start` and `With an account`.
- Task 2.1: `R`'s `A read uses its workspace's GitHub account` and `B`'s `neither logs the token nor shows it`.
- Task 2.2: `P`'s `What a document missed`, and `R`'s `A page names an account it could not use`, and the `no token for GitHub account` reasons.
- Task 3.1: `T`, `B`'s tabs test, and the rest of `P`.

Timing: `R`'s limit tests use real time with margins, 600 ms on the shared limit. A correct implementation finishes near 1.5 s against a 2.3 s bound, and a separate limit would take at least 2.5 s.
