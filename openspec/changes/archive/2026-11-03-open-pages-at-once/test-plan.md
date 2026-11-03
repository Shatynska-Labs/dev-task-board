# Test plan: open-pages-at-once

Derived from the change's delta specs (`specs/project-reads/spec.md`, `specs/board-pages/spec.md`) before implementation, by an author who has not read `src/`. This file is not an artifact the OpenSpec schema knows about: it is not among `openspec instructions apply`'s context files and must be read on purpose.

All new tests are in one file, `tests/open-pages-at-once.test.ts`. No existing test was edited, deleted or disabled.

## How to run a test

Each test is named below by its full Vitest name, `<describe> <describe> <it>`. Run one with:

```
npx vitest run tests/open-pages-at-once.test.ts -t "<full name>"
```

Run all of them with `npx vitest run tests/open-pages-at-once.test.ts`. `npm test` runs them with the suite. Below, `F` stands for `tests/open-pages-at-once.test.ts`.

## Level

Every test runs `startServer` in process against a real `createReads`, with a stub tool run through `bash` and a stub `gh` on `PATH`, and reads the HTTP body as it arrives. That is the smallest unit that observes the behaviour: a quick read beside a full one, and a page sent in parts, are visible only through the server and the reads together. No test depends on a real `gh` or on the carried tool.

The stub tool decides which read it is by the stub `gh`: a run in which `gh pr list` succeeds is logged as `full`, one in which it fails as `quick`. It logs each run's start (with its pid, `GH_TOKEN` and `GITHUB_TOKEN`) and end, prints `full-task` (forge `full`) or `quick-task` (forge `none`) unless a test supplies another document, and is held while `hold-<kind>-<project>` exists until it is released.

## Scenarios

40 scenarios in the delta specs; 40 accounted for below. 31 are covered by new tests, 9 by existing tests alone whose scenario text and behaviour the change leaves untouched, and none is uncovered.

### project-reads — Each project is read at start and when requested (MODIFIED)

| Scenario | Covered by |
| --- | --- |
| A readable project | Existing, unchanged scenario exercising a full read alone: `tests/reads.test.ts` "Each project is read at start and when requested A readable project holds the document the carried tool printed, and the time of the read"; `tests/refresh-reads.test.ts` "Each project is read at start and when requested A readable project holds the document and the time of the read, when a request read it"; `tests/keep-reads.test.ts` "Each project is read at start and when requested A readable project holds the document the tool printed, and the time of the read" |
| The server answers during a read | F "Each project is read at start and when requested The server answers during a read ends another project's page and the list of workspaces while one project's reads are held" |
| A changed project is requested | F "Each project is read at start and when requested A changed project is requested holds the new document and a later time of the read once its page has ended" |
| Two requests during one read | F "Each project is read at start and when requested Two requests during one read starts no second full read, and both pages end when the read finishes" |
| Nobody is asking | F "Each project is read at start and when requested Nobody is asking starts no read after a page has ended"; and existing `tests/refresh-reads.test.ts` "Each project is read at start and when requested Nobody is asking starts no read after the pass at start, however long passes" |
| An overview reads every project (body revised: no read starts) | F "Each project is read at start and when requested An overview reads every project starts no read for a workspace of two projects"; F "Each project is read at start and when requested An overview reads every project ends without waiting for a read in progress" |
| A request that names no project to read | F "Each project is read at start and when requested A request that names no project to read starts no read for a refused request"; "… starts no read for a 404"; "… starts no read for the list of workspaces" |

### project-reads — A read uses its workspace's GitHub account (MODIFIED)

Only "Two workspaces, two accounts" changed. The other eight scenarios are unchanged in text and are about a full read, which this change does not alter; they stay covered by `tests/account-reads.test.ts`.

| Scenario | Covered by |
| --- | --- |
| A token for the account | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account A token for the account asks gh for that account, and the tool's GH_TOKEN is its token" and "… does not change the board's own environment" |
| Two workspaces, two accounts | F "A read uses its workspace's GitHub account Two workspaces, two accounts gives each full read the token of its own workspace's account" |
| Asked for each read | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account Asked for each read asks gh for the token twice" |
| No token | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account No token runs the tool with no login where gh exits non-zero" (and its `it.each` siblings) |
| Without gh | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account Without gh reads with forge none, and the project holds the account's name" |
| A token that does not come | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account A token that does not come stops a gh that ends on being stopped, starts no tool, and fails naming the account and the limit" (and sibling) |
| No token, and the tool fails | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account No token, and the tool fails keeps the document, and the latest reason names the account and the tool's reason" |
| Stopping while a token is taken | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account Stopping while a token is taken stops gh, and no tool is started" |
| No account | Existing `tests/account-reads.test.ts` "A read uses its workspace's GitHub account No account does not ask gh for a token, and the tool sees the same GH_TOKEN" |

### project-reads — A project's page starts a quick read beside the full one (ADDED)

| Scenario | Covered by |
| --- | --- |
| Both reads start | F "A project's page starts a quick read beside the full one Both reads start runs the tool twice, overlapping, once with gh unable to log in" |
| A quick read is not held | F "A project's page starts a quick read beside the full one A quick read is not held holds what it held before the request after the quick read ends" |
| The full read ends first | F "A project's page starts a quick read beside the full one The full read ends first stops the quick read" |
| No account is used | F "A project's page starts a quick read beside the full one No account is used asks gh for a token once, by the full read" |
| Joining a read at start | F "A project's page starts a quick read beside the full one Joining a read at start starts no second full read, and starts a quick read" |
| Two requests during one quick read | F "A project's page starts a quick read beside the full one Two requests during one quick read starts no second quick read" |
| Nothing quick at start | F "A project's page starts a quick read beside the full one Nothing quick at start runs only full reads in the pass at start" |

### board-pages — The overview shows each project's state (MODIFIED)

| Scenario | Covered by |
| --- | --- |
| Mixed states | F "The overview shows each project's state Mixed states shows what the board holds: counts and the time of the read for one, the reason for the other" |
| An overview while a project is read | F "The overview shows each project's state An overview while a project is read ends before that read ends, saying the project is being read" |

### board-pages — A page shows what was read for it (MODIFIED)

| Scenario | Covered by |
| --- | --- |
| A refresh shows a change | F "A page shows what was read for it A refresh shows a change shows the change in the page's last part" |
| A read past its limit (revised: the page ends) | F "A page shows what was read for it A read past its limit ends the page, with that reason" |
| A request from another site | F "A page shows what was read for it A request from another site cross-site answers /work/one with 403, and starts no read", and the same for `/work` and for `same-site` (four tests) |
| A request from the reader | F "A page shows what was read for it A request from the reader answers a project's page normally given none", "… given same-origin", "… given no such header" |
| Not cached | F "A page shows what was read for it Not cached sends /work/one with Cache-Control: no-store", "… sends /work with Cache-Control: no-store" |

### board-pages — Several workspaces show as tabs (MODIFIED)

| Scenario | Covered by |
| --- | --- |
| Several workspaces | F "Several workspaces show as tabs Several workspaces links an overview to each, and marks only its own" |
| On a project's page | F "Several workspaces show as tabs On a project's page links to each overview once, across all its parts, and marks only its workspace" |
| One workspace | F "Several workspaces show as tabs One workspace shows no tabs, and the project's page links to /work" |
| A name needing care | F "Several workspaces show as tabs A name needing care encodes the address and escapes the text" |
| Another workspace is not read | F "Several workspaces show as tabs Another workspace is not read starts no read, of either workspace, when an overview is followed" |

### board-pages — A project's page shows each read as it arrives (ADDED)

| Scenario | Covered by |
| --- | --- |
| The first part comes at once | F "A project's page shows each read as it arrives The first part comes at once sends the tabs, the heading and a part saying it is being read before the reads end" |
| Quick, then full | F "A project's page shows each read as it arrives Quick, then full holds the being-read part, the quick document marked as from git alone, then the full document" |
| Full first | F "A project's page shows each read as it arrives Full first holds the being-read part and then the full document, and no quick part" |
| A quick read that fails | F "A project's page shows each read as it arrives A quick read that fails adds no part saying the quick read failed" |
| Only the latest is seen | F "A project's page shows each read as it arrives Only the latest is seen styles /work/one to hide every phase followed by another, with no script", "… styles /work to hide …" |

### Uncovered scenarios

None. No scenario reaches this change through a `REMOVED` or `RENAMED` delta.

Deliberately untested, though not a scenario: the requirement sentence "A quick read … SHALL have the full read's limit". No scenario states it, and the limit test above holds both reads past the limit and asserts only that the page ends with the reason. Also untested: the design's statement that a reader who leaves does not stop the reads (design only, no delta).

## Classification of assertions

Specified unless listed. Everything in a test traces to its scenario or its requirement's sentences except what follows, which the implementation step may question rather than treat as stated:

- **Derived — how "gh unable to log in" is recognised.** The stub `gh` fails only where `GH_CONFIG_DIR` names a directory that cannot be made, as in the environment `environmentWithNoLogin` gives (`/dev/null/gh`, asserted in `tests/account-reads.test.ts`). The design says the quick read is "the same run, in the environment `environmentWithNoLogin` gives". A different no-login mechanism would make every quick run log as `full`. Every test that counts or waits for `quick` runs depends on it.
- **Derived — a part is a `section` whose `class` holds the token `phase`, and a part runs from its opening tag to the next one's.** The spec gives the element and class; the boundary rule is the test's.
- **Derived — "the heading"** is checked as the project's name appearing in the text before the first part, and "the tabs" as links to `/a` and `/b` there. The spec names a heading but not its element.
- **Derived — the quick part's marking** is matched as text `git alone`, `GitHub`, and `statuses may be wrong` (case-insensitive except `GitHub`). The spec states the meaning; these words are the closest reading of it, and the last is the wording the board already uses.
- **Derived — the full part shows the held document** is checked as the last part containing the full read's task name, and, in "Quick, then full", not the quick one's.
- **Derived — the overview row's time of the read** is matched as `YYYY-MM-DD HH:MM:SS UTC`, the board's existing format (`tests/refresh-render.test.ts`).
- **Derived — "at once" and "without waiting".** Tests treat an answer as not waiting where it ends while the reads are held. A held response is checked as not ended after 300 ms; "nothing is read" is checked 300 to 500 ms after the request ends. These durations are the test's.
- **Derived — the page past its limit ends within 5 seconds** with limit 400 ms and grace 100 ms.
- **Derived — the style rule** is matched in the page's `<style>` elements as `.phase:has(~ .phase) { … display: none … }`, whitespace-tolerant; the spec gives the selector and declaration, not where the style sits.
- **Derived — in "Two requests during one read"** the full read alone is released, so both pages end through the full read ending first; in "No account is used" a quick run is required to have happened, so the scenario can fail before implementation.

## Baseline

Full baseline taken before any test was written: `npm test` from the working tree root at `eacf31a` (plan committed) — 19 files, 371 passed, 1 skipped (the test that skips when port 8766 is taken), 0 failed.

After writing: `npm test` — 20 files, 387 passed, 25 failed, 1 skipped. Every existing test still passes. Of the 41 new tests:

- **25 fail, all in the first state** — the code under test ran and behaved as before this change: an overview runs reads (`started` not empty, four runs for "Mixed states", the overview waiting for a held read until its limit); a page starts no quick read (waits for a `quick` run time out); a page has no `phase` parts; the style lacks the rule. None fails from a test defect: each failure was read and traced to the asserted behaviour being absent. These must pass once the change is implemented.
- **16 pass**, because they assert behaviour the board already has and the change must keep, which is the expected result where the code exists: "A changed project is requested", "Nobody is asking", the three "A request that names no project to read", "Two workspaces, two accounts", "Nothing quick at start", the four "A request from another site", the two "Not cached", and the tabs' "Several workspaces", "One workspace" and "A name needing care". None is recorded as evidence of new behaviour.

## Obsolete tests

Candidates for human confirmation, not conclusions. Search bounded to `tests/**/*.test.ts`; no earlier `test-plan.md` was supplied. None was edited or deleted.

1. `tests/refresh-reads.test.ts` — "Each project is read at start and when requested An overview reads every project overlaps their reads, and settles when both have finished". Superseded by: project-reads, MODIFIED "Each project is read at start and when requested" (an overview reads nothing; the scenario now says no read starts). Evidence: it drives `reads.refresh("work")` as the overview's read and asserts the two reads overlap and the overview settles once both finish — the old scenario's THEN, word for word. It may still pass if `refresh(workspace)` survives; its basis does not.
2. `tests/keep-reads.test.ts` — "Each project is read at start and when requested An overview reads every project overlaps their reads, the first failing, and settles when both have finished". Same delta, same evidence.
3. `tests/refresh-server.test.ts` — "A page shows what was read for it A refresh shows a change answers an overview once its workspace's reads are done". Superseded by: board-pages, MODIFIED "A page shows what was read for it" (an overview answers at once, from what is held) and project-reads' overview sentence. Evidence: asserts `reads.calls` is `[["work", undefined]]` and that `/work` has not answered while the read is held.
4. `tests/refresh-server.test.ts` — "A page shows what was read for it A refresh shows a change reads the workspace for / with one workspace". Same deltas. Evidence: asserts `/` with one workspace (the overview) calls `refresh("work")`.
5. `tests/refresh-server.test.ts` — "A page shows what was read for it A refresh shows a change answers a project's page once its read is done, with what it left". Superseded by: board-pages, MODIFIED "A page shows what was read for it" (a project's page begins before its reads end) and ADDED "A project's page shows each read as it arrives". Evidence: its name and its `answered` flag assert the page answers only once the read is done, in one piece.
6. `tests/refresh-server.test.ts` — "A page shows what was read for it A read past its limit answers /work/one, with that reason" and "… answers /work, with that reason". Superseded by: board-pages, MODIFIED "A page shows what was read for it" (revised scenario: the page *ends* with the reason; an overview reads nothing) and ADDED "… each read as it arrives". Evidence: `/work` expects a limit reason that an overview starting no read cannot carry; `/work/one` asserts the body does not match `/being read/i`, which the first part now always says.
7. `tests/refresh-board.test.ts` — "Each project is read at start and when requested The server answers during a read answers another project's page and the list without waiting". Superseded by: board-pages, ADDED "A project's page shows each read as it arrives". Evidence: asserts the other project's page body does not match `/being read/i`, which its first part now holds.
8. `tests/refresh-board.test.ts` — "Each project is read at start and when requested Two requests during one read starts no second read, and both answer when the read finishes". Superseded by: project-reads, ADDED "A project's page starts a quick read beside the full one", and board-pages, ADDED "… each read as it arrives". Evidence: asserts the stub `gh`'s log equals `[project]` (one call), where a quick run of the carried tool now runs beside the full one, and that each body does not match `/being read/i`.
9. `tests/account-reads.test.ts` — "A read uses its workspace's GitHub account Two workspaces, two accounts gives each read the token of its own workspace's account". Superseded by: project-reads, MODIFIED "A read uses its workspace's GitHub account" (the scenario's WHEN is now each workspace's project page, not both overviews). Evidence: it reads through `reads.refresh("a")` and `reads.refresh("b")`, the overview's call. Its assertion may still hold.
10. `tests/tabs-server.test.ts` — "Several workspaces show as tabs Another workspace is not read touches only the workspace of the overview". Superseded by: board-pages, MODIFIED "Several workspaces show as tabs" (following a tab starts no read, where it read the opened workspace's projects). Evidence: asserts the reads port was touched for `a`, by `get` or `refresh`. Weak match: it may still pass through `get` alone.

Observation, not an obsolete candidate: `tests/refresh-server.test.ts`, `tests/keep-reads.test.ts`, `tests/server.test.ts` and `tests/tabs-server.test.ts` serve project pages through a stub of the reads port holding only `get` and `refresh`. No delta supersedes what they assert. If the port gains a method a project's page calls, they may fail for want of it, which would be a defect in their arrangement (the third state), not a change of behaviour, and is for a human to weigh rather than a reason to change what they assert.

## Unresolved project questions

1. **No stack skill.** The library carries no TypeScript or Vitest skill; the tests were written on the testing floor alone. Assumption: Vitest idioms as the existing tests use them. All tests depend on it.
2. **How "gh unable to log in" is made.** Neither convention file says. Assumption: the quick read uses `environmentWithNoLogin`, as the design says, and that environment keeps the `GH_CONFIG_DIR` the existing tests assert. Depends: every test counting `quick` runs (Both reads start, A quick read is not held, The full read ends first, No account is used, Joining a read at start, Two requests during one quick read, Quick then full, Full first, A quick read that fails, On a project's page).
3. **The reads' and server's construction.** Assumption: the server keeps taking `{ workspaces, reads }` from `startServer(…, port)`, the quick read lives inside `createReads(workspaces, { toolPath, limitMs, graceMs })` as `tasks.md` 1.1 says, and nothing new is required to construct either. Depends: every new test. If it changes, they fail at construction, which is the third state, and their wiring rather than their assertions would need adapting.
4. **What the heading is.** No convention names the element. Assumption above (Classification). Depends: "The first part comes at once".
5. **Servers are not closed.** The project's server has no close (`tests/server.test.ts` records the same); each test's server stays open until the worker exits, and held tools are stopped by `reads.stop()` and a `release-all` file after each test.

## Missing shared arrangement

The dispatch names `tests/support/` as the shared arrangement, and `AGENTS.md` names it too. The new tests take `isolatedEnvironment` from `tests/support/fixture.ts` and `temporaryDirectory`/`removeTemporaryDirectories` from `tests/support/temporary.ts`. Everything else is declared locally in `tests/open-pages-at-once.test.ts`, used by tests there (named above by scenario), and listed here:

| Declared | Stands in for | Used by | Near-miss in shared arrangement | Found in a test module | Proposed home |
| --- | --- | --- | --- | --- | --- |
| `machine()` — stub `gh` (tokens per account; fails where `GH_CONFIG_DIR` cannot be made) and the scripted stub tool (quick/full by `gh`, logging, holding, failing, printing) | `gh` and the carried tool | every new test | `isolatedEnvironment` in `tests/support/fixture.ts` writes a `gh` stub that always fails: it can neither hold a token nor tell a usable login from an unusable one. The test overwrites the file that function writes; the shared code is unchanged | the `gh` stub from `machine()` in `tests/account-reads.test.ts`; held-tool patterns from `tests/refresh-reads.test.ts` | `gh` stub: `tests/support/fixture.ts`; scripted tool: a new `tests/support/tool.ts` |
| `toolRuns`, `started`, `ended`, `Run` | reading the stub tool's log | every new test | none | none (new) | `tests/support/tool.ts` |
| `task`, `documentOf` | a task-board document | most tests | none | `documentWith` in `tests/refresh-server.test.ts`; `fullDocument` in `tests/account-reads.test.ts` | a new `tests/support/documents.ts` |
| `board` | wiring `createReads` to `startServer` on an ephemeral port | every new test | none | `serve` in `tests/refresh-server.test.ts` and `tests/keep-reads.test.ts` | a new `tests/support/server.ts` |
| `open`, `page` | an HTTP client reading a body as it arrives | every new test | none | `request` in `tests/refresh-server.test.ts` (reads whole body only) | `tests/support/server.ts` |
| `phases`, `beforePhases`, `phaseTag` | splitting a page into its parts | page tests | none | none (new) | a new `tests/support/html.ts` |
| `textOf`, `links`, `address`, `addresses`, `marked` | reading rendered HTML | page and tabs tests | none | `textOf` in `tests/render.test.ts` and `tests/account-reads.test.ts`; the link helpers in `tests/tabs-server.test.ts` | `tests/support/html.ts` |
| `lines`, `tokenRequests`, `delay`, `waitUntil`, `isRunning` | waiting and process checks | most tests | none | `tests/refresh-reads.test.ts`, `tests/account-reads.test.ts` | a new `tests/support/wait.ts` |
