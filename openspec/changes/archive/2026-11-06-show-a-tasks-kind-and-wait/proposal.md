# Proposal

## Why

In use, the board does not show whether a task is a fix or a change, how much it is needed, or what holds it up (`docs/backlog/show-a-tasks-kind-and-wait.md`). `waits_on` appears only as a line of notes, and `kind`, `need`, `waits_for` and readiness are not drawn at all. ai-toolkit's `report-a-tasks-kind-and-wait` is now archived (#99, #100), so the carried tool can give them, and the operator accepted a prototype of the rows on 2026-11-05 (`handoff.md`, `prototype/`).

- **Workstream**: this change advances none; its entry names none.

## What Changes

- `vendor/task-board` is taken from ai-toolkit at `e0bc0c6a8b2be6e59bdefa389769bdeed03f3933`, and `vendor/task-board.source` names it. Each task in the document then carries `kind`, `need`, `waits_for`, `waits_for_type`, `parked_until`, `waits_on_done` and `readiness`; `schema_version` stays `1`.
- A workstream's rows and the rows of tasks in no workstream take the columns `Status | Task | Kind | Need | Waits | Last commit | Details`:
  - **Kind**: `fix` or `change` as a small chip, none for a done task;
  - **Need**: `must`, `should` or `could`, none for a done task; a `could` task's name and description are dimmed;
  - **Waits**: `ready` where readiness is `ready`, beside any `waits_on` name already done, struck through; otherwise a chip per `waits_on` name, struck through where it is done, a chip per `waits_for_type` value (`your decision` for `decision`), one neutral chip for a `waits_for` with no type, `parked` for a parked task, and the `waits_for` condition below, cut to one line, in full on hover.
- `waits_on` leaves the task's notes, since the Waits column shows it.
- A parked task shows `parked` in Waits instead of a `parked` tag beside its name; `high` keeps its tag.
- A workstream's summary gains a line counting its open steps: must left, ready, blocked by a task, waiting for your decision, waiting for someone else, and parked, each count shown only where it is not zero.
- Below 640px the new columns fold under the task. Pages still carry no script, and every value stays escaped.
- The version rises to `0.8.0`, since the pages change visibly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: a task's row shows its kind, need and wait, and a workstream counts its open steps by readiness.

## Impact

- Changed: `vendor/task-board`, `vendor/task-board.source`, `src/render.ts`, `src/style.ts`, their tests, `package.json`, `package-lock.json`.
- The In work section is unchanged: readiness is `null` for a task in flight, and its row already shows its stage.
- Reading, caching and `schema_version` checking are unchanged. A document without the new keys, as from an older tool, renders with no kind, no need and no `ready`; its `waits_on` and `parked` marks still show.
