# Test plan: `show-a-tasks-kind-and-wait`

This file is not an artifact the OpenSpec schema knows about. It will not appear among `openspec instructions apply`'s context files, so read it on purpose before implementing.

Derived from `specs/board-pages/spec.md` (ADDED requirements only) at plan commit `2542713`. All tests are in one new file, `tests/kind-and-wait-render.test.ts`. No existing test was edited, deleted or disabled.

Run one test: `npx vitest run tests/kind-and-wait-render.test.ts -t "<describe> <describe> <it>"`. The `-t` pattern is the full name below, which is the describe path and the test name joined by spaces. Run them all: `npx vitest run tests/kind-and-wait-render.test.ts`.

## Baseline

Full run of `npm test` before writing any test, at HEAD `2542713` with a clean tree: 21 files, 411 passed, 1 skipped, 0 failed.

After adding the tests: 22 files, 411 passed, 1 skipped, 29 failed. All 29 failures are in `tests/kind-and-wait-render.test.ts`. `npx tsc --noEmit` and `npx biome ci .` are clean.

## How the tests observe the page

The spec does not say what markup to use for "struck through", "dimmed", "a mark" or "a title", so the tests read those things like this. Each is a **derived** reading of the spec's words:

- **Row**: the smallest `<li>` that holds the task's name as a whole text node.
- **Struck through**: the wait name is a whole text node inside `<s>`, `<del>` or `<strike>`, or inside an element whose inline `style` has `line-through`, or inside an element that a rule in the page's own `<style>` gives `line-through`. Rules are matched as descendant selectors, and selectors with a pseudo-class or an attribute selector are skipped. Before the tests were committed, this check was run on throwaway markup: a class rule like the prototype's `.wchip.name.stale`, an `<s>` element and a descendant rule were each recognised, and the name left unstruck was not.
- **Dimmed**: the row's markup from its start up to the end of the task's name differs between a `could` task and the same task with `need` `should`. The mark therefore has to be on the `<li>` or on an element that opens before the name ends. A mark made only through CSS `:has()` on the need cell would not pass. See unresolved question Q2.
- **Title**: the decoded value of a `title` attribute, either on an element in the row or on an element around a given text node.
- **Workstream summary**: the page text after the heading `Active workstreams`, starting at the workstream's name and stopping before its first step's name.
- **Escaping of `waits_for`**: the condition `the operator's choice of model` has to come back in full from a `title` attribute. An unescaped quote in that attribute would cut the value short.

## Scenarios (14) and their tests

The delta has 14 scenarios and each is accounted for once below. All 14 are covered and none is left uncovered. Below, S means specified (traces to a scenario or to a sentence of the requirement), D means derived, and C means a control assertion. A control is a positive check in the same test that makes a negative assertion able to fail.

### Requirement: A task's row shows its kind and need

1. **Kind and need**: covered.
   - `A task's row shows its kind and need Kind and need shows fix and must in the row of a task in no workstream`. The row shows `fix` and `must` (S). Placement in no workstream is from the requirement sentence (S).
   - `... shows fix and must in the row of a task in a workstream`. Same check for a workstream step (S, requirement sentence).
   - `... heads the rows of a task in no workstream with Kind, Need and Waits between Task and Last commit`, and the same test `... in a workstream ...`. The row head reads `Task`, `Kind`, `Need`, `Waits`, `Last commit` in that order (S). Using the smallest `<li>` that holds `Last commit` and `Task` as the head is D.
   - `... puts kind, need and waits between the task and its last commit`. In the task row the order is name, `fix`, `must`, `ready`, then the age `3 d` (S, requirement: "between the task and its last commit"). Reading the last commit as the age text `3 d` is D, taken from the existing tests.
2. **A done task**: covered.
   - `A task's row shows its kind and need A done task shows no kind, no need and nothing under Waits`. A done task with kind `change` and need `should` shows no `fix`/`change`, no `must`/`should`/`could` and no `ready` (S). C: an open sibling with the same kind and need does show them.
   - `... shows nothing under Waits even where it named a wait`. A done task with `waits_on`, `waits_for`, `waits_for_type` and `priority` `parked` shows none of them (S, requirement 2: "A done task SHALL show nothing under Waits"). This test also asserts there is no `parked` tag on a done task, which is D: it follows from requirement 4 and was not stated for done tasks on its own.
3. **A could task**: covered.
   - `A task's row shows its kind and need A could task marks the row dimmed, where a should row is not` (S for "marked dimmed"; D for how it is observed, see above).
   - `... does not mark a done could task's row` (S, requirement: dimming applies only where status is not `done`). C: within the same test, an open `could` row is marked.
   - Not covered: that the description is dimmed as well as the name. This is deliberately untested, because the spec gives no observable markup for it beyond the row mark.

Also from this requirement:
- `A task's row shows its kind and need A null kind or need shows no kind and no need` (S, requirement sentence on `null`, C sibling).
- "Below 640px the three columns SHALL fold under the task" is deliberately untested. No scenario states it, and checking it needs CSS layout at a viewport width, which a unit test that renders a document cannot observe. `tasks.md` 2.2 checks it by eye.

### Requirement: A task's row shows what it waits on

4. **A ready task**: covered by `A task's row shows what it waits on A ready task shows ready` (S).
5. **Waits on names, one done**: covered.
   - `... Waits on names, one done shows dep-a struck through and dep-b not` (S). The names `dep-a` and `dep-b` stand in for the scenario's `a` and `b`, because a one-letter name cannot be found reliably in the row text (D).
   - `... shows no ready, and no note reading Waits on` (S).
   - `... strikes a name by waits_on_done, not by a done task of that name on the page` (S, requirement: "struck through where `waits_on_done` holds it"; design decision 2).
6. **A typed condition**: covered.
   - `... A typed condition shows your decision, access and the condition` (S).
   - `... gives the condition in full as a title, escaped` (S, requirement: "given in full as a title"; the scenario's "escaped").
   - Not covered: "cut to one line". This is deliberately untested because it is CSS presentation that cannot be observed without layout.
7. **An untyped condition**: covered.
   - `... An untyped condition shows one mark for the wait, reading waits for`. The row text has exactly one `waits for` (S for one mark). The mark's text `waits for` is D, taken from design decision 6, not from the spec.
   - `... shows the condition, and gives it in full as a title` (S).
8. **Markup in a wait**: covered by `... Markup in a wait shows both as text`. Both `&lt;b&gt;x&lt;/b&gt;` and `&lt;i&gt;y&lt;/i&gt;` are in the row, and there is no raw `<b>x` or `<i>y` anywhere on the page (S). Expecting the `&lt;` entity form is D, matching the project's existing escaping tests.

### Requirement: A wait already met stays visible

9. **A wait already met**: covered by `A wait already met stays visible A wait already met shows ready and dep-a struck through` (S).

### Requirement: A wait is shown once

10. **A parked task**: covered.
    - `A wait is shown once A parked task shows parked under Waits, with the API is public as its title`. The order is name, `change`, `should`, `parked`, and an element around the text `parked` carries the title `the API is public` (S). Reading "under Waits" as "after the Kind and Need cells" is D.
    - `... shows no parked tag beside its name`. No `parked` appears before the kind cell, and `parked` appears exactly once in the row (S).
11. **A high task**: covered by `A wait is shown once A high task keeps a high tag beside its name`. `high` appears after the name and before the kind cell (S; "beside its name" read as before the Kind column is D).
12. **A document from an older tool**: covered.
    - `... A document from an older tool renders, with no kind, no need and no ready` (S). C: the same task given the new keys shows them.
    - `... still shows its waits_on and parked marks`. `dep-old` shows with no `Waits on` note, and `parked` still shows (S, requirement sentence).

### Requirement: A workstream counts its open steps

13. **Mixed steps**: covered by `A workstream counts its open steps Mixed steps shows the summary, then each count in order, and no parked count` (S).
    - `... A blocked step with a decision type counts it once, as blocked` (S, requirement: decision counts only `waiting` steps; design decision 3).
    - `... Parked steps counts them last`. `2 parked` comes after the earlier counts (S, requirement sentence).
14. **Nothing open**: covered by `... Nothing open shows no count`. The workstream's summary still shows, and there is no `N <count word>` text (S). The done steps carry `need` `must` so that an implementation that also counted done steps would fail (D arrangement). C: a second workstream on the same page with one open `must` step shows `1 must left`.

## Failure states at authoring

All 29 tests fail at authoring, and every failure is for a reason the change has not yet supplied:
- Assertion mismatches because kind, need, `ready`, wait marks, titles, the new head columns or the counts are missing, or because the old `Waits on` note or the `parked` tag is still present. These assertions ran and discriminated (state 1).
- `shows dep-a struck through and dep-b not` and `strikes a name by waits_on_done, …` throw `the row of held-task shows no dep-a`. Today `waits_on` is drawn only inside the note `Waits on dep-a, dep-b`, so there is no text node reading `dep-a`. The struck-through assertion itself has not run yet, so these two are in the target-absent state. The helper behind it was checked on throwaway markup, as described above.
- Every negative assertion is paired with a control in the same test, so no test passes on its first run. Before the controls were added, seven tests passed on their first run. The cause was missing controls, plus `ready-task` matching `\bready\b` through its own name, which was a defect in the test (state 3). It was fixed by renaming the task `task-r`.

When the change lands, every one of these 29 tests is expected to turn green. Each one's red-at-authoring state is recorded here.

## Obsolete tests

Not applicable. The delta has only ADDED requirements and no MODIFIED, REMOVED or RENAMED delta. For information: requirement 4 removes the `Waits on` note and the `parked` tag. A search of `tests/**/*.test.ts` for `Waits on` and for a parked tag found no existing test that asserts either. `tests/render.test.ts`'s `orders tasks in no workstream in flight first and parked last` still holds under the delta. This search covered only the test-path glob, and no earlier `test-plan.md` was supplied.

## Unresolved project questions

- **Q1. Stack skill.** No ai-toolkit skill exists for TypeScript or Vitest, so the tests follow `testing` and the existing tests' style alone. All tests depend on this.
- **Q2. Markup for "struck through" and "dimmed".** Neither the spec nor the conventions name the markup. Assumptions taken: struck through means `<s>`, `<del>`, `<strike>`, or `line-through` from the page's `<style>` or an inline style. Dimmed means a mark on the row or on its name that opens before the name ends. Tests that depend on Q2: the three struck-through tests (`shows dep-a struck through and dep-b not`, `strikes a name by waits_on_done, …`, `shows ready and dep-a struck through`) and the two `A could task` tests.
- **Q3. Text of the untyped wait's mark.** The tests assume the mark reads `waits for`, as design decision 6 says. Depends on it: `shows one mark for the wait, reading waits for`.

## Missing shared arrangement

The dispatch named `tests/support/`. It holds `build.ts` (global build setup), `fixture.ts` (an isolated environment, `git`, and a fixture repository) and `temporary.ts` (temporary directories). None of these builds a document. Every local declaration in `tests/kind-and-wait-render.test.ts` is listed here:

- **`Task` type and `task()`**: stand in for a task in the carried tool's `--json` document, with the new optional keys `kind`, `need`, `waits_for`, `waits_for_type`, `parked_until`, `waits_on_done` and `readiness`. The default task leaves those keys out, so it is a document from an older tool. Used by every test in the file. Near-miss in the shared arrangement: none. Found in a test module: `tests/render.test.ts` (the same name, without the new keys and with a different `last_commit`), and similar copies in `tests/keep-render.test.ts`, `tests/refresh-render.test.ts` and `tests/account-render.test.ts`. Proposed home: `tests/support/document.ts`.
- **`step()`**: a task placed as a workstream step. Used by the `Kind and need … in a workstream` tests and all `A workstream counts its open steps` tests. Near-miss: none. Not found in a test module. Proposed home: `tests/support/document.ts`.
- **`workstream()`**: stands in for a document workstream, with an optional `summary`, always active. Used by the same tests as `step()`. Near-miss: none. Found in `tests/render.test.ts` (with an `active` parameter and no summary). Proposed home: `tests/support/document.ts`.
- **`fullDocument()`**: stands in for a `schema_version` 1 document. Used by every test. Near-miss: none. Found in `tests/render.test.ts`. Proposed home: `tests/support/document.ts`.
- **`page()` and `loosePage()`**: a `read` `ProjectState` passed to `renderProject`. Used by every test. Near-miss: none. Found in `tests/render.test.ts` as `read()` and `page()`. Proposed home: `tests/support/document.ts`.
- **HTML reading helpers** (`decode`, `textOf`, `expectInOrder`, `blocks`, `rowOf`, `rowText`, `enclosing`, `selectorsDeclaring`, `takesRule`, `struckThrough`, `titlesAround`, `titlesIn`, `rowUpToName`, `streamHead`): stand in for reading what a page shows. Used by every test. Near-miss: none. `textOf`, `expectInOrder` and the `<details>` block walk were found in `tests/render.test.ts`. This file's `textOf` also decodes entities. Proposed home: `tests/support/page.ts`.
