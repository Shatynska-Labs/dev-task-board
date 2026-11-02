# Test plan: say-what-a-read-missed

Derived from the delta specs before implementation. This file is not an artifact the OpenSpec schema knows about, so `openspec instructions apply` will not list it: read it on purpose.

New files: `tests/keep-reads.test.ts`, `tests/keep-render.test.ts`. No existing test was edited, deleted or disabled.

Run a test with `npx vitest run <file> -t "<describe and test title>"`. `-t` matches a substring of the full title, so a describe title selects its group. In the tables below, `reads` is `tests/keep-reads.test.ts` and `render` is `tests/keep-render.test.ts`.

## Baseline

Full suite, `npm test`, before any test was written: 12 files, 238 passed, 1 skipped (`tests/board.test.ts`, `starts on 8766 with no arguments`), 0 failed.

After this pass: 14 files, 256 passed, 1 skipped, 39 failed. All 39 failures are in the two new files, and the 238 existing passes are unchanged. `npx tsc --noEmit` fails only on the missing `whatMissed` export, at `tests/keep-reads.test.ts:12` and `tests/keep-render.test.ts:2`. `npx biome ci` passes on both new files.

## Scenarios and tests

26 scenarios in the delta specs, 26 accounted for: 26 covered, 0 uncovered. No delta is `REMOVED` or `RENAMED`.

The result column is the first run: `red 1` means the code ran and gave a wrong value, `red 2` means the target `whatMissed` is absent so the assertions have not run, and `pass` means see "Tests that pass today".

### project-reads, MODIFIED: Each project is read at start and when requested

| Scenario | Test (`reads`) | Result |
|---|---|---|
| A readable project | `A readable project holds the document the tool printed` | pass |
| The server answers during a read | `The server answers during a read answers another project's page`; `The server answers during a read answers the list of workspaces` | pass |
| A changed project is requested | `A changed project is requested holds the new document` | pass |
| Two requests during one read | `Two requests during one read starts no second read of a project keeping a document` | red 1 |
| Nobody is asking | `Nobody is asking starts no read after a failed one` | pass |
| An overview reads every project | `An overview reads every project overlaps their reads, the first failing` | red 1 |
| A request that names no project to read | `A request that names no project to read` (three tests: refused Host, 404, list of workspaces) | pass |

The revised sentence, which no scenario states, is covered by `A project is failed only where it holds no document` (`is failed, with the reason` passes; `keeps what it held until the next read finishes` is red 1).

These scenarios' text is unchanged from `openspec/specs/`; only the requirement's sentence on project states changed. Existing tests of the same names still cover them, and the new tests were written as the writer's rule for `MODIFIED` requires, on a project keeping a document where that adds something.

### project-reads, ADDED: A read does not replace a better document

| Scenario | Test (`reads`) | Result |
|---|---|---|
| A failure after a read | `A failure after a read holds the same document and its time` | red 1 |
| An unknown schema after a read | `An unknown schema after a read holds the same document` | red 1 |
| A degraded read after a full one | `A degraded read after a full one holds the same document`; `treats a forge that is partly as degraded`; `treats a forge that is missing as degraded` | red 1 |
| A degraded read with no full document | `A degraded read with no full document holds the new document`; `replaces a document with no forge at all` | pass |
| A failure after a degraded read | `A failure after a degraded read holds the same document` | red 1 |
| A full read with a failed fetch | `A full read with a failed fetch holds the new document` | pass |
| A full read after a kept document | `A full read after a kept document holds the new document` | red 1 (its given state fails) |
| A network outage | `A network outage holds the same document` | red 1 |

Also from the requirement's text and the design, under no scenario: `The latest read is what the project holds` (red 1) and `What a document missed` (five tests of `whatMissed`, red 2).

### board-pages, MODIFIED: A partial forge read is noticed

| Scenario | Test (`render`) | Result |
|---|---|---|
| No forge | `No forge shows the notice once on the page and in the overview's row` | pass |
| A full forge | `A full forge shows no notice for a document kept past no later read` | pass |

### board-pages, ADDED: A page says what a read missed

| Scenario | Test (`render`) | Result |
|---|---|---|
| A full read with a failed fetch | `A full read with a failed fetch says what was missed on the page`; `says what was missed on the overview row` | red 1 |
| No remote | `No remote says there is no remote named origin and that work was read`; `and that topic-branch was read`; `says it on the overview's row` | red 1 |
| Nothing missed | `Nothing missed shows no notice on the page or in the overview` | pass |

### board-pages, ADDED: A page marks a kept document

| Scenario | Test (`render`) | Result |
|---|---|---|
| Kept through a failure | `Kept through a failure shows the tasks, both times, the age and the reason as text` | red 1 |
| Kept on the overview | `Kept on the overview shows the counts, both times, the age and the reason in its row` (red 1); `escapes the reason in its row` (pass) | red 1 |
| Kept through an outage | `Kept through an outage shows the tasks, each of the three things missed, and no later mark` | red 2 |
| Missed by both | `Missed by both says once on the page`; `says it once in the overview's row` | red 2 |
| The units of an age | `The units of an age shows` (ten cases, red 1); `does not floor an age at a minute` (pass) | red 1 |
| A document shown new | `A document shown new marks nothing as kept` | pass |

Also from the requirement's text, under no scenario: `Missed by the document shown alone still says it` and `What a latest read missed is escaped` (both red 1).

## What the first run establishes

31 of the 39 failures are red 1: the code ran and gave the wrong value. The other 8 are red 2, which establishes only that `whatMissed` is absent, and their assertions are unexercised: the five `What a document missed` tests, `Kept through an outage`, and the two `Missed by both` tests. `A network outage` itself is red 1, stopping at the document before it reaches its `missed` assertions, and so are the other kept-document tests. Their later assertions are unexercised for the same reason.

### Tests that pass today

18 new tests pass on their first run. `createReads` and the renderers exist, so these are the second situation and not an alarm, and they fall into two groups.

- Behavior the change keeps: every passing `MODIFIED` scenario test, `is failed, with the reason`, `A degraded read with no full document` (two tests) and `A full read with a failed fetch`. Today's code overwrites the document on each read, which is why these pass. They guard against keeping too much.
- Negatives whose positive sibling is red, so nothing yet shows them able to fail on their own: `Nothing missed`, `A document shown new`, `does not floor an age at a minute`, `escapes the reason in its row`, `A full forge`. The last four pass partly because nothing is drawn yet. Read them again once the implementation exists.

No test here is a static read, so no fixture-driven discriminator is owed.

## Assertion classification

Everything not listed as derived or untested is **specified**: it traces to the delta spec's scenario or requirement text named in the tables above, or to a decision in `design.md`.

Specified by `design.md` rather than the delta specs:

- `latest` being `{ at, reason }` or `{ at, missed }`, and `latest.missed` equal to `whatMissed` of the read not shown.
- A missing `forge` counting as not full (`treats a forge that is missing as degraded`, `replaces a document with no forge at all`, `is the forge line where forge is missing`).
- `whatMissed` giving one line per thing missed, so the `toHaveLength` counts, and two lines for a project with no remote.
- No retry of a failed read (`Nobody is asking`).
- The forge line's wording, `statuses may be wrong`, which the design says stays.

**Derived**, inferred and open to review:

- The age cases past the scenario's four: 59 seconds, 60 seconds, 59 min 59 s, 60 min, 23 h 59 min 59 s, 24 h. They read "whole minutes, hours or days, the largest that fits" as rounding down.
- `does not floor an age at a minute`, read from the design's remark on `age`.
- `No remote ... topic-branch`, added because `work` alone also appears in the page's own wording. It asserts what the scenario does, on a name that can tell them apart.
- `shows the notice once` in `No forge`: the count, read from "in one line".
- The regular expressions' tolerance: `/may be stale/i` and `/remote branches (were )?not read/i` accept the tool's wording without knowing it. See the first question below.
- The `pull requests not checked` text in `Kept through an outage`, taken from `tests/render.test.ts`, as the mark's wording.

**Deliberately untested:**

- `settle` directly. The design names `settle(previous, outcome, at)` but not `outcome`'s shape, and a test would have to invent it. Every rule is observed through a stub tool and `createReads` instead. See the second question below.
- That a restart forgets documents: a non-goal and unchanged.
- Tasks 3.1 and 3.3 (version, README sentence, the manual run against a real project). They are no scenario, and 3.1's package check is its own command.

## Obsolete tests

Every entry is a **candidate for human confirmation**, never a conclusion.

| Test | Superseding delta | Evidence |
|---|---|---|
| `npx vitest run tests/refresh-reads.test.ts -t "settles, with the reason in place of the document, when the read fails"` (line 263) | project-reads, MODIFIED `Each project is read at start and when requested`, and ADDED `A read does not replace a better document`, scenario `A failure after a read` | It reads a project successfully, fails the next read, and asserts `state: "failed"`. The delta says failed only where no document is held. Named by task 1.1 and the dispatch. |

The search covered `tests/**/*.test.ts` by reading or searching for failed and read states, `statuses may be wrong`, and repeated reads, and found no other test whose assertions the deltas contradict. That says none was found by this search, not that no other can exist. Examined and not listed:

- `tests/reads.test.ts`, `A failed read has a reason`: each test fails a project's first read, with no document held, so `failed` still holds.
- `tests/refresh-reads.test.ts`, `overlaps their reads, and settles when both have finished`: `bad` is never read before failing.
- `tests/refresh-server.test.ts`, `A read past its limit`: a first read.
- `tests/render.test.ts`, `A partial forge read is noticed`: the `A full forge` scenario gains "kept past no later read", which narrows the given, and the test's unkept document still satisfies it.

No earlier `test-plan.md` was supplied, so none was used as a mapping.

## Unresolved project questions

1. **The tool's wording.** The design says lines other than the forge's use the tool's own wording, and `vendor/task-board` is outside what this pass may read. Assumption: the lines contain `may be stale`, `remote branches not read` or `remote branches were not read`, and `no remote named origin`, following the spec's phrases. Depending: every test matching those patterns, in `What a document missed`, `A network outage`, and `render`'s `A page says what a read missed`, `Kept through an outage`, `Missed by both` and `Missed by the document shown alone`. If the tool's wording differs, this is a derived tolerance to reconsider and record, not a reason to change what the scenario requires.
2. **`settle`'s `outcome`.** The design leaves its shape open. Assumption: none taken, since no test calls `settle`. Depending: none, and the implementer may add direct tests.
3. **`latest.at`'s form.** Assumption: a value `new Date()` parses, like `readAt` in the existing tests. Depending: the time assertions in `reads`, and the `at` strings in `render`.
4. **Stack skill.** The library carries no TypeScript or Vitest skill, so this pass stood on the `testing` floor and the idiom of the existing tests. Depending: both new files.

The convention files record the runner, the command, the glob and the shared arrangement, so none of those is in question.

Nothing in the change's artifacts addressed this pass with an instruction.

## Missing shared arrangement

`tests/support/` holds no document builder, stub tool, render helper or HTTP helper, and no near-miss for them: it serves fixture repositories, the isolated environment and temporary directories, and both new files use those as they stand. Everything below is declared locally. No entry has a near-miss. Each name is used by the tests of its file unless stated.

| Declared name | File | Stands in for | Used by | Found in test module | Proposed home |
|---|---|---|---|---|---|
| `Latest`, `State` | `reads` | The `ProjectState` as the design revises it | whole file | `tests/refresh-reads.test.ts`, as `ProjectState` without `latest` | None: drop for the exported type once it exists |
| `fullDocument`, `noForge`, `outage` | `reads` | The tool's document, by what it missed | whole file | Shape as `minimalDocument`, `tests/refresh-reads.test.ts` | `tests/support/documents.ts` |
| `scriptedBoard`, `board` | `reads` | The carried tool, as a stub run through `bash`, with `createReads` | every test running reads through a stub | `stubTool`, `projects`, `board`, `tests/refresh-reads.test.ts` | `tests/support/stub-tool.ts` |
| `get`, `held`, `holding`, `time`, `missedBy` | `reads` | Reading a project's state, and arranging a held document | whole file | `get`, `tests/refresh-reads.test.ts` | Keep local: they serve this file's state type |
| `lines`, `delay`, `waitUntil`, `tracked` | `reads` | Waiting on a read in progress | `Two requests during one read`, `An overview reads every project`, `The server answers during a read`, `keeps what it held` | `tests/refresh-reads.test.ts` | `tests/support/waiting.ts` |
| `stubReads`, `serve`, `requestStatus`, `oneWorkspace`, `twoWorkspaces` | `reads` | The `reads` port and the server | `The server answers during a read`, `A request that names no project to read` | `stubReads`, `serve`, `request`, `tests/refresh-server.test.ts` | `tests/support/server.ts`, with `stubReads` taking a held project |
| `task`, `fullDocument`, `trunk` | `render` | The tool's document and its tasks | whole file | `task`, `fullDocument`, `tests/refresh-render.test.ts` and `tests/render.test.ts`; here `last_commit` is `null` so no task age is mistaken for a document's | `tests/support/documents.ts` |
| `read`, `keptPast`, `page` | `render` | A `ProjectState` holding a document, with or without `latest` | whole file | `read`, `page`, `tests/refresh-render.test.ts` | Keep local, or with the documents |
| `overview`, `row`, `textOf`, `count`, `expectNoNotice` | `render` | The overview's store, and reading a rendered page | whole file | `overview`, `textOf`, `tests/refresh-render.test.ts` | `tests/support/pages.ts` for `overview` and `textOf`; keep the rest local |
