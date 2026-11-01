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
- **`scripts/task-board` carried as a pinned copy** at `vendor/task-board`, with its source commit in `vendor/task-board.source`, so nothing depends on where `ai-toolkit` sits on a disk. It stands alone, sourcing nothing, and runs through `bash`. Bumping it is a normal change, which `schema_version` guards.
- **Platforms**: Linux, WSL and macOS, where bash, git and awk are ordinary. Windows outside WSL is not supported.

## Architecture

- **Settings** at `~/.config/dev-task-board/config.toml`: `[workspaces.<name>]` with `projects`, a list of paths, and an optional `github_account`. A project's address is its directory's base name, and two of one name in a workspace are refused at start. `api` is reserved as a workspace name. With no `github_account`, `gh` is used as it is logged in; with one, its token from `gh auth token --user` goes in that read's environment alone, never stored or logged, so the user's active login does not change. Where that token cannot be had, the read runs with no forge access rather than falling through to the active login, and the page names the account.
- **Collector**: for each project, runs the carried tool with `--json`, checks `schema_version`, and caches the document in memory. Documents are cached per workspace and project. It runs on a timer, one project at a time per workspace, so a refresh never waits on a read. The page's script asks only while the page is visible, and the timer stops five minutes after the last request, so a hidden tab costs nothing. A workspace is read again a minute after its last pass ends, and a request restarts a stopped timer. A read has a limit of 60 seconds, and passing it counts as a failure with that reason.
- **Server**: binds to `127.0.0.1` only. The default port is 8766, so a pinned tab keeps its address, and `--port` changes it. A port in use refuses to start with a clear message. `/<workspace>` is the overview, `/<workspace>/<project>` a project, and `/api/...` the cached documents with their read time. With one workspace, `/` is that workspace; with several, it lists them. A request with an unexpected `Host` is refused, so a web page cannot reach it by DNS rebinding. All document text is escaped on render, since `--json` gives it as the repository holds it.
- **Failure**: a project that cannot be read keeps its last document, marked with its age and the reason. A `schema_version` it does not know is stated, never guessed at. A project with no document yet shows that it is being read, and one whose reads have only failed shows the reason.
- **Degraded reads**: a read can succeed and still miss something. With `forge` other than `full`, a merged fix cannot be seen, so statuses may be wrong: the last full document stays on the page, with a notice of what could not be read and how old it is. Where no full document exists, the degraded one is shown with that notice and each `merge_unchecked` mark. Only with `forge` `full` does a read with `trunk.state` `fetch_failed`, or `remote_branches_read` false, replace the old document, with the page saying what it missed. A network outage gives all three at once, and the forge rule decides it: the last full document stays, and the notice lists everything missed.
- **Requirements**: at start the tool checks for `bash`, `git` and `awk` and refuses to run with a clear message where one is missing. `gh` stays optional, as `--json` allows.

<!-- /ai-toolkit:project-foundation -->

## Status

It does nothing useful yet: `npx dev-task-board --version` prints its version, and the board arrives through the workstream `see-my-projects-live`.

## Development

Run `npm ci` in every checkout, on a machine with `git`, `bash` and `awk`, and Node from `.nvmrc`. It installs the local hooks.

- `npm test`, `npm run typecheck`, `npm run build`
- `npx biome ci .`
- `npm run check:package`, which the gate runs on its own
