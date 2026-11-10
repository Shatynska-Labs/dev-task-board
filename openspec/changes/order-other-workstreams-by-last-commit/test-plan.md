# Test plan: order-other-workstreams-by-last-commit

Derived from `specs/board-pages/spec.md` as committed at `df20eac`, before implementation. This file is not an artifact the OpenSpec schema knows about: it will not appear among `openspec instructions apply`'s context files and must be read on purpose.

All tests are in `tests/other-workstreams-order-render.test.ts`, under the `describe` block `Other workstreams are ordered by their latest commit`. Run one with `npx vitest run tests/other-workstreams-order-render.test.ts -t "<test name>"`; run all with `npx vitest run tests/other-workstreams-order-render.test.ts`.

Level: unit, rendering a project's page from a document fixture with `page()` from `tests/support/document.ts`, the smallest unit that observes the order (per AGENTS.md, "Unit tests cover settings and rendering from document fixtures"). The order is read from the page's text: within the "Other workstreams" section (from that heading to the page's end), each workstream name's first whole-word position; for active workstreams, from the "Active workstreams" heading to the "Other workstreams" heading or the page's end.

## Baseline

Full suite, `npm test` (which runs `vitest run --exclude tests/package.test.ts`), before any test was written: 23 files, 452 passed, 1 skipped, 0 failed.

## Scenarios

Delta specs hold 7 scenarios, all under one `ADDED` requirement; 7 accounted for, all covered.

| # | Scenario | Test | Result at authoring |
|---|---|---|---|
| 1 | Newest first | `Newest first: beta, at 200, before alpha, at 100` | fails, wrong value (state 1): renders `alpha, beta` |
| 2 | The latest of several tasks | `The latest of several tasks: alpha, at 100 and 300, before beta, at 200` | fails, wrong value (state 1): renders `beta, alpha` |
| 3 | An unplaced task counts | `An unplaced task counts: alpha's unplaced 300 puts it before beta's 200` | fails, wrong value (state 1): renders `beta, alpha` |
| 4 | No commit comes last | `No commit comes last: beta, at 100, before alpha, at null` | fails, wrong value (state 1): renders `alpha, beta` |
| 5 | Equal commits by name | `Equal commits by name: alpha before beta, both at 100, beta first in the document` | fails, wrong value (state 1): renders `beta, alpha` |
| 6 | No commits by name | `No commits by name: alpha before beta, neither with a commit, beta first in the document` | fails, wrong value (state 1): renders `beta, alpha` |
| 7 | Active workstreams are ordered too | `Active workstreams are ordered the same way: beta, at 200, before alpha, at 100` | passes |

One further test covers requirement text no scenario exercises: `an absent last_commit also counts as none and comes last` — fails, wrong value (state 1): renders `alpha, beta`.

Scenario 7 passes on its first run by design: it guards behavior that already exists and that the requirement says must not change, so its pass is the expected result, not the absent-target alarm. It discriminates against an implementation that sorts both sections (which would render `beta, alpha`).

## Assertion classification

- Scenarios 1–7: each `toEqual` on the order of `alpha` and `beta` is **specified** — it traces to the scenario's THEN.
- `an absent last_commit also counts as none and comes last`: **specified** — traces to the requirement's sentence "A `last_commit` that is absent or `null` counts as none, and a workstream with none SHALL follow every workstream with one"; no scenario uses an absent key.
- Fixture choices the scenarios leave open, all **derived**, made so each test discriminates against the document's order where the scenario allows it:
  - Scenarios 2 and 3 put `beta` first in the document (the GIVEN does not fix document order); scenario 2 lists alpha's 100 step before its 300 step, so an implementation taking the first or the least commit fails.
  - Scenario 6 gives one task `last_commit: null` and the other no key, covering both forms of "none" the requirement names.
  - In scenario 3 the unplaced task is `task("u-1", { workstreams: ["alpha"], unplaced: true })`, i.e. `unplaced: true` as the document marks it; the requirement defines unplaced as named by `workstreams` but held by no step, which this fixture also satisfies.
- Deliberately untested: more than two workstreams, and ties among three or more — the scenarios fix pairs and the pairwise rules determine the rest; a workstream with no tasks at all (no steps with tasks, no unplaced tasks) — it has no `last_commit` and falls under "none", which scenario 6 covers by the same rule.

## Obsolete tests

Not applicable: the change carries only an `ADDED` delta, no `MODIFIED` or `REMOVED` one. For information: a search of `tests/**/*.test.ts` for inactive workstreams (`workstream("…", false` and `active: false`) found only fixtures with a single inactive workstream (`tests/render.test.ts` lines 100 and 420, `tests/refresh-render.test.ts` line 65), so none asserts the document's order among other workstreams.

## Unresolved project questions

- No stack-specific skill for TypeScript/Vitest exists in the library; tests follow the `testing` floor and the precedent `tests/step-numbers-render.test.ts`. No test depends on an assumption from this.
- The section headings are assumed to read "Active workstreams" and "Other workstreams" (matched case-insensitively), as `tests/render.test.ts` and `tests/step-numbers-render.test.ts` already assume. All eight tests depend on it.

## Missing shared arrangement

Shared arrangement dispatched: `tests/support/`. Two local declarations in `tests/other-workstreams-order-render.test.ts`, plus two page-reading helpers:

- `inactive(name, steps)` — stands in for an inactive workstream in the document (`active: false`). Used by every test except scenario 7. Near-miss: `workstream()` in `tests/support/document.ts` always gives `active: true` and takes no `active` parameter, so it cannot build an inactive workstream; the local declaration spreads its result and overrides `active`. Also found in a test module: `tests/render.test.ts` declares its own `workstream(name, active, steps)`. Proposed home: an `active` option on `workstream()` in `tests/support/document.ts`, or an `inactiveWorkstream()` beside it.
- `withoutCommit(task)` — stands in for a task written with no `last_commit` key (as distinct from `null`). Used by `an absent last_commit also counts as none and comes last` and `No commits by name: …`. Near-miss: `task()` in `tests/support/document.ts` always sets `last_commit` (default `THREE_DAYS_BEFORE`), and `Partial<Task>` cannot remove a key. Not found in another test module. Proposed home: `tests/support/document.ts`.
- `sectionText(html, heading, next?)` and `orderIn(text, ...names)` (with `otherOrder`) — read a section of the rendered page and the order names first appear in it. Used by all eight tests. No near-miss in `tests/support/page.ts` (`expectInOrder` asserts order of substrings over the whole text but does not bound to a section or match whole words; `streamHead` reads from "Active workstreams" only). A similar `workstreamsStart` exists in `tests/step-numbers-render.test.ts`. Proposed home: `tests/support/page.ts`.

### Disposition

- `inactive`, `withoutCommit`, `sectionText`, `orderIn` and `otherOrder`: **keep** local in `tests/other-workstreams-order-render.test.ts`, for the backlog entry `share-the-test-arrangement`, which consolidates local arrangement across test files and already takes `tests/render.test.ts`'s own `workstream(name, active, steps)`; extending `workstream()` with an `active` option there touches every builder caller at once, which is that entry's work rather than this change's.
