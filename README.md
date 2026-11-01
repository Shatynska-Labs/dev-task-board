# dev-task-board

<!-- ai-toolkit:project-foundation -->
## What it is

A local board of development tasks, read from your Git repositories. It runs on your machine and is kept open in a browser tab.

A **workstream** is a goal that takes more than one change. The board shows changes, backlog entries and workstreams as one view of a project's tasks, and works in a project with no workstreams.

## Problem

A project's tasks are spread across its workstreams, its backlog, its changes, its branches and its pull requests. Working in parallel sessions across several projects, the picture is held in memory, and a page generated once goes stale at once.

## Audience

A developer working with the `ai-toolkit` workflow's conventions: `docs/workstreams/`, `docs/backlog/` and OpenSpec changes, and whoever they share that way of working with. Its first user is the operator.

## Scope

- Named workspaces, each one tab, with an explicit list of projects, one workspace by default and any number more. Names and projects live in the user's settings, and nothing about a user is in the code.
- For each project what `scripts/task-board --json` reports: what is in work and at what stage, workstreams that open to their steps, and tasks no workstream holds.
- Refreshing in the background, showing when the data was last read, and saying plainly when a read failed.
- An overview of a workspace's projects, opening into each.
- A setup command writing the settings, and one command to start it.

## Non-Goals

- **Editing tasks from the page.** Tasks change through the `backlog` skill. Considered and left until the read-only board has been used.
- **Restating the workflow's rules.** Status, stage and placement come from `scripts/task-board`, never from this code.
- **A native desktop program.** A pinned browser tab gives the same.
- **Any hosted service, account or sync.** Nothing leaves the machine but the reads `git` and `gh` make.
- **Discovering projects by scanning folders.** Projects are named, so nothing is tracked that was not asked for, and a wrong path is an error.
- **Trackers outside the repository**, such as Jira, Linear or ClickUp.
- **Nested workstreams**, which the convention does not have.
- **Reading uncommitted work.** A later change may read working trees and sessions. The first version shows what `--json` reports.

## Technology

- **TypeScript on Node**.
- **Node's own `node:http`, with no web framework.** There are a handful of routes and no state beyond a cache, and a public tool installed by others is better with few dependencies.
- **Pages rendered on the server as HTML, with a small script** that refreshes the data and keeps opened rows open. No client framework: the accepted layout is plain markup with `<details>`, and the page stays readable with scripting off.
- **`smol-toml`** for the settings file, the one runtime dependency.
- **`scripts/task-board` carried as a pinned copy** in the package, so nothing depends on where `ai-toolkit` sits on a disk. It needs bash, git and awk, and `gh` where present.

## Architecture

- **Settings** at `~/.config/dev-task-board/config.toml`: `[workspaces.<name>]` with `projects` and an optional `github_account`. With no `github_account`, `gh` is used as it is logged in.
- **Collector**: for each project, runs the carried tool with `--json`, checks `schema_version`, and caches the document in memory. It runs on a timer only while a tab has asked recently, one project at a time per workspace, so a refresh never waits on a read and nothing runs overnight.
- **Server**: binds to `127.0.0.1` only. `/<workspace>` is the overview, `/<workspace>/<project>` a project, and `/api/...` the cached documents with their read time. With one workspace, `/` is that workspace.
- **Failure**: a project that cannot be read keeps its last document, marked with its age and the reason. A `schema_version` it does not know is stated, never guessed at.
<!-- /ai-toolkit:project-foundation -->
