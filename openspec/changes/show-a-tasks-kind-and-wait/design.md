# Design

## Context

See `proposal.md` for why. Rows are built by `taskRow` in `src/render.ts`, on the grid `.rowgrid` in `src/style.ts`, used both by a workstream's steps and by the tasks in no workstream; the In work section uses its own `workRow`. The accepted layout is the patch in `prototype/`, over the compiled `dist/` at `c9a1a2b`, which used provisional key names (`waits_on_status`, `waits_for_types`, `waits_note`) from before the tool's keys were settled. The real keys are those of ai-toolkit's `task-board` spec at `e0bc0c6`: `kind`, `need`, `waits_for`, `waits_for_type`, `parked_until`, `waits_on_done`, `readiness`.

## Goals / Non-Goals

**Goals:**

- Bring the accepted prototype into `src/`, on the tool's real keys.

**Non-Goals:**

- Deriving readiness or stale waits on the board: they come from the carried tool, as status and placement do (README, Non-Goals).
- The In work section, whose tasks have `readiness` `null`.
- Sorting or filtering rows by need or readiness.

## Decisions

1. **Bump the carried tool as a plain copy.** Copy `scripts/task-board` from ai-toolkit `e0bc0c6` to `vendor/task-board` and its full commit to `vendor/task-board.source`, as the README's bump rule says. `schema_version` is still `1`, so `reads.ts` needs nothing. *Alternative*: a version check for the new keys. Not taken: the keys are additive, and a missing key renders as an empty cell.
2. **The board shows what the tool derives, and adds only presentation.** `ready` is shown where `readiness` is `ready`, not wherever there are no marks as in the prototype, so an in-flight step shows no `ready`. Struck-through names come from `waits_on_done`, not from looking up each name's status on the page. A ready task whose `waits_on` names are all done keeps them, struck through, beside `ready`, as the prototype did, so the cue to update the entry is not lost when `ready` moves onto `readiness`.
3. **The counts line follows `readiness`.** `wait for your decision` counts `waiting` tasks with `decision` among their types, not every task with that type as the prototype did. A blocked task carrying a decision type is therefore counted once, as blocked, which is what holds it first.
4. **The workstream's own summary stays**, above the counts. The prototype replaced it; the handoff records the counts as accepted but not the loss of the summary, and `give-tasks-a-summary` added it for this page.
5. **`high` keeps its tag; `parked` moves to Waits.** The prototype dropped the priority tag entirely, but `high` carries evidence of harm, which the new columns do not show.
6. **Colours** are the handoff's: the decision wait teal (`#0b6e78` on `#d5eff1`, count `#0b7d88`; dark `#8fdde4` on `#12393d`), `answer` amber, `access` slate (`#45555f` on `#e3e8ec`), `release` and `event` green, `parked` dashed. An untyped `waits_for` takes a neutral chip reading `waits for`. Values outside the type set in ai-toolkit's `rules/backlog.md` render as a neutral chip with their text, escaped, since the tool passes values unchecked.
7. **Width.** `main` widens to `1180px` and the row grid becomes `96px minmax(0, 1fr) 58px 58px 210px 76px 56px`, as in the prototype. The existing phone rule (`minmax(0, 1fr) auto auto`, status spanning the row) would leave Kind and Need beside the task, so below 640px the rule changes: the task cell spans the row and Kind, Need and Waits follow it on the next line, Last commit and Details after.
8. **Hover without script.** The full `waits_for` and `parked_until` go in `title` attributes, escaped like any attribute value.

## Risks / Trade-offs

- [A wider page on a laptop screen] → `1180px` is a maximum; the task column is `minmax(0, 1fr)` and shrinks first.
- [A tool value outside the known sets, such as `kind: bug`] → shown as its text in a neutral chip, escaped, never used as a CSS class unchecked: classes come from a fixed list.
- [Counts depend on the tool's readiness] → covered by the tool's own spec; the board's tests use document fixtures.

## Migration Plan

Merge raises the version to `0.8.0` and publishes. Confirm with `npx dev-task-board@0.8.0` on a project whose entries carry `kind` and `waits_for`, such as commerce-ops.
