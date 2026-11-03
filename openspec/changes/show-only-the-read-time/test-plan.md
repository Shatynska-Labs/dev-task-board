# Test plan: show-only-the-read-time

Derived from the delta spec `specs/board-pages/spec.md` (one `MODIFIED` requirement, "A project's page shows its document"), before implementation. Tests written: `tests/read-time-only.test.ts`. No existing test was edited, deleted or disabled.

Run the derived tests with `npx vitest run tests/read-time-only.test.ts`; select one with `-t "<name>"`.

## Baseline

Full suite, before any test was written: `npm test` — 20 files, 407 passed, 1 skipped, 0 failed.

After writing: `tests/read-time-only.test.ts` — 1 passed, 4 failed. The four failures are state 1 (the code ran and produced a wrong value): the page today shows `written_at`, `written`, `origin/main` and `2cc5bd8`. The one pass is the expected result where the target exists (`renderProject` already shows `Read <time>`), not an alarm.

## Scenarios

The delta holds 4 scenarios; 4 are accounted for below.

| Scenario | Coverage |
|---|---|
| The sections | Unchanged in text by the delta. Covered by existing tests: `tests/render.test.ts > A project's page shows its document > The sections > puts each in its section, in order`, `... > opens a workstream with <details> to its steps`, `... > puts the unplaced task inside its workstream, marked`, `... > shows a task in work with its stage`; and `tests/refresh-render.test.ts > A project's page shows its document > The sections > keeps the steps and the marked unplaced task inside <details>`. No new test written. |
| A project with no workstreams | Unchanged in text by the delta. Covered by existing `tests/refresh-render.test.ts > A project's page shows its document > A project with no workstreams > shows its tasks and the read time, and no workstream section`. No new test written. |
| The time of the read | Unchanged in text by the delta. Covered by existing `tests/refresh-render.test.ts > A project's page shows its document > The time of the read > shows it to the second, in UTC`, `... > words it as the design does`, `... > does not take the machine's time zone`. No new test written. |
| Only the time of the read | New. Covered by the five tests in `tests/read-time-only.test.ts > A project's page shows its document > Only the time of the read` (below). |

## Assertions and their classification

All in `tests/read-time-only.test.ts > A project's page shows its document > Only the time of the read`, over the page's visible text (tags and inline `<style>` stripped), with the scenario's fixture: `written_at` `2026-11-01T22:17:44Z`, trunk `origin/main` / `2cc5bd8`, read at `2026-11-01T22:18:05.123Z`.

| Test | Assertion | Class |
|---|---|---|
| `shows Read and the time of the read` | text contains `Read 2026-11-01 22:18:05 UTC` | specified |
| `does not show the document's written_at` | text does not contain `22:17` | specified |
| `does not say written` | text does not contain `written` | specified |
| `does not show the trunk's ref` | text does not contain `origin/main` | specified |
| `does not show the trunk's commit` | text does not contain `2cc5bd8` | specified |

Deliberately untested:

- **Placement** — "beside the project's name, or under it on a narrow page". It is layout set in CSS (`src/style.ts`), not observable from markup beyond text order, and the requirement's own sentence lists the read time last in "in this order" while placing it beside the name, so an order assertion would have to pick a reading. Not tested; see the finding below.
- **"`Read` and its date and time alone"** as an exact element text — would require naming the element that carries it, which the spec does not; the absence assertions above cover what "alone" excludes.
- **Hidden occurrences** — `written_at`, ref or commit inside attributes (e.g. `title`) are not asserted absent; the scenario says "shows", read as visible text. Case variants such as `Written` are likewise not asserted (the scenario names `written`).
- **Version rise to `0.7.0`** (proposal, tasks 2.1) — not a scenario; no test.

## Obsolete tests (candidates for human confirmation)

Search bounded to `tests/**/*.test.ts`; no earlier `test-plan.md` was supplied. Superseding delta: `MODIFIED` board-pages "A project's page shows its document", whose current text under `openspec/specs/board-pages/spec.md` requires "the document's `written_at` and the time of the read", and whose revised text says the page "SHALL NOT show the document's `written_at`, nor the trunk's ref or commit".

1. `tests/render.test.ts > A project's page shows its document > The sections > shows the document's written_at` — **candidate for human confirmation**. Evidence: its name, and its sole assertion `toMatch(/2026-11-01.22:17/)` over a document with `written_at` `2026-11-01T22:17:44Z`. It will fail once implemented, and directly contradicts `does not show the document's written_at`.
2. `tests/refresh-render.test.ts > A project's page shows its document > The sections > keeps the sections in order, with the written and read times` — **candidate for human confirmation**, partially: only its assertion `expect(text).toMatch(/2026-11-01.22:17/)` (line 203) and the "written" in its title bear on superseded behavior; its order and `Read ${shownTime}` assertions still hold. tasks.md 1.1 already names both entries for removal/retitling.

No other test in the glob asserts `written_at`, `written`, `origin/main` or `2cc5bd8` on a page; the remaining occurrences are document fixtures, and `tests/render.test.ts > ... > takes a task's age from written_at` concerns a task's age, which the proposal says is unchanged. This is "none found by this search" for any further bearing test, not proof none exists outside the glob.

## Unresolved project questions

- **Stack skill** — the ai-toolkit library carries no TypeScript/Vitest skill; tests were written on the testing floor and the idiom of the existing `tests/*.test.ts`. No test depends on an assumption beyond that.
- **Requirement wording (finding, not resolved here)** — the revised requirement says "in this order, ... tasks in no workstream, ..., and the time of the read, ... beside the project's name". Read literally, the time is last in the page's order; the design places it first in the part after the header. The derived tests assert no position, so none depends on either reading. If the requirement's order is meant to exclude the read time, that is a wording fix for `openspec-update-change`.

## Missing shared arrangement

The dispatch named `tests/support/` (`build.ts`, `fixture.ts`, `temporary.ts`), which holds Git-fixture and temporary-directory helpers but no document builder, project-state builder or text extractor. Near-miss: none (no arrangement there for the document or `ProjectState`). Local declarations in `tests/read-time-only.test.ts`, each used by all five tests of `tests/read-time-only.test.ts > A project's page shows its document > Only the time of the read`:

1. `documentWrittenBeforeTheRead` — stands in for the tool's JSON document (a read project's document with `written_at` and `trunk`). Found in test modules as `fullDocument` in `tests/render.test.ts` and `tests/refresh-render.test.ts` (also redeclared in several other test files). Proposed home: a document builder in `tests/support/` (e.g. `tests/support/document.ts`).
2. `readAt` — stands in for a read `ProjectState` (`{ state: "read", document, readAt }`), the third argument of `renderProject`. Found as `read` in `tests/render.test.ts` and `tests/refresh-render.test.ts`. Proposed home: beside the document builder in `tests/support/`.
3. `textOf` — the page's visible text (tags and `<style>` stripped). Found as `textOf` in `tests/render.test.ts` and `tests/refresh-render.test.ts`. Proposed home: a page-text helper in `tests/support/`.

This manifest is not an artifact the OpenSpec schema knows about; it does not appear among `openspec instructions apply`'s context files and must be read on purpose.
