# `see-my-projects-live`

**Goal**: a developer working across several projects keeps one browser tab that shows each project's tasks as they stand whenever it is refreshed, because a page generated once goes stale at once and the picture is otherwise held in memory.

**Done when**: `npx dev-task-board`, run from the published package with settings naming real projects, serves a page whose tasks match what `scripts/task-board --json` reports for those projects, and a task whose state is changed on the forge shows its new state when the open tab is refreshed.

**Steps**:

1. `establish-quality-gate` — build the tooling the foundation decided: the package, the gate, hooks, the release workflow, the carried tool and branch protection.
2. `show-a-workspace` — settings, one command to start, a read of each project, and server-rendered pages: a workspace's overview, opening into each project.
3. `read-on-refresh` — a page's request reads what it shows and waits for it, with nothing read between requests, and the page shows when the data was read.
4. `say-what-a-read-missed` — failed, degraded and unknown-version reads: the last document kept, with its age, the reason and what could not be read.
5. `switch-between-workspaces` — several named workspaces as tabs, and an optional `github_account` for each.
6. `write-the-settings` — the setup command.

- **Not in scope**: what `README.md`'s Non-Goals name, among them editing tasks from the page and reading uncommitted work.
- **Open questions**: none
- **Opened**: 2026-11-01, the operator.

## Context

The board's scope, architecture and failure rules are in `README.md`. Status, stage and placement come from `scripts/task-board --json` in `ai-toolkit`, built by that repository's workstream `see-a-projects-tasks`, whose decision 9 made this a separate application.

## Decisions

**1. A refresh, not a page that updates itself.** The operator, 2026-11-02, with `read-on-refresh`, which replaces the planned `keep-the-page-current`. Seeing fresh data on refreshing is enough, so no timer runs and pages carry no script, at the cost of waiting for the read on each request.
