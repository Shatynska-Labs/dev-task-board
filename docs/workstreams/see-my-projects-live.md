# `see-my-projects-live`

**Goal**: a developer working across several projects keeps one browser tab that shows each project's tasks as they stand, because a page generated once goes stale at once and the picture is otherwise held in memory.

**Done when**: `npx dev-task-board`, run from the published package with settings naming real projects, serves a page whose tasks match what `scripts/task-board --json` reports for those projects, and a task whose state is changed on the forge shows its new state in the open tab without a reload, within two minutes.

**Steps**:

1. `establish-quality-gate` — build the tooling the foundation decided: the package, the gate, hooks, the release workflow, the carried tool and branch protection.
2. `show-a-workspace` — settings, one command to start, a read of each project, and server-rendered pages: a workspace's overview, opening into each project.
3. `keep-the-page-current` — the background timer, its stop when nobody is looking, and the page's refresh, which keeps opened rows open and shows when the data was read.
4. `say-what-a-read-missed` — failed, degraded and unknown-version reads: the last document kept, with its age, the reason and what could not be read.
5. `switch-between-workspaces` — several named workspaces as tabs, and an optional `github_account` for each.
6. `write-the-settings` — the setup command.

- **Not in scope**: what `README.md`'s Non-Goals name, among them editing tasks from the page and reading uncommitted work.
- **Open questions**: none
- **Opened**: 2026-11-01, the operator.

## Context

The board's scope, architecture and failure rules are in `README.md`. Status, stage and placement come from `scripts/task-board --json` in `ai-toolkit`, built by that repository's workstream `see-a-projects-tasks`, whose decision 9 made this a separate application.
