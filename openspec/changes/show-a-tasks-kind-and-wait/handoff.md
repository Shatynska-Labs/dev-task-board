# Handoff: `show-a-tasks-kind-and-wait`

Opened on 2026-11-05 from a session that prototyped the page with the operator, to keep the accepted layout until the change is taken up. No proposal yet: the session that takes it up writes it.

## Why

Recorded in `docs/backlog/show-a-tasks-kind-and-wait.md`: in use, the board does not show whether a task is a fix or a change, how much it is needed, or what it waits on. The operator asked for those three on every task row and, after the prototype below, accepted it as informative.

## What bears on it

- **It waits on ai-toolkit's `report-a-tasks-kind-and-wait`**, which adds to the entry format a `need` (`must`, `should`, `could`, absent read as `should`) and, beside the free-text `waits_for` condition, a `waits_for_type` list (`decision`, `answer`, `access`, `release`, `event`), and adds to `scripts/task-board --json` each task's `kind`, `need`, `waits_for`, `waits_for_type`, `parked_until`, and a derived `waits_on_done` and `readiness` (`ready`, `blocked`, `waiting`, `parked`, `null` for a task done or in flight). Bumping `vendor/task-board` past that change brings them; the exact keys are that change's spec, not this note.
- **The prototype** in `prototype/` is a patch over the compiled `dist/render.js` and `dist/style.js` of the trunk at `c9a1a2b`, run on a real project's document. What the operator accepted from it:
  - a workstream's and the loose group's rows take the columns `Status | Task | Kind | Need | Waits | Last commit | Details`, `waits_on` moving out of the task's notes into Waits;
  - Kind is a small chip, `fix` outlined in the done colour and `change` filled in the work colour; nothing for a done task;
  - Need: `must` framed in bold, `should` plain, `could` dashed with the row's name and description dimmed;
  - Waits: `ready` in the done colour where nothing holds the task; otherwise a chip per named wait in mono on the work colour, struck through where `waits_on_done` names it, a chip per `waits_for_type` value (`your decision` for `decision`; a `waits_for` with no type shows one neutral chip), `parked` dashed, the `waits_for` condition in small text below, cut to one line, the full condition on hover;
  - a workstream's summary line counts its open steps: `N must left`, `N ready`, `N blocked by a task`, `N wait for your decision`, `N wait for someone else`, `N parked`, zero counts omitted, words side by side with only the number in bold and every count at one weight (mixed weights read as misaligned);
  - colours: the decision wait **teal** (`#0b6e78` on `#d5eff1`, its count `#0b7d88`; dark `#8fdde4` on `#12393d`) — the operator rejected pink, violet and red; `answer` amber, `access` slate (`#45555f` on `#e3e8ec`), `release` and `event` green.
- The board does not derive readiness itself: status and placement come from the carried tool (`README.md`, Non-Goals), so readiness and stale waits come from it too.

## What it must not undo

- Pages carry no script; the prototype added none.
- Every value from the document stays escaped.
- The main column stays usable at phone width: below 640px the extra columns fold under the task, as the existing rows do.
