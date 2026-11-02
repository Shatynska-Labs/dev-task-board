# Test plan: read-on-refresh

Written before implementation, from the delta specs at `eb7e2b7`. Select a test with `npx vitest run <file> -t "<pattern>"`; a pattern below is the scenario's `describe` name unless a test name is given. `npm test` runs everything but `tests/package.test.ts`.

The tests of this pass are all in four new files, `tests/refresh-reads.test.ts`, `tests/refresh-server.test.ts`, `tests/refresh-render.test.ts` and `tests/refresh-board.test.ts`. No existing test file was touched.

## Baseline

Full suite through `npm test`, before any test here: 8 files, 187 passed, 1 skipped, 188 collected. The skip is `tests/board.test.ts -t "starts on 8766 with no arguments"`, which skips itself because the operator's own board holds that port.

## After this pass

`npm test`: 12 files, 240 tests collected: 199 passed, 40 failed, 1 skipped. The 187 passes and the skip of the baseline are unchanged, and 12 of the new tests pass. `npx biome ci` is clean on the new files. `npx tsc --noEmit` reports only `Property 'refresh' does not exist on type 'Reads'`, 14 times, in `tests/refresh-reads.test.ts`.

| File | Failing | State | What that establishes |
|---|---|---|---|
| `tests/refresh-reads.test.ts` | 12 of 13 | `TypeError: reads.refresh is not a function` | target absent; **the assertions of these 12 have never run** |
| `tests/refresh-server.test.ts` | 19 of 27 | a wrong value: no `refresh` call, 200 not 403, no `Cache-Control`, no limit reason | the code ran and discriminated |
| `tests/refresh-render.test.ts` | 6 of 9 | a wrong value: no read time on the page or row | the code ran and discriminated |
| `tests/refresh-board.test.ts` | 3 of 3 | a wrong value: the page did not change, or answered at once with `being read` | the code ran and discriminated |

Because 12 tests have never reached an assertion, a defect in those tests themselves is possible and unobserved. Read a first failure there against the provenance rule: a specified assertion that does not match means the code is wrong, and a wrong call or arrangement is a defect in the test.

**The 12 first-run passes** were investigated and none is new coverage yet:

- `tests/refresh-server.test.ts -t "A request that names no project to read"` (7) and `-t "starts no read for an address that would be 404"`: nothing reads on a request today, so no read starting is what already happens. They start to discriminate when `pageFor` calls `refresh`, whose presence the failing tests of `A refresh shows a change` hold.
- `tests/refresh-reads.test.ts -t "starts no read after the pass at start"`: there is no timer today. The same reason.
- `tests/refresh-render.test.ts -t "shows the failed project's reason, and no time of a read"`: its negative half is trivially true while no page shows a time. `-t "keeps the steps and the marked unplaced task inside <details>"`: unchanged behaviour. `-t "sends no script on any page"`: pages carry no script today, and this holds that.

## Scenarios

16 scenarios in the delta specs, 16 accounted for here, each covered. The `RENAMED` delta carries no scenario of its own: the requirement it renames is the `MODIFIED` one, whose 7 scenarios are below.

### project-reads (7), `Each project is read at start and when requested`

| Scenario | Tests |
|---|---|
| A readable project | `tests/refresh-reads.test.ts -t "A readable project"`; existing, unchanged: `tests/reads.test.ts -t "A readable project"` |
| The server answers during a read | `tests/refresh-reads.test.ts -t "The server answers during a read"`; `tests/refresh-board.test.ts -t "The server answers during a read"` |
| A changed project is requested | `tests/refresh-reads.test.ts -t "A changed project is requested"` |
| Two requests during one read | `tests/refresh-reads.test.ts -t "Two requests during one read"`; `tests/refresh-board.test.ts -t "Two requests during one read"` |
| Nobody is asking | `tests/refresh-reads.test.ts -t "Nobody is asking"` |
| An overview reads every project | `tests/refresh-reads.test.ts -t "An overview reads every project"` |
| A request that names no project to read | `tests/refresh-server.test.ts -t "A request that names no project to read"`; `tests/refresh-server.test.ts -t "A request from another site"` |

Task 2.1's stopped board, from the unchanged `Stopping the board stops its reads`: `tests/refresh-reads.test.ts -t "A request's read and stopping"`.

### board-pages (9)

| Scenario | Tests |
|---|---|
| Mixed states | `tests/refresh-render.test.ts -t "Mixed states"` |
| The sections | `tests/refresh-render.test.ts -t "The sections"`; existing, unchanged: `tests/render.test.ts -t "The sections"` |
| A project with no workstreams | `tests/refresh-render.test.ts -t "A project with no workstreams"`; existing, unchanged: `tests/render.test.ts -t "A project with no workstreams"` |
| The time of the read | `tests/refresh-render.test.ts -t "The time of the read"` |
| A refresh shows a change | `tests/refresh-board.test.ts -t "A refresh shows a change"`; `tests/refresh-server.test.ts -t "A refresh shows a change"` |
| A read past its limit | `tests/refresh-server.test.ts -t "A read past its limit"` |
| A request from another site | `tests/refresh-server.test.ts -t "A request from another site"` |
| A request from the reader | `tests/refresh-server.test.ts -t "A request from the reader"` |
| Not cached | `tests/refresh-server.test.ts -t "Not cached"` |

The requirement's `SHALL carry no script`, which no scenario states: `tests/refresh-render.test.ts -t "No script"`.

## Uncovered scenarios

None of the 16.

## Assertion classification

Every assertion is **specified**, tracing to its scenario or requirement sentence, except those listed here. No test here is a static read, so no fixture-driven discriminator is owed.

**Specified by `design.md`**, not by the delta specs:

- `refresh(workspace, project?)`, its promise settling when the reads end and never rejecting: `settles, with the reason in place of the document, when the read fails`.
- A failed read replaces the document with the reason: the same test.
- After `stop()`, `refresh` reads nothing and settles at once: `reads nothing after stop(), and settles at once`.
- The pass at start joins a read a request began: `has the pass at start join a read a request began`. A request joins the pass's read: `joins the read the pass at start is running`.
- `Read 2026-11-01 22:18:05 UTC` with its word `Read`: `words it as the design does`, and the `Read ` prefix wherever a row or page test holds it. The scenario states only the time.

**Derived**, inferred with no stated requirement. Any of these may be reconsidered, as a recorded change to a derived assertion:

- The shapes `refresh` is called with: `refresh("work", "one")` for a page and `refresh("work")` for an overview, the names being strings as `reads.get`'s are, and the workspace's name as `/` reaches it.
- `refresh` works on a `reads` whose `start()` was not called: `A readable project`, `stops a read a request began`, `Two requests`, `An overview`, and `A read past its limit`.
- `refresh`'s promise resolves to `undefined`: `settles, with the reason...`.
- A read limit's reason matches `/limit|timed? ?out/i`, carried from `tests/reads.test.ts`.
- `A read past its limit`: the status is not asserted, only that the page answers with the reason and does not say `being read`.
- `being read` stays the words for that state: its absence is held in `tests/refresh-board.test.ts` and the limit tests.
- `Mixed states`: the failed row holds no `UTC`. The spec gives a failed project a reason only.
- `does not take the machine's time zone`: the `TZ` stub, from "UTC" in the design.
- `The sections`: `written_at` is matched to the minute, as the existing test does. The time-of-read's position against the sections is left open.
- `Not cached`, the list of workspaces: read as a page.
- `A request from another site`, `/` as well as the two page addresses, and a would-be 404 address starting no read, with its status left open.
- `A request that names no project to read`, `/work/one/more`, beyond the addresses `An unknown address` names.
- `reads again on each request`: the server does not skip a read for its own reasons. The rule of one read at a time is held in `reads`.
- `Nobody is asking`: ten minutes of faked time stands for "between requests", and covers timers from `setTimeout` and `setInterval`.
- `tests/refresh-board.test.ts -t "Two requests during one read"`: `gh` is logged once while a read is held, standing for one read. The second-long wait stands for a second read having had time to reach `gh`. The sharp version is `tests/refresh-reads.test.ts`.

**Deliberately untested:**

- The real 60 second limit and 65 second bound on a request. `limitMs` is tested at 300 ms in-process, as earlier passes did.
- `Nobody is asking` at command level. Only `src/reads.ts` is tested, under faked time. A real wait at command level is what task 4.3 looks at.
- `no-store` on a 403 or 404. The requirement says pages.
- A `Sec-Fetch-Site` value other than the four named, which the spec does not state.
- `Read ...` sitting beside `Written`, from the design: the markup is not stated, and `The accepted layout` leaves markup untested too.
- The order of `Sec-Fetch-Site`, `Host` and address checks, beyond no read starting. A browser's going back with a back/forward cache: task 4.3.
- A reader leaving mid-wait, whose read finishes and is held (design, Risks).
- `reading` reaching a page after `stop()`, which the kept defensive branch serves: existing `tests/render.test.ts` holds that branch.

## Obsolete tests

The change carries `MODIFIED` deltas on `Each project is read once at start` (also `RENAMED`), `The overview shows each project's state` and `A project's page shows its document`. Searched `tests/**/*.test.ts` only, by each dropped phrase (`being read`, `reading`, `once at start`) and by what each test asserts of a request. No earlier `test-plan.md` was supplied as a mapping beyond `openspec/changes/archive/2026-11-01-show-a-workspace/test-plan.md`, named as the form, whose mapping matches. None was edited here.

Every entry is a **candidate for human confirmation**, never a conclusion. All five are in task 3.2's list in some form.

1. **Candidate:** `npx vitest run tests/board.test.ts -t "answers, showing the project as being read"`.
   - **Superseding delta:** `project-reads`, `MODIFIED` `Each project is read at start and when requested`: scenarios `The server answers during a read` and `Two requests during one read`.
   - **Evidence:** lines 497-514 hold a read open by a `gh` that does not finish, ask for that same project's page and its overview, and require 200 with `being read`. A request for a project being read now waits, so with this arrangement it fails on `get`'s 5 second timeout. This is the one test whose behaviour is contradicted.
2. **Candidate:** `npx vitest run tests/render.test.ts -t "says it is being read"`.
   - **Superseding delta:** `board-pages`, `MODIFIED` `A project's page shows its document`: `A page for a project being read or failed` became `a failed project`.
   - **Evidence:** lines 489-493 render a `reading` state and require `being read`. It keeps passing against the branch the design keeps as defensive rendering. No requirement states it any longer, hence task 3.2's retitle.
3. **Candidate:** `npx vitest run tests/render.test.ts -t "shows counts, being read and the reason, each in its project's row"`.
   - **Superseding delta:** `board-pages`, `MODIFIED` `The overview shows each project's state`: `that it is being read` left the requirement, and `Mixed states` went from three projects to two.
   - **Evidence:** line 249 `beta: reading`, lines 261-264. It keeps passing for the same reason as entry 2. The new `Mixed states` tests carry the revised scenario.
4. **Candidate:** `npx vitest run tests/server.test.ts -t "decodes a percent-encoded name"`.
   - **Superseding delta:** `board-pages`, `MODIFIED` `A project's page shows its document`.
   - **Evidence:** line 221 proves the decoding through `being read`, from the stub's `reading` state at line 51. Only the means is superseded, and the decoding still holds, hence task 3.2's read state for it.
5. **Candidate:** `npx vitest run tests/reads.test.ts -t "holds a read that has not finished, and a project waiting, as being read"`.
   - **Superseding delta:** `project-reads`, `MODIFIED` `Each project is read at start and when requested`, scenario `The server answers during a read`.
   - **Evidence:** it is filed under that scenario, whose old `THEN` is gone. Its assertion, that `reads.get` holds `reading`, still states the requirement's `being read` and the design's *`reading` stays a state*, so the likely outcome is keeping it. It is listed so the decision is someone's.

**Examined, not obsolete:** `tests/render.test.ts`'s other uses of `reading` (lines 269, 708, 709) use it only as arrangement and hold while `ProjectState` types it. `tests/render.test.ts -t "says it failed, with the reason"` holds. `tests/reads.test.ts -t "reads one project at a time per workspace, each once"` still states the pass at start. The `RENAMED` delta implies no test change: `describe("Each project is read once at start")` at `tests/reads.test.ts:138` and `tests/board.test.ts:495` is a title only, which task 3.2 renames.

**Tests that will go red for an arrangement reason, not obsolete.** Once `pageFor` calls `refresh`, every test in `tests/server.test.ts` reaching an overview or project page fails until the stub gains `refresh`: `The expected hosts`, `One workspace`, `serves each workspace at its address`, `A project's address`, `binds the loopback address the port was asked of`. Their assertions stand. Task 3.2 names the stub. `tests/board.test.ts`'s `get` has a 5 second timeout, which now covers a real read (`prints its address, and the address answers`, `starts with no gh on PATH`, `shows a project's tasks once its read has finished`); task 3.2 names that too.

## Unresolved project questions

1. **Stack skill.** The library carries no TypeScript or Vitest skill, so this pass stands on the testing floor alone. **Depends on it:** all tests.
2. **Where this change's tests live.** `AGENTS.md` records no rule, the existing files go by module, and the dispatch allows new files only. **Assumption:** four `refresh-*` files, one per level, with each `describe` named for the requirement as the existing ones are. **Depends on it:** all tests; moving them into the module files later is a change of place only.
3. **`refresh`'s arguments.** `design.md` gives `refresh(workspace, project?)` without saying a name or an object. **Assumption:** names, as `reads.get` takes. **Depends on it:** all of `tests/refresh-reads.test.ts` and the `calls` assertions of `tests/refresh-server.test.ts`.
4. **`Written`'s precision.** Neither the spec nor the design says how far `Written` is shown, and only `Read` is given to the second. **Assumption:** minute-level matching as in the existing test. **Depends on it:** `tests/refresh-render.test.ts -t "The sections"`.

The convention files name the shared arrangement, so that raises no question.

## Missing shared arrangement

Dispatched: `tests/support/`, of which `fixture.ts` and `temporary.ts` are reused. Nothing was written to it. Each file below is new, and a test file takes arrangement only from there or from itself, so a helper an existing test module holds is declared again and marked. Proposed homes follow the names in `show-a-workspace`'s plan, where its entries were kept local; none of those modules exists yet.

| Declared | File | Stands in for | Used by | Near-miss in shared arrangement | Found in a test module | Proposed home |
|---|---|---|---|---|---|---|
| `minimalDocument`, `printed` | `tests/refresh-reads.test.ts` | a `--json` document | `tests/refresh-reads.test.ts` | none | `tests/reads.test.ts` | `documents.ts` |
| `documentWith` | `tests/refresh-server.test.ts` | a document with one named task | `tests/refresh-server.test.ts` | none | `tests/server.test.ts`, as the fixed `document` | `documents.ts` |
| `task`, `workstream`, `fullDocument`, `sectionsDocument` | `tests/refresh-render.test.ts` | a `--json` document | `tests/refresh-render.test.ts` | none | `tests/render.test.ts` | `documents.ts` |
| `read`, `failed` | `tests/refresh-render.test.ts` | a project's state | `tests/refresh-render.test.ts` | none | `tests/render.test.ts` | `documents.ts` |
| `oneWorkspace`, `twoWorkspaces` | `tests/refresh-server.test.ts` | workspaces | `tests/refresh-server.test.ts` | none | `tests/server.test.ts`, in part | keep local |
| `stubReads` | `tests/refresh-server.test.ts` | the `reads` port with `get` and `refresh`, recording calls | `tests/refresh-server.test.ts` | none | `readEverything` in `tests/server.test.ts`: lacks `refresh` until task 3.2 and records nothing | `documents.ts`, or a `reads.ts` of its own |
| `hangingBoard` | `tests/refresh-server.test.ts` | a real `reads` over a tool that does not finish | `tests/refresh-server.test.ts -t "A read past its limit"` | none | no | keep local |
| `stubTool` | `tests/refresh-reads.test.ts` | the carried tool, run through `bash` | `tests/refresh-reads.test.ts` | none | `tests/reads.test.ts` | `tools.ts` |
| `projects`, `board`, `get` | `tests/refresh-reads.test.ts` | `Workspace` over real directories; a `reads` stopped after the test | `tests/refresh-reads.test.ts` | `buildFixtureRepository`: makes a Git repository, and these need only a directory | `tests/reads.test.ts`, but for `board` | keep local |
| `changing`, `held`, `logging` | `tests/refresh-reads.test.ts` | a tool that changes, holds or logs a read | `tests/refresh-reads.test.ts -t "A changed project is requested"`, `-t "Two requests during one read"`, `-t "Nobody is asking"` | none | no | keep local |
| `useIsolatedProcessEnvironment` | `tests/refresh-reads.test.ts` | the process environment `createReads` inherits | `tests/refresh-reads.test.ts -t "A readable project"` | `isolatedEnvironment`: returns an environment, and `createReads` takes none | `tests/reads.test.ts` | `fixture.ts` |
| `lines`, `waitUntil`, `isRunning` | `tests/refresh-reads.test.ts` | observing a log, a condition, a process | `tests/refresh-reads.test.ts` | none | `tests/reads.test.ts`, `tests/board.test.ts` | `processes.ts` |
| `lines`, `waitUntil` | `tests/refresh-board.test.ts` | the same | `tests/refresh-board.test.ts` | none | `tests/board.test.ts` | `processes.ts` |
| `delay`, `tracked` | `tests/refresh-reads.test.ts`; `delay` also in `tests/refresh-server.test.ts`, `tests/refresh-board.test.ts` | a real wait, and whether a promise has settled | those files | none | no | `processes.ts` |
| `holdingGh` | `tests/refresh-board.test.ts` | a `gh` holding a read until released, by project | `tests/refresh-board.test.ts -t "The server answers during a read"`, `-t "Two requests during one read"` | `isolatedEnvironment`'s `gh` stub fails at once and takes no script, so this overwrites `stubs/gh` | `slowGh` in `tests/board.test.ts`: never releases, and holds every project | `fixture.ts`, as an option of `isolatedEnvironment` |
| `commitEntry` | `tests/refresh-board.test.ts` | a later commit in a fixture | `tests/refresh-board.test.ts -t "A refresh shows a change"` | `buildFixtureRepository`: commits one file, once | inline in `tests/board.test.ts`, `tests/render.test.ts` | `fixture.ts` |
| `writeSettings`, `fixtureProject` | `tests/refresh-board.test.ts` | a settings file and a project | `tests/refresh-board.test.ts` | `buildFixtureRepository` is wrapped, not replaced | `tests/board.test.ts` | `fixture.ts` |
| `start`, `freePort`, `boardOn` | `tests/refresh-board.test.ts` | a running board on a port | `tests/refresh-board.test.ts` | none | `tests/board.test.ts`, but for `boardOn` | `command.ts` |
| `get` | `tests/refresh-board.test.ts` | a request with a chosen timeout | `tests/refresh-board.test.ts` | none | `tests/board.test.ts`, with a fixed 5 seconds | `http.ts` |
| `request` | `tests/refresh-server.test.ts` | a request setting headers | `tests/refresh-server.test.ts` | none | `tests/server.test.ts`, with `Host` alone | `http.ts`, with `get` |
| `textOf`, `expectInOrder`, `smallestDetailsHolding`, `page`, `overview` | `tests/refresh-render.test.ts` | reading a page | `tests/refresh-render.test.ts` | none | `tests/render.test.ts` | keep local |

## Recorded changes to derived assertions

- `tests/refresh-render.test.ts -t "keeps the sections in order, with the written and read times"`, within this pass: `written_at` was first matched to the second, `/2026-11-01.22:17:44/`, which nothing states. It failed on that rather than on the read time, so it is now `/2026-11-01.22:17/`, as the existing test matches it. See question 4.
