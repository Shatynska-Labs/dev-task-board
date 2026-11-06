# Tasks

## 1. The carried tool

- [x] 1.1 Copy `scripts/task-board` from ai-toolkit `e0bc0c6a8b2be6e59bdefa389769bdeed03f3933` to `vendor/task-board` and write that commit to `vendor/task-board.source`; verify with `npx vitest run tests/carried-tool.test.ts` and by checking that `bash vendor/task-board --json` on a fixture gives tasks with `readiness`.

## 2. Rows

- [x] 2.1 In `src/render.ts`, add the task's new keys to `Task`, the `Kind`, `Need` and `Waits` cells to `taskRow` and to the row head, drop `waits_on` from `taskNotes`, drop the `parked` tag while keeping other non-`normal` priorities, and mark a `could` row as dimmed; verify with the derived tests for "A task's row shows its kind and need", "A task's row shows what it waits on", "A wait already met stays visible" and "A wait is shown once".
- [x] 2.2 In `src/style.ts`, add the grid columns, chips, colours (light and dark), the dimmed `could` row and the fold below 640px; verify by rendering a fixture page and looking at it at desktop and phone width.

## 3. Workstream counts

- [x] 3.1 In `renderStream`, add the counts line under the workstream's summary; verify with the derived tests for "A workstream counts its open steps".

## 4. Release

- [x] 4.1 Raise the version to `0.8.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.

## Workflow follow-up

- Confirm with `npx dev-task-board@0.8.0` on commerce-ops once published.
- At archive, delete `docs/backlog/show-a-tasks-kind-and-wait.md`.

## 5. Confirm

- [x] 5.1 Confirmed by the operator on 2026-11-06 ("спрацювало"), on `0.8.0` run from the merged trunk as `node dist/cli.js` on port 8766, since the package is not yet published and `npx dev-task-board@0.8.0` could not be run: commerce-ops's page showed the Kind, Need and Waits columns on workstream and loose rows and each workstream's count line. `need` other than `should` and `waits_for_type` are absent there until commerce-ops takes ai-toolkit's backlog rules `1.2.0`.
