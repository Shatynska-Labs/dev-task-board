# Test plan: number-a-workstreams-steps

Derived from `specs/board-pages/spec.md` (plan at 3115019) before implementation. This file is not an artifact the OpenSpec schema knows about: `openspec instructions apply` will not list it, so read it on purpose before implementing.

Test file: `tests/step-numbers-render.test.ts`. Run it alone with:

```
npx vitest run tests/step-numbers-render.test.ts
```

A single test is selected with `-t "<full name>"`, the names below being `describe > describe > it` as vitest prints them.

## Baseline

Full suite (`npm test`), before any test was written: 22 files, 440 passed, 1 skipped, 0 failed. Every failure after this pass comes from `tests/step-numbers-render.test.ts`.

## After this pass

`tests/step-numbers-render.test.ts`: 10 failed, 2 passed.

- The 10 failures are state 1: the code ran and gave the wrong value. Each one is `AssertionError: expected [] to deeply equal [ 'N' ]`, meaning the row shows no number. `src/render.ts` exists, so these are not "target absent" failures.
- The 2 passes check that a row shows no number. The renderer already behaves that way, and the rows already exist, so a pass is the expected result: these tests are in the "target already exists" situation. They stop the implementation from numbering too much. Each sits on a page where a sibling test expects a number and currently fails. The `numbersIn` parser they use is the same one `numbersBefore` uses, so it has not yet been seen to detect a number. Once task 1.1 lands, the passing positives on the same pages will show that it does.

## Scenarios

There are 5 scenarios in the delta spec. All 5 are accounted for below, and all 5 are covered. The requirement is "A workstream's steps are numbered" (ADDED).

| # | Scenario | Tests (`A workstream's steps are numbered > …`) |
|---|---|---|
| 1 | Numbered steps | `Numbered steps > shows step-a's position, 1., before its name`; `… step-b's position, 2., …`; `… step-c's position, 3., …`; `Numbered steps > numbers by the order of steps, not of the document's tasks` |
| 2 | A step with no task | `A step with no task > shows 1. in the row of step-a, which has no task`; `A step with no task > shows 2. in the row of step-b` |
| 3 | An unplaced task | `An unplaced task > shows 1. in step-a's row`; `An unplaced task > shows no number in task-u's row, marked unplaced` |
| 4 | A step in work | `A step in work > shows 1. before step-a and 2. before step-b in the workstream`; `A step in work > shows no number in step-b's row in the tasks-in-work section` |
| 5 | A task in no workstream | `A task in no workstream > shows no number in task-t's row` |

There is one more test that no scenario covers. It covers a sentence of the requirement's text: `A done step > keeps its number`, which tests "a step's row keeps its number whatever the task's status".

The spec's names `a`, `b`, `c`, `u`, `t` and `w` became `step-a`, `step-b`, `step-c`, `task-u`, `task-t` and `stream-w`. A one-letter name cannot be found as a word in a page's text.

## Assertion classification

### Specified (traces to the requirement or a scenario)

- A step row shows its position, counted from 1 and followed by a full stop, before the step's name. Tests: every `numbersBefore(...)` expectation, in scenarios 1–4 and in "A done step".
- A step with no task in the document is numbered too. Scenario 2.
- An unplaced task's row shows no number. Scenario 3.
- A step's row in the tasks-in-work section shows no number. Scenario 4.
- A task in no workstream shows no number. Scenario 5.
- A step's row keeps its number whatever the task's status (`done`). This comes from the requirement text, in "A done step".
- The unplaced row reads "unplaced". This is a precondition the scenario states ("marked unplaced"), not new behavior.

### Derived (inferred; no stated requirement covers it)

- **Exactly one number before the name.** `numbersBefore` expects `[N]`, not just that N appears. This rules out a second `N.` token before the name.
- **No `N.` token anywhere in a row that shows no number.** `numbersIn` covers the whole row, not only the part before the name. The spec says "SHALL show no number", and this test reads that as the whole row.
- **Numbering follows `steps` order, not the order of the document's `tasks`** (`numbers by the order of steps, not of the document's tasks`). The spec says "position among the workstream's `steps`". The shuffled order is a discriminator added on top of that.
- **A number is a whitespace-separated text token `N.`** once tags are stripped. This is true if the number is its own element (task 1.1's `<span class="num">N.</span>`) or is separated from the name by a space. A number glued to the name in the text, such as `1.step-a`, would not be read.
- **Extra context in scenario 5.** The page also holds a workstream `stream-w` with `step-a`, and the test checks that `step-a` shows `1.`. This makes a passing "no number" result on the same page meaningful.
- **A stage on the in-work step** (`plan:drafting`). The test uses it to find the in-work row. The scenario names no stage.

### Deliberately untested

- **The `.num` class and its styling** (task 1.2: muted, tabular, aligned). This is design rather than stated behavior. Task 1.2 itself says to check it by rendering at desktop and phone width.
- **The version bump to `0.9.0`** (task 2.1). This is release work and no scenario states it. `tests/package.test.ts` is outside `npm test`.
- **A step whose task is `planned` or `recorded`.** "Whatever the task's status" is tested for `in_flight` (scenario 4) and `done`. `recorded` is the default status, already used in scenarios 1–3. `planned` is not tested separately.

## Obsolete tests

Not applicable. The change has only an ADDED delta, so no MODIFIED or REMOVED delta replaces any existing test.

## Missing shared arrangement

The dispatch named `tests/support/` as the shared arrangement. Its builders (`task`, `step`, `workstream`, `fullDocument`, `page`) and readers (`blocks`, `escapeRegExp`, `textOf`) are used as they are. These are declared locally in `tests/step-numbers-render.test.ts`:

- **`smallestHolding(html, tag, region, ...names)`**: the smallest `<tag>` block inside a region whose text holds each name as a whole word.
  - Used by every test in the file, through the helpers below.
  - Near-miss: `rowOf` in `tests/support/page.ts`. It takes the first text node that matches, page-wide, and only looks at `<li>`. On this change's pages, a step in work has its name twice (in the tasks-in-work section and in its workstream), and the in-work row is not an `<li>`. So `rowOf` cannot pick the right row.
  - Proposed home: `tests/support/page.ts`.
- **`workstreamsStart(html)`**: the offset where the workstream sections begin, which is the "Active workstreams" heading.
  - Used by every test, through `streamRowText` and `inWorkRowText`.
  - No near-miss: `streamHead` finds the same heading, but in the text, not in the markup.
  - Proposed home: `tests/support/page.ts`.
- **`streamRowText(html, stream, name)`**: the text of `name`'s row inside workstream `stream`'s `<details>`.
  - Used in scenarios 1–4, "A done step" and scenario 5's control.
  - Similar arrangement in another test module: `smallestDetailsHolding` in `tests/render.test.ts`. It is local to that module, so it may not be imported. It also does not limit the search to after the workstream heading.
  - Proposed home: `tests/support/page.ts`.
- **`inWorkRowText(html, name, stage)`**: the text of `name`'s row in the tasks-in-work section. That row is a `<div>`, found as the smallest `<div>` before the workstream heading that holds the name and the stage.
  - Used by `A step in work > shows no number in step-b's row in the tasks-in-work section`.
  - No near-miss.
  - Proposed home: `tests/support/page.ts`.
- **`anyRowText(html, name)`**: the smallest `<li>` on the page whose text holds the name as a word.
  - Used by `A task in no workstream > shows no number in task-t's row`.
  - Near-miss: `rowText` in `tests/support/page.ts`. It would do here, but `anyRowText` keeps the file's whole-word matching consistent.
  - Proposed home: none needed. Prefer `rowText` if this is promoted.
- **`numbersBefore(rowText, name)` and `numbersIn(rowText)`, with `NUMBER`**: the `N.` tokens in a row's text, before the name or anywhere in the row.
  - Used by every test.
  - No near-miss.
  - Proposed home: `tests/support/page.ts`.

## Unresolved project questions

- **Which stack skill applies.** The library has no TypeScript or vitest skill, so the tests were written to the testing floor alone, following the idiom of `tests/kind-and-wait-render.test.ts`. Every test depends on this.
- **How the in-work row is marked up.** `AGENTS.md` does not say. The in-work row is a `<div>`, not an `<li>`. I learned this by rendering a probe page and reading only its markup, not `src/render.ts`, after the first run failed with "no `<li>` … holds step-b". Assumption: the in-work row is the smallest `<div>` holding the task's name and its stage. Depends on it: `A step in work > shows no number in step-b's row in the tasks-in-work section`.
- **How a step row is marked up.** Assumption: a step's row, including a step with no task, is an `<li>` inside the workstream's `<details>`. This matches `rowOf`'s convention, and the first run found rows for every step, including the one with no task. Depends on it: every test that calls `streamRowText`.

## Disposition

Every entry above is **kept** local. Each is used by this file alone, and moving page readers into `tests/support/` is the work `docs/backlog/share-the-test-arrangement.md` already holds, with the other test plans' proposed homes; folding part of it in here would split that design. That entry's list of test plans gains this one at this change's archive.
