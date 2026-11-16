# Test plan: write-the-settings

Derived from the change's delta specs (`specs/settings/spec.md`, `specs/board-pages/spec.md`, `specs/project-reads/spec.md`) before implementation, by an author who has not read the implementation. This file is not an artifact the OpenSpec schema knows about: read it on purpose before implementing.

New test files:

- `tests/projects-dir-settings.test.ts` (PDS below): `parseSettings` unit tests.
- `tests/settings-page-board.test.ts` (SPB below): the built command (`dist/cli.js`) started on an ephemeral port against an isolated `HOME` and `XDG_CONFIG_HOME` in a temporary directory, driven over HTTP.

Select a test with `npx vitest run <file> -t "<test name>"`. No existing test was edited, deleted or disabled.

## Baseline

Full suite, `npm test` (which excludes `tests/package.test.ts`), before any test was written: 38 files passed; 663 tests passed, 2 skipped (the cases that need port 8766 free), 0 failed.

With the new files, before implementation: the two new files hold 66 tests, 59 failing and 7 passing; every pre-existing test is untouched, so the baseline above stands for them.

## What each failure establishes before implementation

- **State 2 (target absent), 48 SPB tests**: the current command refuses the start (missing file, a relative name, an empty `projects`, or no workspace), so each fails at `startBoard` with "the command exited (1) before listening". Their assertions have not executed; they are unverified until the board starts.
- **State 1 (code ran, wrong value)**: SPB "links an overview and a project's page to /settings with one workspace" (written with an absolute path so today's board starts; `/` holds no link to `/settings`), and the 11 failing PDS tests (today's `parseSettings` refuses relative names, empty `projects`, no workspace, accepts `settings`, and names no `projects_dir`).
- **Passing before implementation (fourth state, investigated)**:
  - PDS "refuses a workspace named api, naming it": the requirement's unchanged part; existing behaviour.
  - PDS "refuses a name in the projects folder that is not a directory, naming it" and the four "refuses <name>, naming it" under "A name leaving the projects folder" (`../elsewhere`, `group//one`, `group/./one`, `group/one/..`): pass because today every relative path is refused with the path named. They constrain the implementation not to accept these when it starts accepting names; they could not be made red beforehand. Their discrimination is unestablished until the implementation accepts `group/one` (PDS "A name in the projects folder") while these stay refused.
  - SPB "exits non-zero naming the file, and leaves it unchanged": existing behaviour (invalid TOML already refuses); the scenario's added clause is that the file stays unchanged.

## Scenarios and their tests

58 scenarios in the delta specs; 58 accounted for below, every one covered. Where a `MODIFIED` requirement restates a scenario word for word, it is covered by the existing test named, which still asserts it; new tests cover every scenario the deltas changed or added.

Classification: **S** specified (traces to a scenario or the requirement's text), **D** derived (inferred, no stated requirement fixes it).

### settings: No settings file starts the board empty (ADDED)

1. **No file**: SPB "serves, prints the address of /settings, and writes no settings file" (S: serves, prints `/settings`, no file; D: the printed form `http://127.0.0.1:<port>/settings`); SPB "writes no settings file when the page is only looked at" (S: "SHALL write no file until a change is saved").
2. **A file that cannot be read**: SPB "exits non-zero naming the file, and leaves it unchanged" (S).

### settings: Settings name workspaces and their projects (MODIFIED)

3. **Where the file is** (unchanged): existing `tests/settings.test.ts` "is under XDG_CONFIG_HOME where that is set", "is under ~/.config where XDG_CONFIG_HOME is unset", "is under ~/.config where XDG_CONFIG_HOME is empty"; and SPB "writes under ~/.config where XDG_CONFIG_HOME is unset" (D: that a save writes where the start reads).
4. **A valid file** (unchanged): existing `tests/settings.test.ts` "holds projects by base name, with ~/ expanded"; PDS "still reads absolute and ~/ paths beside names" (S: requirement text keeps absolute and `~/` paths).
5. **A name in the projects folder**: PDS "holds project one at ~/projects/group/one where no projects_dir is given" (S).
6. **Another projects folder**: PDS "holds project one at <root>/code/one where projects_dir is <root>/code" (S); PDS "expands a projects_dir beginning ~/" (S: requirement text).
7. **One project in two workspaces**: PDS "holds project one at that path in both a and b" (S).
8. **Empty**: PDS "holds workspace work with no projects where its projects is empty" (S), "holds no workspace where the file names none" (S), "holds no workspace where the file holds only top-level keys" (D).

### settings: Bad settings refuse the start (MODIFIED)

9. **Missing file**: SPB "is not refused where XDG_CONFIG_HOME is set", "... is unset", "... is empty" (S: not refused; D: for each of the three locations).
10. **Two projects of one name** (unchanged): existing `tests/settings.test.ts` "is refused, naming the base name".
11. **A reserved name**: PDS "refuses a workspace named api, naming it", "refuses a workspace named settings, naming it" (S); SPB "answers 400 to a workspace named settings" (S via "A save is checked": the result read as at start).
12. **A name unusable in an address** (unchanged): existing `tests/settings.test.ts` "refuses a name holding a slash, naming it".
13. **Paths are checked before duplicates** (unchanged): existing `tests/settings.test.ts` "refuses as the missing path alone is refused".
14. **A project with no usable name** (unchanged): existing `tests/settings.test.ts` "refuses /, naming the path".
15. **A project that does not exist**: existing `tests/settings.test.ts` "is refused, naming the path" (the path half); PDS "refuses a name in the projects folder that is not a directory, naming it" (S, the added half).
16. **A name leaving the projects folder**: PDS "refuses ../elsewhere, naming it", "refuses group//one, naming it" (S); "refuses group/./one, naming it", "refuses group/one/.., naming it" (S: requirement text, "an empty, `.` or `..` segment").
17. **A bad projects folder**: PDS "refuses projects_dir as code, naming projects_dir", "refuses projects_dir as 7, naming projects_dir" (S).
18. **A github account** (unchanged): existing `tests/account-settings.test.ts` "refuses one that is empty, naming the workspace and the field", "refuses one that is a number, naming the workspace and the field".

### board-pages: The settings page (ADDED)

19. **Another workspace offers it too**: SPB "offers group/one to b and not to a, which holds it" (S; D: `a`'s remove list is exactly `group/one`).
20. **Removing a workspace**: SPB "gives only b, which has no projects, a button removing it" (S).
21. **Linked from every page**: SPB "links the list of workspaces, an overview and a project's page to /settings" (S), "links an overview and a project's page to /settings with one workspace" (D: the one-workspace case).
22. **No workspace**: SPB "answers / with 303 to /settings with no settings file" (S), "answers / with 303 to /settings with a file naming no workspace" (S).

Requirement text beyond its scenarios: SPB "shows the projects folder, a field per workspace and one for a workspace, says comments are dropped, and needs no script" (S: folder shown, add-by-name field, add-workspace field, no script; D: the comment note detected by the word "comment").

### board-pages: The settings page finds repositories (ADDED)

23. **What is found**: SPB "lists group/one with a remove button, and offers group/two and solo, sorted, and nothing else" (S); SPB "finds a repository whose .git is a file" (D: design decision 3).
24. **No projects folder**: SPB "offers no repository, and says the folder could not be read" (S: nothing offered, says so; D: the wording matched by a lenient pattern, and that the folder's path is shown).

### board-pages: Saving the settings (ADDED)

25. **Adding a found repository**: SPB "answers 303 to /settings#workspace-work, and the file lists both, keeping port and github_account" (S; D: order of `projects` not asserted); SPB "keeps projects_dir and keys it does not know" (S: "keeping every other key").
26. **The first save**: SPB "creates the file, with workspace work listing group/one" (S; covers "creating its directory").
27. **Removing**: SPB "leaves only group/one under work, and no old" (S; the `remove_workspace` Location `/settings` is S from "A save returns to its workspace").

Requirement text: SPB "keeps every one of several saves posted at once" (S: "applied one at a time"; D: five concurrent saves as its observation).

### board-pages: A save is checked (ADDED)

28. **A refused add**: SPB "answers 400 naming one, and leaves the file unchanged" (S).
29. **A name that is no directory**: SPB "answers 400 naming group/missing, and leaves the file unchanged" (S).
30. **Removing a workspace with projects**: SPB "answers 400, and leaves the file unchanged" (S).
31. **From another site**: SPB "answers 403 with Sec-Fetch-Site cross-site, and leaves the file unchanged", "answers 403 with another Origin, and leaves the file unchanged" (S); "answers 403 ahead of a body too long" (S: checked in order).
32. **A workspace that is not there, or already is**: SPB "answers 400 to add to gone, ...", "answers 400 to add_workspace of work, ...", "answers 400 to remove_workspace of gone, ..." (S).
33. **Two actions at once**: SPB "answers 400 to add_workspace and remove_workspace, and leaves the file unchanged" (S); "... add and remove ...", "... add with no workspace ...", "... no action ..." (S: "one action's fields exactly", the cases D).

Requirement text: SPB "answers 413 to a body over 4096 bytes, and leaves the file unchanged" (S), "answers 400 to an add already held" (S), "answers 400 to a remove not held" (S).

### board-pages: A save returns to its workspace (ADDED)

34. **A name needing care**: SPB "answers 303 to /settings#workspace-a%20b, and the page has a section with that id" (S; D: any element carrying the `id` counts as the section).

### board-pages: A save that cannot be written (ADDED)

35. **A file that cannot be written**: SPB "answers 500 saying the settings could not be saved, and the board shows no workspace new" (S; D: the wording matched by a lenient pattern; "shows no workspace new" observed as no `workspace-new` id on the page and `/new` answering 404). Skipped when run as root, where permissions do not hold.
36. **A linked file**: SPB "keeps the link, and its target holds the saved settings" (S).

Requirement text: SPB "answers 500 where the file exists but cannot be read, and leaves it unchanged" (S). Skipped as root.

### board-pages: Addresses reach workspaces and projects (MODIFIED)

37. **One workspace** (unchanged): existing `tests/server.test.ts` "shows the workspace's overview at /".
38. **Several workspaces** (unchanged): existing `tests/server.test.ts` "links to each at /".
39. **An unknown address** (unchanged): existing `tests/server.test.ts` "answers %s with 404" (each of `/nobody`, `/work/nothing`, `/%E0`, ...).
40. **Another method**: SPB "answers a PUT to /settings with 404, and leaves the file unchanged" (S, the added part); existing `tests/stars-server.test.ts` "answers a POST to /work with 404, from the board's own page", "answers a PUT to /work/one with 404, from the board's own page".

The "with none SHALL answer 303 to `/settings`" clause is scenario 22.

### board-pages: Document text is escaped (MODIFIED)

41. **Markup in a task** (unchanged): existing `tests/render.test.ts` "appears as text on a project's page".
42. **Markup in a reason** (unchanged): existing `tests/render.test.ts` "appears as text on a project's page and in the overview".
43. **Markup on the settings page**: SPB "shows a repository found as <b>x as text", "shows a refused add of <i>y as text" (S).

### board-pages: Several workspaces show as tabs (MODIFIED)

44. **Several workspaces**: existing `tests/tabs-server.test.ts` "links an overview to each, and marks only its own".
45. **On a project's page**: existing `tests/tabs-server.test.ts` "links to each overview, and marks only its workspace", "has its tab as the one link to its workspace".
46. **One workspace**: existing `tests/tabs-server.test.ts` "shows no tabs on its overview or a project's page", "keeps a link to its workspace where there are no tabs".
47. **A name needing care**: existing `tests/tabs-server.test.ts` "encodes the address and escapes the text".
48. **Another workspace is not read**: existing `tests/tabs-server.test.ts` "touches only the workspace of the overview".

The changed clause, the list at `/` linking to the settings page, is SPB "links the list of workspaces, an overview and a project's page to /settings".

### project-reads: Reads follow saved settings (ADDED)

49. **A project added**: SPB "reads two without a restart, its page shows its tasks, and one is not read again" (S; D: "read by the save" observed as `gh` run in `two` before its page is requested, and "one holds what it held" observed as no further `gh` run in `one` plus its page still showing its entry).
50. **A project removed**: SPB "answers /work/two with 404, stops its read, and one holds what it held" (S; D: "the read is stopped" observed as the `gh` the read is waiting on no longer running within 5 seconds).

### project-reads: A save meets the pass at start (ADDED)

51. **Removed during the pass at start**: SPB "never reads two" (S; D: observed as no `gh` run in `two` within 3 seconds of `one`'s read ending).

The clause that projects a save adds are read one at a time per workspace has no scenario and no dedicated test: **deliberately untested** here, since observing it needs a save adding two projects at once, which a single action cannot do, and two saves raced against a read are not deterministic at this level.

### project-reads: Each project is read at start and when requested (MODIFIED)

All seven scenarios are unchanged; the changed clause ("nothing SHALL be read but the projects a save adds") is scenario 49.

52. **A readable project**: existing `tests/reads.test.ts` "holds the document the carried tool printed, and the time of the read".
53. **The server answers during a read**: existing `tests/open-pages-at-once.test.ts` "ends another project's page and the list of workspaces while one project's reads are held".
54. **A changed project is requested**: existing `tests/open-pages-at-once.test.ts` "holds the new document and a later time of the read once its page has ended".
55. **Two requests during one read**: existing `tests/open-pages-at-once.test.ts` "starts no second full read, and both pages end when the read finishes".
56. **Nobody is asking**: existing `tests/open-pages-at-once.test.ts` "starts no read after a page has ended".
57. **An overview reads every project**: existing `tests/open-pages-at-once.test.ts` "starts no read for a workspace of two projects", "ends without waiting for a read in progress".
58. **A request that names no project to read**: existing `tests/open-pages-at-once.test.ts` "starts no read for the list of workspaces".

## Obsolete tests

Candidates for human confirmation, not conclusions. Searched within `tests/**/*.test.ts` only, by the assertions and names bearing on what the `MODIFIED` deltas changed: a missing file, no workspace, an empty `projects`, a relative path, the reserved names, `/` and `/settings` addresses, methods, and between-request reads. No earlier `test-plan.md` was supplied.

1. `tests/board.test.ts` "Bad settings refuse the start > Missing file > exits non-zero, naming the path, the table and projects" (`-t "exits non-zero, naming the path, the table and projects"`). Superseded by settings "Bad settings refuse the start" (MODIFIED; "Missing file" now not refused) and "No settings file starts the board empty" (ADDED). Evidence: runs the command with no settings file and asserts `expectRefused` and `[workspaces.<name>]` on standard error.
2. `tests/board.test.ts` "Bad settings refuse the start > Missing file > looks under ~/.config where XDG_CONFIG_HOME is unset" and "... is empty" (`-t "looks under ~/.config where XDG_CONFIG_HOME is"`). Same supersession. Evidence: no settings file, `expectRefused(result)`; the command would now start and be killed by the 15-second timeout.
3. `tests/settings.test.ts` "Faults of the file's shape > refuses no workspace" (`-t "refuses no workspace"`). Superseded by settings "Settings name workspaces and their projects" (MODIFIED, scenario "Empty": a file naming no workspace). Evidence: `refusal("")`.
4. `tests/settings.test.ts` "refuses an empty workspaces table" (`-t "refuses an empty workspaces table"`). Same supersession, by inference: `[workspaces]` with no table inside names no workspace. Evidence: `refusal("[workspaces]\n")`. Confirm: the spec does not say whether an empty `workspaces` table differs from none.
5. `tests/settings.test.ts` "refuses an empty projects" (`-t "refuses an empty projects"`). Superseded by "Settings name workspaces and their projects" ("a list, possibly empty") and "Bad settings refuse the start" (an empty `projects` dropped from the refusals). Evidence: `refusal("[workspaces.work]\nprojects = []\n")`.
6. `tests/settings.test.ts` "refuses the relative path relative/path, naming it" (`-t "refuses the relative path relative/path"`). Superseded by "Settings name workspaces and their projects" (names relative to `projects_dir`) and "Bad settings refuse the start" ("a relative path" dropped). Evidence: refuses `relative/path` with every path a directory; it is now a valid name.
7. `tests/settings.test.ts` "refuses the relative path ~, naming it" and "refuses the relative path ~someone/path, naming it". Same supersession, by inference: neither begins `/` or `~/`, and neither holds an empty, `.` or `..` segment, so each reads as a name under `projects_dir`. Confirm: the spec does not say whether `~` or `~user/…` should still be refused. (`./relative` from the same `it.each` is not superseded: its `.` segment is still refused.)

Bearing but not superseded: `tests/account-settings.test.ts` "is checked ahead of the projects" uses `projects = ["relative/path"]` as a bad project; it asserts only that `github_account` is named, which still holds where `github_account` is checked first, but its premise (that the path is bad) no longer holds. `tests/tabs-server.test.ts` "stays a list at /, with no tab marked and nothing read" asserts only that `/a` and `/b` are among the links, so a settings link does not break it.

## Unresolved project questions

1. **No TypeScript or Vitest skill in the library.** The tests follow the floor (`testing`) and the existing tests' idiom. Depends: all new tests.
2. **`parseSettings` interface.** Assumed unchanged: `parseSettings(text, { home, isDirectory })` returning `{ workspaces }`, workspaces as `{ name, projects: [{ name, path }] }`, with the default `~/projects` taken from `home`. Where the implementation also asks `isDirectory` of the projects folder, PDS supplies it. Depends: every PDS test.
3. **The settings page's markup.** Assumed from design decisions 4 and 5: each action is a submit button in a `<form method="post">` whose action is `/settings` (or empty, which posts to `/settings` from that page), or a button naming such a form by its `form` attribute; field names `workspace`, `add`, `remove`, `add_workspace` and `remove_workspace`; an offered repository is a submission with a non-empty `add`, the field adding by name or path is a text input `add` with an empty value in a form carrying `workspace`, and the field adding a workspace is an input `add_workspace` with an empty value. Depends: SPB scenarios 19, 20, 23, 24, 25, 43, and "shows the projects folder, ...".
4. **Wording.** "could not be read", "could not be saved" and the comment note are matched by lenient patterns (D). Depends: SPB "offers no repository, and says the folder could not be read", "answers 500 saying the settings could not be saved, ...", "shows the projects folder, ...".
5. **Reads observed through `gh`.** The project-reads tests rely on the carried tool running `gh` with the project as its working directory, as `tests/board.test.ts` already relies on. Depends: SPB scenarios 49, 50, 51.
6. **`reads.replace(workspaces)` and the server's new parameters are not used.** Every save and every read after one is driven through the command, so no test depends on the internal interface names in design decision 6.

## Missing shared arrangement

The dispatch named `tests/support/` (`build.ts`, `document.ts`, `fixture.ts`, `page.ts`, `temporary.ts`). Used from it as is: `isolatedEnvironment`, `buildFixtureRepository`, `git`, `temporaryDirectory`, `removeTemporaryDirectories`, `attribute`, `blocks`, `textOf`. Declared locally:

1. `directories`, `everyPathADirectory`, `workspace`, `refusal` in `tests/projects-dir-settings.test.ts`: stand in for the `parseSettings` options (`home`, `isDirectory`), a workspace table, and catching a `SettingsError`. Used by every PDS test. No near-miss in `tests/support/`. Found in `tests/settings.test.ts` (the same four). Proposed home: `tests/support/settings.ts`.
2. `startBoard`, `Board`, `runCommand`, `freePort`, `occupy`, `waitUntil`, `pause`, `isRunning`, and the `afterEach` that stops boards, kills recorded pids and restores permissions, in `tests/settings-page-board.test.ts`: stand in for running the built command. Used by every SPB test. No near-miss in `tests/support/` (`build.ts` only builds). Found in `tests/board.test.ts` (`start`, `listening`, `run`, `freePort`, `waitUntil`, `isRunning`). Proposed home: `tests/support/board.ts`.
3. `send`, `get`, `ownPage`, `save`, `settingsPage` in `tests/settings-page-board.test.ts`: stand in for an HTTP client that can set `Host`, `Origin` and `Sec-Fetch-Site`. Used by every SPB test that requests a page or posts a save. No near-miss in `tests/support/`. Found in `tests/stars-server.test.ts` (`send`, `ownPage`, `post`). Proposed home: `tests/support/http.ts`.
4. `isolatedHome`, `Home`, `writeSettings`, `workspaceTable` in `tests/settings-page-board.test.ts`: stand in for a home with a projects folder and the settings file's path. Used by every SPB test. Near-miss: `isolatedEnvironment` in `tests/support/fixture.ts`, used by it, which gives the environment but no projects folder and no settings path; extending it would change what every caller arranges. `writeSettings` found in `tests/board.test.ts`. Proposed home: `tests/support/fixture.ts`, as a function beside `isolatedEnvironment`.
5. `foundRepository` in `tests/settings-page-board.test.ts`: stands in for a directory the page finds (one holding `.git`). Used by SPB scenarios 19 to 25, 27 to 34, 43. No near-miss. Proposed home: `tests/support/fixture.ts`.
6. `readableProject` in `tests/settings-page-board.test.ts`: stands in for a repository with one committed backlog entry. Used by SPB scenarios 49 to 51. Near-miss: `buildFixtureRepository` (used by it), which commits one file but no named entry to look for. The extra commit is found in `tests/board.test.ts` "shows a project's tasks once its read has finished". Proposed home: `tests/support/fixture.ts`.
7. `loggingGh`, `lines`, `pidsIn` in `tests/settings-page-board.test.ts`: stand in for a `gh` that records where it ran and can hold a read. Used by SPB scenarios 49 to 51. Near-miss: the `gh` stub `isolatedEnvironment` writes, which logs nothing and cannot hold. Found in `tests/board.test.ts` (`slowGh`, `lines`, `pidsIn`). Proposed home: `tests/support/fixture.ts`.
8. `submissions`, `offered`, `removable`, `removableWorkspaces`, `idsOf`, `linksToSettings` in `tests/settings-page-board.test.ts`: stand in for reading what the page's forms would post. Used by SPB scenarios 19 to 25, 34, 35, 43 and "shows the projects folder, ...". Near-miss: `tests/support/page.ts` (`attribute`, `blocks`, used by them), which reads no forms. Similar in `tests/stars-server.test.ts` (`buttons`, `formsWithId`). Proposed home: `tests/support/page.ts`.
9. `savedSettings`, `Saved` in `tests/settings-page-board.test.ts`: stand in for reading the saved file with `smol-toml`. Used by SPB scenarios 25 to 27, 36 and "keeps every one of several saves posted at once". No near-miss. Proposed home: `tests/support/settings.ts`.

## Dispositions (recorded in build, 2026-11-16)

**Obsolete tests.**

- `tests/board.test.ts` "Missing file > exits non-zero, naming the path, the table and projects": removed; a missing file now starts the board, which "No settings file starts the board empty" covers.
- `tests/board.test.ts` "looks under ~/.config where XDG_CONFIG_HOME is unset" and "… is empty": the block is renamed "Where the file is looked for", and each now places a file that is not valid TOML under `~/.config`, so the start is still refused naming that path; what they assert is unchanged.
- `tests/settings.test.ts` "refuses no workspace", "refuses an empty workspaces table" and "refuses an empty projects": removed from the table; each is now valid, as "Empty" asserts.
- `tests/settings.test.ts` "refuses the relative path relative/path, naming it": `relative/path` removed from the list, being now a name in the projects folder. `./relative`, `~` and `~someone/path` stay refused: a name beginning `~` is not taken as a name in the folder, so `~` stays the home directory's mark only, which answers the test author's question.

**An empty `[workspaces]` table** is read as no workspace, as the test author asked.

**Missing shared arrangement.** Every entry is kept local: `share-the-test-arrangement` in `docs/backlog/` holds the move to `tests/support/`, and gains these two files at archive.

**The hand check (task 3.1, 2026-11-16).** The built board, run with a copy of the operator's settings and their `~/projects`: the page lists both workspaces with their projects as written and folds the repositories found (25 and 26) into "Add from the projects folder"; adding `fuperia/actions` answered 303 to `/settings#workspace-fuperia`, the copy listed it, and `/fuperia` linked to it with no restart; removing it answered 303 and `/fuperia/actions` answered 404. Every page shows the settings link, at the end of the tabs.
