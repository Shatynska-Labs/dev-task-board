# Test plan: star-workstreams

Derived from the delta specs at plan commit `d4bc052`, before implementation, by an author who has not read `src/`. This file is not an artifact the OpenSpec schema knows about: `openspec instructions apply` does not list it, so read it on purpose before implementing.

Tests are named as `<file> > <describe path> > <test name>`. Run one with `npx vitest run <file> -t "<test name>"` (a substring of the full name selects it), or a file with `npx vitest run <file>`. The project's command is `npm test`.

Files written by this pass:

- `tests/stars.test.ts` — `src/stars.ts` as design.md D10 names it (`starsPath`, `loadStars`, `Stars.starred`, `Stars.set`).
- `tests/stars-board.test.ts` — the built command (`dist/cli.js`), as `tests/board.test.ts` runs it.
- `tests/stars-server.test.ts` — `startServer` with a stub `reads` port and a stub `Stars` port passed as `BoardState.stars`.
- `tests/stars-parts.test.ts` — `startServer` over a real `createReads` and a stub tool, for a page sent in a quick part and a full part.

## Baseline

Full suite, before any test was written: `npm test` in the provisioned working tree (`node_modules` present) — 24 files, 460 passed, 1 skipped, 0 failed.

After writing: the four new files give 35 failed and 23 passed of 58; nothing else changed. Every failure is in state 1 or 2 of `testing`:

- `tests/stars.test.ts` fails as a whole: `src/stars.ts` does not exist (state 2 — its assertions have not executed and are unverified).
- `tests/stars-server.test.ts`: every POST answers 404 today, and no page carries a star button or form (state 1). The two new ordering scenarios fail on order (state 1).
- `tests/stars-parts.test.ts`: the page has two elements with id `alpha` today (one per part) and no stars form (state 1). The arrangement was confirmed sound: each test's precondition that the page arrives in three phases, quick then full, passed.
- `tests/stars-board.test.ts`: the six refusal tests fail because the board starts and runs on a bad stars file, so `spawnSync` reaches its 15-second timeout (state 1).

Tests passing before implementation, and why each is not an alarm about the test (they exercise existing code, so `testing`'s second situation applies):

- `stars-server` ordering scenarios carried over unchanged (Newest first … Active workstreams are ordered too) and `A star keeps its section`: the order without stars already exists. `A star keeps its section` begins to discriminate only once stars are honoured.
- `stars-server > … > From another site > … Sec-Fetch-Site cross-site`: the existing guard on every request already answers 403.
- `stars-server` 404 tests (`star=nobody`, `/work/nothing`, `/work/nothing with no Origin`, `POST /work`, `PUT /work/one`) and the three unchanged address scenarios: every non-GET answers 404 today. They constrain the implementation not to open those to the new route; their discriminating partners are the 303/403/413/400 tests beside them.
- `stars-board` `starts …` tests (no file, hand edit, `does not read ~/.local/state where XDG_STATE_HOME is set`): the board ignores the file today. Their discriminating partners are the refusal tests in the same file.

## Scenarios

39 scenarios in the delta specs (21 in `workstream-stars`, 18 in `board-pages`); 39 accounted for below, all covered.

### workstream-stars — Stars are kept on this machine (ADDED)

| Scenario | Tests | Classification |
|---|---|---|
| No file | `tests/stars.test.ts > Stars are kept on this machine > No file > loads a missing file as no stars`; `tests/stars-board.test.ts > Stars are kept on this machine > No file > starts with no stars file` | specified |
| Stars survive a restart | `tests/stars.test.ts > … > Stars survive a restart > holds alpha of /p/one starred when loaded again from the same file` | specified; "the board starts again" is taken as loading the same file again — derived level choice |
| The file's content | `tests/stars.test.ts > … > The file's content > holds beta then alpha, starred, as one sorted list, creating the directory`; `… > shows the stars it has set as starred` | specified (parsed JSON compared, not text: whitespace is unspecified — derived). `starred("/p/two")` empty is derived |
| The last star of a project cleared | `tests/stars.test.ts > … > The last star of a project cleared > leaves no key /p/one once its only star is cleared` | specified |
| One project in two workspaces | `tests/stars-server.test.ts > The page sets a star > One project in two workspaces > shows alpha starred on /b/one once starred from /a/one` | specified |
| Overlapping sets | `tests/stars.test.ts > … > Overlapping sets > keeps both alpha and beta when they are set at once` | specified |
| The state directory from the environment | `tests/stars.test.ts > … > The state directory from the environment > is $XDG_STATE_HOME/…`, `> is ~/.local/state/… where XDG_STATE_HOME is unset`, `> … is empty`; `tests/stars-board.test.ts > … > The state directory from the environment > reads the stars file under XDG_STATE_HOME: a bad one there refuses the start`, `> does not read ~/.local/state where XDG_STATE_HOME is set`, `> reads ~/.local/state/dev-task-board/stars.json where XDG_STATE_HOME is unset`, `> … is empty` | specified (unset/empty from the requirement text). The board-level tests observe the path through a bad file refusing the start — derived means of observation |

### workstream-stars — A bad stars file refuses the start (ADDED)

| Scenario | Tests | Classification |
|---|---|---|
| Not JSON | `tests/stars.test.ts > A bad stars file refuses the start > Not JSON > refuses {not json, naming the file, and leaves it unchanged`; `tests/stars-board.test.ts > A bad stars file refuses the start > Not JSON > exits non-zero naming the file, and leaves the file unchanged` | specified. At module level "refuses" is taken as `loadStars` throwing or rejecting with an `Error` whose message holds the path — derived from tasks.md 1.1 ("throwing an error naming the file and the reason"). At board level, nothing on stdout and no stack trace on stderr follow `tests/board.test.ts`'s `expectRefused` — derived, as bad settings are refused |
| A hand edit out of order | `tests/stars.test.ts > … > A hand edit out of order > accepts repeats, disorder and an empty list, and the next write normalises them`; `tests/stars-board.test.ts > … > A hand edit out of order > starts with repeated, unordered names and an empty list` | specified |
| Not a list of names | `tests/stars.test.ts > … > Not a list of names > refuses {"/p/one": "alpha"}, naming the file`, and `> refuses %s, naming the file` for `stars an array`, `a name not a string`, `no stars`, `not an object`; `tests/stars-board.test.ts > … > Not a list of names > exits non-zero naming the file for {"/p/one": "alpha"}` | specified for the scenario and for the four further shapes, which the requirement text names ("an object whose … `stars` is an object of arrays of strings"). File left unchanged at board level: specified ("SHALL NOT overwrite it") |
| Another version | `tests/stars.test.ts > … > Another version > refuses version 2, naming the file and the version`; `tests/stars-board.test.ts > … > Another version > exits non-zero naming the file and version 2` | specified; "naming the version" read as the message, less the path, holding `version` and the number `2` — derived reading |

Also from the requirement text, not a scenario: `tests/stars.test.ts > A bad stars file refuses the start > A file that cannot be read > refuses a stars.json that is a directory, naming it` — specified ("cannot be read"); a directory standing in for an unreadable file is a derived choice.

### workstream-stars — The page sets a star (ADDED)

| Scenario | Tests | Classification |
|---|---|---|
| Starring | `tests/stars-server.test.ts > The page sets a star > Starring > answers 303 to /work/one#alpha, stars alpha, and starts no read`; `> percent-encodes the project's name in the address it answers with`; `> accepts the board's own page addressed as localhost` | specified. "No read starts" observed as the stub reads' `quick` and `refresh` not being called — derived from the `reads` port as existing tests stub it. The localhost case is specified by the guard's rule (`Origin` is `http://` and the request's `Host`) |
| Unstarring | `… > Unstarring > answers 303 to /work/one#alpha, and alpha is not starred` | specified |
| Sent twice | `… > Sent twice > answers 303 to star=alpha again, and alpha is still starred`; `> answers 303 to unstar of a workstream not starred, and leaves it so` | specified |
| A star that cannot be saved | `tests/stars-server.test.ts > … > A star that cannot be saved > answers 500 with a page saying so and why, escaped, and alpha is not starred`; `tests/stars.test.ts > Stars are kept on this machine > A star that cannot be saved > rejects the set and holds the star unchanged where the directory cannot be written` | specified. The server test injects the failure through the stub `Stars` rejecting with `EACCES <denied> here`; the module test makes the directory read-only and skips when run as root, where permissions do not bind. "Could not be saved" matched case-insensitively — derived |

### workstream-stars — Only the board's own page sets a star (ADDED)

| Scenario | Tests | Classification |
|---|---|---|
| From another site | `tests/stars-server.test.ts > Only the board's own page sets a star > From another site > answers 403 with %s, and nothing is starred` for `Sec-Fetch-Site cross-site`, `Origin http://evil.example`, `an Origin naming another of the board's hosts` | specified (the third from the rule's `Origin` = `http://<Host>`) |
| Without the headers | `… > Without the headers > answers 403 with %s, and nothing is starred` for `no Sec-Fetch-Site`, `no Origin`, `Sec-Fetch-Site none` | specified (`none` from the rule requiring `same-origin`) |
| A malformed body | `… > A malformed body > answers 400 to %s, and nothing changes` for `an empty body`, `two fields`, `another field` | specified |
| A long body | `… > A long body > answers 413 to a body of 5000 bytes, and nothing changes` | specified. The body is `star=` and 4995 `a`, which would otherwise be 404, so 413 discriminates |
| An unknown workstream or project | `… > An unknown workstream or project > answers 404 to star=nobody on /work/one, and nothing changes`; `> answers 404 to star=alpha on /work/nothing, and nothing changes` | specified |
| The first failing check decides | `… > The first failing check decides > answers 403 to a body of 5000 bytes with no Origin`; `> answers 413 to pin=alpha in a body of 5000 bytes`; `> answers 404 to /work/nothing with no Origin` | specified |

### board-pages — Addresses reach workspaces and projects (MODIFIED)

| Scenario | Tests | Classification |
|---|---|---|
| One workspace | `tests/stars-server.test.ts > Addresses reach workspaces and projects > One workspace > shows the overview of work at /` | specified; unchanged by the delta, re-covered with `stars` in the server's state |
| Several workspaces | `… > Several workspaces > links to /a and /b at /` | specified; unchanged |
| An unknown address | `… > An unknown address > answers %s with 404` for `/nobody`, `/work/nothing`, `/%E0` | specified; unchanged |
| Another method | `… > Another method > answers a POST to /work with 404, from the board's own page`; `> answers a PUT to /work/one with 404, from the board's own page` | specified. Both are sent with the headers of the board's own page and a valid body, so only the method or address refuses them — derived arrangement |

### board-pages — Workstreams are ordered by their latest commit (MODIFIED)

All in `tests/stars-server.test.ts > Workstreams are ordered by their latest commit`, observed in the page's last phase served with a stub `Stars`.

| Scenario | Test | Classification |
|---|---|---|
| Newest first | `Newest first: beta, at 200, before alpha, at 100` | specified |
| The latest of several tasks | `The latest of several tasks: alpha, at 100 and 300, before beta, at 200` | specified |
| An unplaced task counts | `An unplaced task counts: alpha's unplaced 300 puts it before beta's 200` | specified |
| No commit comes last | `No commit comes last: beta, at 100, before alpha, at null` | specified |
| Equal commits by name | `Equal commits by name: alpha before beta, both at 100, beta first in the document` | specified |
| No commits by name | `No commits by name: alpha before beta, neither with a commit, beta first in the document` | specified |
| Active workstreams are ordered too | `Active workstreams are ordered too: beta, at 200, before alpha, at 100` | specified |
| Starred first | `Starred first: starred alpha, at 100, before beta, at 200, among the active workstreams` | specified |
| Starred among themselves by latest commit | `Starred among themselves by latest commit: beta, alpha, gamma among the other workstreams` | specified |
| A star keeps its section | `A star keeps its section: starred inactive alpha among the other workstreams, beta among the active` | specified |

### board-pages — A workstream shows its star (ADDED)

| Scenario | Tests | Classification |
|---|---|---|
| Not starred | `tests/stars-server.test.ts > A workstream shows its star > Not starred > gives alpha's summary a button named star, valued alpha, showing ☆, called Star alpha, submitting a form posting to /work/one`; `> Every workstream > gives the inactive workstream beta its own button, in its summary`; `> Every workstream > carries the workstream's name escaped as the button's value`; `> Every workstream > carries no script` | specified. The accessible name is read as `aria-label` where present, else the button's text without `aria-hidden="true"` elements — a derived reading of "accessible name". The form is found through the button's `form` attribute (design D5; scenario "One form for every part"). `method` compared case-insensitively — derived |
| Starred | `… > Starred > gives alpha's summary a button named unstar, valued alpha, showing ★, called Unstar alpha`; `> Starred > stars only the project whose path is starred` | specified; the second from the stars being keyed by project path (workstream-stars) |
| One form for every part | `tests/stars-parts.test.ts > A workstream shows its star > One form for every part > holds exactly one form with id stars, and every star button in either part names it`; `> shows alpha starred in both parts` | specified ("in every part that renders the project's document"). Requiring at least one star button in each part is specified by the same sentence |

### board-pages — Only the last part carries workstream ids (ADDED)

| Scenario | Tests | Classification |
|---|---|---|
| Quick and full parts | `tests/stars-parts.test.ts > Only the last part carries workstream ids > Quick and full parts > gives exactly one element the id alpha, in the full part` | specified |

### Deliberately untested

- **Replacing the file whole by renaming one written beside it** (workstream-stars requirement text, no scenario): atomicity is not observable without injecting a crash between write and rename. Reason: no seam for it short of reading the implementation.
- **Writing nothing to a project's repository** (requirement text, no scenario): every server test runs on paths that do not exist (`/srv/one`, `/p/one`) with a stub `Stars`, so no repository is reachable to write to; a board-level check would need a workstream in a real repository's document, which needs the carried tool's workstream file format, outside this pass's read set.
- **`Content-Type` other than `application/x-www-form-urlencoded`**: the requirement names that type for an accepted body but states no answer for another. Left to the implementation; not asserted.
- **Every star end to end through the built command** (start, star from the page, restart, see it starred): needs a workstream in a real fixture repository; covered instead by the module-level restart test and the server-level tests.

## Obsolete tests

Search: every file in `tests/**/*.test.ts` for a `POST`, `PUT` or `method` in a request, a `405`, a workstream `id`, `#`-links, `XDG_STATE_HOME` and `stars`; and the ordering assertions of `tests/other-workstreams-order-render.test.ts`, compared against the two MODIFIED requirements under `openspec/specs/board-pages/spec.md`. No earlier `test-plan.md` was supplied.

- **MODIFIED "Addresses reach workspaces and projects"** — what it supersedes is the absence of any method exception; the existing requirement says nothing of methods. No existing test sends a non-`GET` request, so none asserts that a `POST` to a project is 404. None found by this search.
- **MODIFIED "Workstreams are ordered by their latest commit"** — supersedes ordering that ignores stars. `tests/other-workstreams-order-render.test.ts` asserts that order with no stars, which the revised requirement keeps. Not obsolete. It builds pages through `tests/support/document.ts`'s `page()`, which calls `renderProject("work", "alpha", state)` with no starred set; if the implementation makes the starred set a required argument, those tests (and the many others using `renderProject` with three or four arguments) may fail for want of it — a matter of the implementation keeping that call valid, not of superseded behaviour.
- **ADDED "Only the last part carries workstream ids"** — changes behaviour the existing specs did not state. No existing test asserts a workstream `id` in the quick part. None found by this search.

No test was found by this bounded search to bear on superseded behaviour. That is "none found by this search", not "none exists".

## Unresolved project questions

1. **No stack skill.** The library carries no TypeScript or Vitest skill; this pass ran on the `testing` floor alone, following the conventions of the existing tests.
2. **How the server takes stars.** Assumed `startServer({ workspaces, reads, stars }, port)` where `stars` has `starred(projectPath): Set<string>` and `set(projectPath, workstream, on): Promise<void>` (design D10). Every test in `tests/stars-server.test.ts` and `tests/stars-parts.test.ts` depends on it.
3. **How rendering takes the starred set.** D10 says the render functions take it, but not where in their arguments, so no test calls `renderProject` with stars; page assertions run through the server instead. Depending: all of `tests/stars-server.test.ts`'s `A workstream shows its star` and ordering tests.
4. **`loadStars` synchronous or not.** Tests `await` it and catch both a throw and a rejection. Depending: all of `tests/stars.test.ts`.
5. **The quick read's identity.** `tests/stars-parts.test.ts` tells a quick read from a full one by `gh` failing where `GH_CONFIG_DIR` cannot be made, as `tests/open-pages-at-once.test.ts` does. Depending: both tests in that file.
6. **The page for a failed save.** Assumed served as the 500's body, its text holding "could not be saved" and the reason escaped as `&lt;`/`&gt;`. Depending: `tests/stars-server.test.ts > … > A star that cannot be saved > …`.
7. **Reads outside the read set.** While surveying, this pass also read `vitest.config.ts` (test configuration: include, exclude, `globalSetup` building `dist/`) and `package.json` (scripts). Neither implements the behaviour under test; recorded so the bound's one crossing into non-test files is visible.

## Missing shared arrangement

`tests/support/` was named by the dispatch and by `AGENTS.md`. Every entry below is declared locally in the test file named; none was added to `tests/support/`.

| Declared | In | Stands in for | Used by | Near-miss in `tests/support/` | Found in | Proposed home |
|---|---|---|---|---|---|---|
| `stubStars` | `tests/stars-server.test.ts`, `tests/stars-parts.test.ts` (one copy each) | the `Stars` port (D10): `starred`, `set` | every test in both files | none | — | `tests/support/stars.ts` |
| `stubReads` | `tests/stars-server.test.ts` | the `reads` port: `get`, `quick`, `refresh`, with `quick` and `refresh` as `vi.fn` to count reads | every test in the file; read-counting in `… > Starring > answers 303 to /work/one#alpha, stars alpha, and starts no read` | none | `tests/server.test.ts` (`readEverything`), `tests/refresh-server.test.ts` (`stubReads`) | `tests/support/reads.ts` |
| `inactive`, `withoutCommit` | `tests/stars-server.test.ts` | an inactive workstream; a task with no `last_commit` key | the ordering tests | `tests/support/document.ts` `workstream()` always gives `active: true`; `task()` always sets `last_commit` | `tests/other-workstreams-order-render.test.ts` | `tests/support/document.ts` |
| `sectionText`, `orderIn` | `tests/stars-server.test.ts` | reading a workstream section's order from a page | the ordering tests | `tests/support/page.ts` `expectInOrder` asserts order but does not bound a section | `tests/other-workstreams-order-render.test.ts` | `tests/support/page.ts` |
| `lastPhase`, `phases`, `phaseStarts`, `phaseTag` | `tests/stars-server.test.ts`, `tests/stars-parts.test.ts` | splitting a project's page into its `phase` parts | every page assertion in both files | none | `tests/open-pages-at-once.test.ts` (`phaseTag`, `phases`) | `tests/support/page.ts` |
| `buttons`, `starButtons`, `starButtonOf`, `accessibleName`, `summaryAround`, `formsWithId`, `tagsWithId` | `tests/stars-server.test.ts`, `tests/stars-parts.test.ts` | reading star buttons, their form and element ids | the `A workstream shows its star` and ids tests | `tests/support/page.ts` `attribute`, `blocks` are used as they stand | — | `tests/support/page.ts` |
| `send`, `post`, `ownPage`, `pageOf` | `tests/stars-server.test.ts` | an HTTP request with a method, headers and body, `Host` set | every test in the file | none | `request` in `tests/server.test.ts`, `tests/refresh-server.test.ts` (GET only) | `tests/support/http.ts` |
| `get` | `tests/stars-parts.test.ts`, `tests/stars-board.test.ts` | a GET with `Host` set | both files | none | `tests/board.test.ts`, `tests/open-pages-at-once.test.ts` | `tests/support/http.ts` |
| `machine` (parts) | `tests/stars-parts.test.ts` | an isolated environment, a `gh` stub telling quick from full, and a stub tool whose full read waits for the quick one | both tests in the file | `tests/support/fixture.ts` `isolatedEnvironment` is used as it stands | `tests/open-pages-at-once.test.ts` (`machine`) | `tests/support/fixture.ts` |
| `machine` (board), `run`, `start`, `waitUntil`, `listening`, `freePort`, `expectRefused`, `starts`, `refusesStart`, `write` | `tests/stars-board.test.ts` | running the built command against a valid project and a stars file | every test in the file | `tests/support/fixture.ts` `isolatedEnvironment` inherits `XDG_STATE_HOME` from the machine running the tests, so `machine` sets or removes it | `tests/board.test.ts` | `tests/support/board.ts`; and `isolatedEnvironment` could set `XDG_STATE_HOME` under its root, so no test reads the machine's own stars file |
| `freshPath`, `writtenFile`, `held`, `names`, `expectRefused` | `tests/stars.test.ts` | a stars file's path and its content | every test in the file | none | — | keep local |

### Dispositions

Recorded at `build:applying`.

- `machine` (board) in `tests/stars-board.test.ts`, near-miss `isolatedEnvironment`: **promoted** in part. `isolatedEnvironment` in `tests/support/fixture.ts` now sets `XDG_STATE_HOME` under the isolated home, so no board any test starts reads the stars file of the machine running the tests. `machine` keeps its own setting of `XDG_STATE_HOME`, since its tests vary it as set, unset and empty; what they assert is unchanged. The rest of that row, `run`, `start`, `waitUntil`, `listening`, `freePort`, `expectRefused`, `starts`, `refusesStart` and `write`, is **kept** local: each follows its namesake declared locally in `tests/board.test.ts`, and `share-the-test-arrangement` moves them together.
- Every other entry: **kept** local. Each duplicates helpers that other test files already declare locally (`stubReads`, `send`/`get`, `phases`, `machine`), which the backlog entry `share-the-test-arrangement` consolidates across all of them at once; promoting only this change's copies would add a second shared version beside the ones that entry is to merge. `stubStars` has a copy in two files of this change and joins that entry's scope. `freshPath`, `writtenFile`, `held`, `names` and `expectRefused` in `tests/stars.test.ts` are particular to one file.
