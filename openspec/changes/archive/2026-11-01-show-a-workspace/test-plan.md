# Test plan: show-a-workspace

Written before implementation, from the delta specs. Select a test with `npx vitest run <file> -t "<pattern>"`; a pattern below is the scenario's `describe` name unless a test name is given. `npm test` runs everything but `tests/package.test.ts`.

## Baseline

Full suite through `npm test`, before any test here: 3 files, 36 tests, all passing (`carried-tool` 10, `cli` 6, `release-decision` 20), matching what the dispatch stated.

## After this pass

`npm test`: 8 files, 65 tests collected: 47 pass, 18 fail, and 4 files do not load. `npx biome check` is clean on the new files. `npx tsc --noEmit` reports only the four missing modules and, following from one of them, an implicit `any` at `tests/settings.test.ts:93`.

| File | State | What that establishes |
|---|---|---|
| `tests/settings.test.ts` | does not load: `../src/settings.js` absent | target absent; its assertions have never run |
| `tests/reads.test.ts` | does not load: `../src/reads.js` absent | target absent; its assertions have never run |
| `tests/render.test.ts` | does not load: `../src/render.js` absent | target absent; its assertions have never run |
| `tests/server.test.ts` | does not load: `../src/server.js` absent | target absent; its assertions have never run |
| `tests/board.test.ts` | 18 fail, 11 pass | the 18 ran and got a wrong result from the existing command, which prints `usage: dev-task-board --version` and exits 1 |

The 11 first-run passes were investigated and are not new coverage. All are in `tests/board.test.ts`: `Asked for its version` and the 10 cases of `An unknown argument`. The behaviour already exists, since today's command prints its version and refuses everything else. They start to discriminate only once the command can start: a `--port` accepted in error then runs until `spawnSync`'s 15 second timeout and fails.

Because four files do not load, a defect in those tests themselves is possible and unobserved. Read a first failure there against the provenance rule: a specified assertion that does not match means the code is wrong, and a wrong call or arrangement is a defect in the test.

## Scenarios

37 scenarios in the delta specs, 37 accounted for here, each covered. Two more are reached through the `REMOVED` delta; see below.

### settings (10)

| Scenario | Tests |
|---|---|
| Where the file is | `tests/settings.test.ts -t "Where the file is"`; `tests/board.test.ts -t "looks under ~/.config"` |
| A valid file | `tests/settings.test.ts -t "A valid file"` |
| Missing file | `tests/board.test.ts -t "Missing file"` |
| Two projects of one name | `tests/settings.test.ts -t "Two projects of one name"` |
| A reserved name | `tests/settings.test.ts -t "A reserved name"`; `tests/board.test.ts -t "refuses a reserved name"` |
| A name unusable in an address | `tests/settings.test.ts -t "A name unusable in an address"` |
| Paths are checked before duplicates | `tests/settings.test.ts -t "Paths are checked before duplicates"` |
| A project with no usable name | `tests/settings.test.ts -t "A project with no usable name"` |
| A project that does not exist | `tests/settings.test.ts -t "A project that does not exist"` |
| A github account | `tests/settings.test.ts -t "A github account"`; `tests/board.test.ts -t "refuses a github account"` |

The rest of the requirement's fault list: `tests/settings.test.ts -t "Faults of the file's shape"` and `tests/board.test.ts -t "A fault in the file"`.

### project-reads (11)

| Scenario | Tests |
|---|---|
| A readable project | `tests/reads.test.ts -t "A readable project"` |
| The server answers during a read | `tests/reads.test.ts -t "The server answers during a read"`; `tests/board.test.ts -t "The server answers during a read"` |
| The tool refuses | `tests/reads.test.ts -t "The tool refuses"` |
| A failure with nothing on standard error | `tests/reads.test.ts -t "A failure with nothing on standard error"` |
| An unknown schema | `tests/reads.test.ts -t "An unknown schema"` |
| A read past its limit | `tests/reads.test.ts -t "A read past its limit"` |
| A tool that exits zero with bad output | `tests/reads.test.ts -t "A tool that exits zero with bad output"` |
| One failure among several | `tests/reads.test.ts -t "One failure among several"` |
| Stopped during a read | `tests/board.test.ts -t "Stopped during a read"`; `tests/reads.test.ts -t "Stopped during a read"` |
| Stopped with a project waiting | `tests/reads.test.ts -t "Stopped with a project waiting"`; `tests/board.test.ts -t "Stopped with a project waiting"` |
| A missing requirement | `tests/board.test.ts -t "A missing requirement"` |

### board-pages (13)

| Scenario | Tests |
|---|---|
| An unexpected host | `tests/server.test.ts -t "An unexpected host"` |
| The expected hosts | `tests/server.test.ts -t "The expected hosts"` |
| A port in use | `tests/board.test.ts -t "A port in use"` |
| One workspace | `tests/server.test.ts -t "One workspace"` |
| Several workspaces | `tests/server.test.ts -t "Several workspaces"`; `tests/render.test.ts -t "Several workspaces"` |
| An unknown address | `tests/server.test.ts -t "An unknown address"` |
| Mixed states | `tests/render.test.ts -t "Mixed states"` |
| The sections | `tests/render.test.ts -t "The sections"` |
| A project with no workstreams | `tests/render.test.ts -t "A project with no workstreams"` |
| No forge | `tests/render.test.ts -t "No forge"` |
| A full forge | `tests/render.test.ts -t "A full forge"` |
| Markup in a task | `tests/render.test.ts -t "Markup in a task"` |
| Markup in a reason | `tests/render.test.ts -t "Markup in a reason"` |

The requirement sentences beyond the scenarios: `tests/render.test.ts -t "Every task appears"`, `-t "Status, stage and placement come from the document"`, `-t "A page for a project not read"`; `tests/server.test.ts -t "A project's address"`.

### package (3)

| Scenario | Tests |
|---|---|
| Asked for its version | `tests/board.test.ts -t "Asked for its version"`, and the two existing cases in `tests/cli.test.ts` |
| Starting | `tests/board.test.ts -t "Starting"` |
| An unknown argument | `tests/board.test.ts -t "An unknown argument"` |

## Uncovered scenarios

None of the 37. Reached through `REMOVED` `The command reports its version`, and uncovered because of that operation:

- `Run with no supported argument`, from `openspec/changes/establish-quality-gate/specs/package/spec.md`. Its refusal of unknown arguments continues under the added requirement.
- `Asked for its version`, same file. It continues under the same name in the added requirement, listed above.

## Assertion classification

Every assertion is **specified**, tracing to its scenario or requirement sentence, except those listed here. No test here is a static read, so no fixture-driven discriminator is owed.

**Derived**, inferred with no stated requirement. Any of these may be reconsidered, as a recorded change to a derived assertion:

- The spec's phrases as literal text: `being read`, `statuses may be wrong`, `could not be read`, `not yet supported`, `unplaced`. The spec states what is said, not the words.
- `A read past its limit`: the reason matches `/limit|timed? ?out/i`.
- `A project with no workstreams`: absence is read as neither `active workstreams` nor `other workstreams` appearing, which is why `names both workstream sections where there are workstreams` holds their presence. These are the accepted page's headings.
- `A name unusable in an address`, `refuses /`: `toContain("/")` is weak by nature. The strength is in the `SettingsError` with every path a directory.
- `Paths are checked before duplicates`: "not the duplicate" is read as the message equalling the lone missing path's message.
- `A project with no usable name`, `/.` and `/a/..`: refused, without saying which form the message names.
- `Mixed states` and `No forge`: a row is the text from a project's name to the next project's name, so a row's facts must follow its name.
- `Markup in a task`, `Markup in a reason`: escaping is read as `&lt;`/`&gt;`, with `/` left bare.
- `An unknown address`, `/work/`: a trailing slash is 404, reading "any other address" literally. Also `/work/one/more`, `/__proto__`, `/constructor`, `/work/constructor`, `/work/%E0`, `/api`, `/api/work`.
- `The expected hosts`, `answers with HTML`: content type `text/html`.
- `An unexpected host`, `127.0.0.1` and `localhost` with no port: 403, from the requirement's exact form and design's *The `Host` check*.
- `An unexpected host`, `answers 403 before an address would be 404`.
- `No forge`, `shows it for a forge of partial/limited`: those values are invented. Only `none` has been observed besides the spec's `full`.
- `Every task appears`, `stray-of-nothing-shown`: an unplaced task naming a workstream the document lacks still appears; `closed`: a task with a `closed_workstream`.
- `Status, stage and placement come from the document`, all three, as discriminating readings of "from the document alone".
- `A readable project`, `holds a document larger than a pipe's buffer whole`.
- `The server answers during a read` in `reads.test.ts`: a project waiting its turn is `reading`, there being no fourth state.
- `Stopped during a read`, the 7 second bound: 5 seconds' grace plus a margin. The stub stops on `SIGTERM`, so the kill is not exercised at command level; `stop() uses the grace` covers it.
- The `expectRefused` check that no stack trace reaches standard error, as `tests/cli.test.ts` already does.
- Message content in `tests/board.test.ts -t "A fault in the file"`: `github_account` is named.

From `design.md`, not the delta specs, so specified by the design: `Reason:` line else last stderr line (`The tool refuses`), `SettingsError`, the `start()`/`stop()` settling promises.

**Deliberately untested:**

- The real 60 second limit and 5 second grace. Nothing exposes them, by design, and a test would take over a minute; `limitMs` and `graceMs` are tested at short values. `board.ts`'s passing of 60000 and 5000 is unchecked, so check it by review.
- A port that "cannot be bound" other than by being taken: `--port` admits only 1024 to 65535, so there is no reliable way to provoke it.
- `--port 1024` and `--port 65535` accepted: 1024 may be taken and 65535 likewise, and the refusals at 1023 and 65536 hold the boundary from outside.
- `renderNotFound` directly: it is reached only as the body of a 404, and its argument shape is left open.
- Binding `127.0.0.1` alone rather than all interfaces, which needs a non-loopback address the test machine may lack. Check it by review.

## Argument shapes chosen where design left them open

The implementer may change these, moving the tests with them as a recorded change.

- `parseSettings` returns `[{ name, projects: [{ name, path }] }]`, in file order, with `path` normalised and `~/` expanded. This is the `workspaces` of `createReads`, `renderIndex` and `state.workspaces`.
- `isDirectory: (path: string) => boolean`, called with the expanded path.
- `settingsPath(env, home)`: `env` is a plain object.
- `reads.get(workspace, project)` takes the two names as strings.
- `readAt`: anything `new Date(readAt)` reads.
- `reason`: holds the text after `Reason:`; whether the prefix stays is open.
- `renderIndex(workspaces)`.
- `renderOverview(workspace, reads)`: `workspace` is the object, `reads` anything with `get`.
- `renderProject(workspaceName, projectName, projectState)`.
- `startServer({ workspaces, reads }, port)` resolves to the bound port; `await` also accepts a plain number. Port `0` asks for any free port.
- Each `render*` returns a string.

Type-level casts in `tests/render.test.ts` and `tests/server.test.ts` take these from the modules' own signatures, so `tsc` should pass once they exist.

## Obsolete tests

The change carries one `REMOVED` delta and no `MODIFIED`. Searched `tests/**/*.test.ts`; no earlier `test-plan.md` was supplied.

- **Candidate for human confirmation:** `npx vitest run tests/cli.test.ts -t "refuses no arguments"`.
  - **Superseding delta:** `package`, `REMOVED` `The command reports its version`, replaced by `The command reports its version or starts the board`.
  - **Evidence:** the row `["no arguments", []]` of `unsupported`, under `describe("Run with no supported argument")`, asserting a non-zero exit and empty standard output. The delta's reason says refusing no arguments no longer holds. Task 3.3 takes it out. It was not edited here.

The other three cases of that `it.each` (`--unknown`, `serve`, `--version --unknown`) still hold under the added requirement, and so do the two `Asked for its version` cases. Only the outer `describe` title names the removed requirement. No other test in the glob bears on it, by this search.

**Hazard:** `runCommand` in `tests/cli.test.ts` has no timeout and inherits the real `HOME`. Once `dist/cli.js` starts a board, that case reads the real `config.toml`, and where valid settings exist it never returns. Do task 3.3 in the same step as 3.2, before running `npm test` against a command that can start.

## Unresolved project questions

1. **Where document fixtures live.** The dispatch and `proposal.md`'s Impact put them in `tests/support/`. This pass may not write to the shared arrangement, and `tests/support/` is outside the test-path glob. **Assumption:** declared locally in `tests/render.test.ts`, `tests/server.test.ts` and `tests/reads.test.ts`. **Depends on it:** every test using `task`, `workstream`, `fullDocument`, `sectionsDocument`, `document` or `minimalDocument`. They are promotion candidates below.
2. **How a server is closed.** `design.md` has `startServer` return only the port, yet *Shutdown* closes it. **Assumption:** tests never close it; in-process servers stay open until the Vitest worker exits. **Depends on it:** all of `tests/server.test.ts`. Any way of closing that leaves `await startServer(state, 0)` a number satisfies these tests. If the worker then hangs at exit, add a close to the tests as an arrangement change.
3. **Test levels' names.** `AGENTS.md` speaks of unit and integration tests, with no rule beyond that. **Assumption:** a file per module, plus `tests/board.test.ts` for the whole command.
4. **Stack skill.** The library carries no TypeScript or Vitest skill, so this pass stands on the testing floor alone. **Depends on it:** all tests.
5. **Default port.** `starts on 8766 with no arguments` skips itself where 8766 is taken, as it will be while a real board runs. **Assumption:** a skip is better than a failure caused by the operator's own board. Check for the skip in a local run; CI should always execute it.

The convention files name the shared arrangement, so that raises no question.

## Missing shared arrangement

Dispatched: `tests/support/`, of which `fixture.ts` and `temporary.ts` are reused. Nothing was written to it. A test file imports arrangement only from there or from itself, so a helper needed twice is declared twice. Entries give the proposed home in `tests/support/`.

| Declared | File | Stands in for | Used by | Near-miss in shared arrangement | Found in a test module | Proposed home |
|---|---|---|---|---|---|---|
| `task`, `workstream`, `fullDocument`, `sectionsDocument` | `tests/render.test.ts` | a `--json` document | `tests/render.test.ts` | none | no | `documents.ts` |
| `document`, `oneWorkspace`, `readEverything` | `tests/server.test.ts` | a document; workspaces; the `reads` port | `tests/server.test.ts` | none | no | `documents.ts` |
| `minimalDocument` | `tests/reads.test.ts` | a document | `tests/reads.test.ts` | none | no | `documents.ts` |
| `read`, `reading`, `failed` | `tests/render.test.ts` | a project's state | `tests/render.test.ts` | none | no | `documents.ts` |
| `stubTool`, `printsDocument` | `tests/reads.test.ts` | the carried tool, run through `bash` | `tests/reads.test.ts` | none | no | `tools.ts` |
| `projects`, `oneProject` | `tests/reads.test.ts` | `Workspace` over real directories | `tests/reads.test.ts` | `buildFixtureRepository`: makes a Git repository, and these need only a directory | no | keep local |
| `useIsolatedProcessEnvironment` | `tests/reads.test.ts` | the process environment `createReads` inherits | `tests/reads.test.ts -t "A readable project"`, `-t "The tool refuses"` | `isolatedEnvironment`: returns an environment, and `createReads` takes none, so it is applied to `process.env` here | no | `fixture.ts` |
| `readPid`, `holdsPid`, `isRunning`, `waitUntil` | `tests/reads.test.ts` | observing a process and a condition | `tests/reads.test.ts -t "A read past its limit"`, `-t "Stopping the board stops its reads"` | none | no | `processes.ts` |
| `isRunning`, `waitUntil`, `pidsIn`, `lines` | `tests/board.test.ts` | the same, duplicated | `tests/board.test.ts -t "Stopping the board stops its reads"`, `-t "The server answers during a read"` | none | no | `processes.ts` |
| `slowGh` | `tests/board.test.ts` | a `gh` that does not finish | `tests/board.test.ts -t "The server answers during a read"`, `-t "Stopping the board stops its reads"` | `isolatedEnvironment`'s `gh` stub fails at once and takes no script, so this overwrites `stubs/gh` | no | `fixture.ts`, as an option of `isolatedEnvironment` |
| `settingsFile`, `writeSettings`, `workspaceWith`, `fixtureProject`, `validEnvironment` | `tests/board.test.ts` | a settings file and a project | all of `tests/board.test.ts` | `buildFixtureRepository` is wrapped, not replaced | no | `fixture.ts` |
| `pathWithout` | `tests/board.test.ts` | a `PATH` lacking a program | `tests/board.test.ts -t "A missing requirement"` | none | no | `fixture.ts` |
| `run` | `tests/board.test.ts` | the built command, with a timeout | `tests/board.test.ts` | none | yes: `runCommand` in `tests/cli.test.ts`, which lacks the timeout and environment | `command.ts` |
| `start`, `listening`, `expectRefused` | `tests/board.test.ts` | a running board | `tests/board.test.ts` | none | no | `command.ts` |
| `occupy`, `close`, `freePort`, `isFree` | `tests/board.test.ts` | a port | `tests/board.test.ts` | none | no | `command.ts` |
| `get` | `tests/board.test.ts` | a request | `tests/board.test.ts` | none | no | `http.ts` |
| `request` | `tests/server.test.ts` | a request setting `Host` | all of `tests/server.test.ts` | none | no | `http.ts`, with `get` |
| Second commit in `Every task appears` and `Starting` | `tests/render.test.ts`, `tests/board.test.ts` | a fixture with several files | `tests/render.test.ts -t "of a document the carried tool printed"`, `tests/board.test.ts -t "shows a project's tasks"` | `buildFixtureRepository`: commits one file only | no | an extra `committedFiles` form of it in `fixture.ts` |
| `directories`, `workspace`, `refusal` | `tests/settings.test.ts` | an `isDirectory` port; TOML text | `tests/settings.test.ts` | none | no | keep local |
| `textOf`, `detailsBlocks`, `smallestDetailsHolding`, `expectInOrder`, `escapedLink` | `tests/render.test.ts` | reading a page | `tests/render.test.ts` | none | no | keep local |

## Dispositions at apply

Written at `apply`, against the promotion list above.

- Document fixtures (`task`, `workstream`, `fullDocument`, `sectionsDocument`, `document`, `minimalDocument`): kept local. Each file's documents differ in what they need, and only `tests/render.test.ts` has builders worth sharing.
- `stubTool`, `printsDocument`, `waitUntil`, `isRunning`: kept local to the files using them until a later change needs them too.
- How a server closes: `startServer` takes an optional `AbortSignal`, which `src/board.ts` uses, and resolves to the port as tests expect.
- `tests/cli.test.ts`: the no-arguments refusal is out, and every spawn has a temporary `HOME` and `XDG_CONFIG_HOME` and a timeout.
- Every other row of the table: kept local, because each serves one test file and this is the first change with such tests. That covers `oneWorkspace`, `readEverything`, `read`, `reading`, `failed`, `useIsolatedProcessEnvironment`, `readPid`, `holdsPid`, `pidsIn`, `lines`, `slowGh`, `settingsFile`, `writeSettings`, `workspaceWith`, `fixtureProject`, `validEnvironment`, `pathWithout`, `start`, `listening`, `expectRefused`, `occupy`, `close`, `freePort`, `isFree`, `get`, `request`, `directories`, `workspace`, `refusal`, `textOf`, `detailsBlocks`, `smallestDetailsHolding`, `expectInOrder`, `escapedLink` and the second commit form.
- `run` in `tests/board.test.ts` and `runCommand` in `tests/cli.test.ts`: kept apart. They overlap, but `run` also builds a settings environment, and `tests/cli.test.ts` needs none. The next change touching both should merge them.

## Task 4.3's run

With temporary settings naming the three projects, `gh` logged in, on 2026-11-01: `dev-task-board` 6 tasks, 2 in flight; `ai-toolkit` 30 tasks, 1 in flight; `basis` 13 tasks, 0 in flight. Each equals `--json`, every task's name was on its page, `forge` was `full`, a `Host` of `evil.example` got 403, and `SIGINT` exited zero.

## Recorded changes to derived assertions

- `tests/render.test.ts`, `takes a workstream's activity from active, not from its tasks`: it now compares the two names after the `Active workstreams` heading, not across the page. In work rows name their workstream, as the accepted page's do, so the first mention on the page is no longer the section's.

## Tests added by the layout fix

`The accepted layout` in `tests/render.test.ts` holds what the first merge lacked: In work with nothing in flight, age from `written_at`, the stage pipe, unplaced work in progress, the order of tasks in no workstream, and an in-flight row's summary, tag and forge mark. The markup itself stays untested, since no spec states it.
