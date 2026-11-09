# Proposal

## Why

Agents name a workstream's steps by their position — "step 6", "the sixth task" — as the workstream file numbers them, but the board lists the steps unnumbered, so the operator has to count rows to find the one meant. The operator asked on 2026-11-09 that a workstream's tasks be numbered on the board.

- **Workstream**: this change advances none.

## What Changes

- On a project's page, each step of a workstream shows its position in the workstream's `steps`, counted from 1, as `6.` before its name — the same number the workstream file gives it. A step whose task is missing from the document is numbered too.
- A task the workstream names but no step holds, marked unplaced, takes no number, since it has no position among the steps.
- A step keeps its number whatever its status, in work or done. The rows of the tasks-in-work section and of tasks in no workstream are not numbered.
- The version rises to `0.9.0`, since the pages change visibly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: a workstream's steps are numbered by their position.

## Impact

- Changed: `src/render.ts`, `src/style.ts`, their tests, `package.json`, `package-lock.json`.
- Reading, caching and the document's schema are unchanged: the number is the step's index in `steps`, which the document already orders.
