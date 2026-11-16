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
- Reading a project when its page is refreshed, showing what `git` gives first and the full read after, when the data was read, and saying plainly when a read failed. An overview shows what is held, at once.
- An overview of a workspace's projects, opening into each.
- A settings page in the board that adds and removes projects and workspaces, and one command to start it.

## Non-Goals

- **Editing tasks from the page.** Tasks change through the `backlog` skill. Considered and left until the read-only board has been used. A star on a workstream is not such an edit: it is the operator's view of the board, kept by the board on this machine, and changes nothing a repository holds.
- **Restating the workflow's rules.** Status, stage and placement come from `scripts/task-board`, never from this code.
- **A native desktop program.** A pinned browser tab gives the same.
- **Any hosted service, account or sync.** Nothing leaves the machine but the reads `git` and `gh` make.
- **Tracking projects found by scanning folders.** The settings page lists the git repositories in the projects folder to choose from, but only a project added is read, and a wrong path is an error.
- **Trackers outside the repository**, such as Jira, Linear or ClickUp.
- **Nested workstreams**, which the convention does not have.
- **Reading uncommitted work.** A later change may read working trees and sessions. The first version shows what `--json` reports.

## Technology

- **TypeScript on Node**.
- **Node's own `node:http`, with no web framework.** There are a handful of routes and no state beyond a cache and the stars, and a public tool installed by others is better with few dependencies.
- **Pages rendered on the server as HTML.** The accepted layout is plain markup with `<details>`. An overview carries no script; a project's page carries one small inline script that sets a star in place and keeps open blocks and the scroll position across a reload. It reads nothing, and the page works without it.
- **`smol-toml`** for the settings file, the one runtime dependency.
- **`scripts/task-board` carried as a pinned copy** at `vendor/task-board`, with its source commit in `vendor/task-board.source`, so nothing depends on where `ai-toolkit` sits on a disk. It stands alone, sourcing nothing, and runs through `bash`. Bumping it is a normal change, which `schema_version` guards.
- **Platforms**: Linux, WSL and macOS, where bash, git and awk are ordinary. Windows outside WSL is not supported.

## Architecture

- **Settings** at `~/.config/dev-task-board/config.toml`: `[workspaces.<name>]` with `projects`, a list of names in the projects folder (`group/project`) or paths, and an optional `github_account`; at the top, an optional `projects_dir`, `~/projects` by default, and an optional `port`. A missing file starts the board with no workspace, on its settings page. The page at `/settings` lists each workspace's projects and the git repositories in the projects folder, a child or a grandchild of it; each button saves the file whole, without its comments, and the board follows with no restart. A project's address is its directory's base name, and two of one name in a workspace are refused at start. `api` and `settings` are reserved as workspace names. With no `github_account`, `gh` is used as it is logged in; with one, its token from `gh auth token --user` goes in that read's environment alone, never stored or logged, so the user's active login does not change. Where that token cannot be had, the read runs with no access through `gh` rather than falling through to the active login, and the page names the account.
- **Collector**: for each project, runs the carried tool with `--json`, checks `schema_version`, and caches the document in memory, per workspace and project. A project's page reads that project in full, and the full read is cached; where the project holds no document yet, it also starts a quick read with `gh` unable to log in, shown in that response alone and never cached. An overview reads nothing and shows what is cached. A project has one read of each kind at a time, so a request during one waits for it, and a full read that ends first stops the quick one. Beyond one pass at start, nothing runs between requests, so a tab left open costs nothing. A read has a limit of 60 seconds, and passing it counts as a failure with that reason.
- **Server**: binds to `127.0.0.1` only. The default port is 8766, so a pinned tab keeps its address; `port` in the settings changes it, and `--port` over both. A port held by a dev-task-board of the same user, recognised by its process as `dist/cli.js` of a package named `dev-task-board`, is taken over: that board is sent `SIGTERM`, and the new one binds once the port is free, refusing after 10 seconds. A port held by anything else is never signalled: in a terminal the board offers the nearest free port above, and otherwise refuses, saying how to choose one. `/<workspace>` is the overview and `/<workspace>/<project>` a project, and `/api/` stays reserved. With one workspace, `/` is that workspace; with several, it lists them. A request with an unexpected `Host` is refused, so a web page cannot reach it by DNS rebinding, and so is one whose `Sec-Fetch-Site` is `cross-site` or `same-site`, so another site cannot start reads. A project's page is sent in parts as its reads end, each a `section` of class `phase`, and a CSS rule hides every part but the last, so showing the latest needs no script. The project's heading stays at the top of the window, over a fade into the page, with the read time level with its name, and each part drawn while the project is read carries an update mark in its read time. After each part, the page's script reopens the blocks that were open when the page was last left in that tab, kept in the tab's `sessionStorage` by what each block shows, and returns to where it was scrolled. Pages are sent with `Cache-Control: no-store`. The one request that changes anything is a `POST` to a project's address, from that page's star buttons: it needs `Sec-Fetch-Site: same-origin` and the board's own `Origin`, reads nothing, and is answered `303` back to the page at the workstream. All document text is escaped on render, since `--json` gives it as the repository holds it.
- **Stars**: in `$XDG_STATE_HOME/dev-task-board/stars.json`, `~/.local/state/dev-task-board/stars.json` by default, as `{"version": 1, "stars": {"<project path>": ["<workstream>", …]}}`, keyed by the project's resolved path, so a project in two workspaces shares its stars. Read at start, and written whole on each star through a file renamed over it, one at a time. A file that is not that shape refuses the start rather than being overwritten. It is read only at start, so edit it by hand with the board stopped.
- **Failure**: a project that cannot be read keeps its last document, marked with its age and the reason. A `schema_version` it does not know is stated, never guessed at. One whose reads have only failed shows the reason.
- **Degraded reads**: a read can succeed and still miss something. With `forge` other than `full`, a merged fix cannot be seen, so statuses may be wrong: the last full document stays on the page, with a notice of what could not be read and how old it is. Where no full document exists, the degraded one is shown with that notice and each `merge_unchecked` mark. Only with `forge` `full` does a read with `trunk.state` `fetch_failed`, or `remote_branches_read` false, replace the old document, with the page saying what it missed. A network outage gives all three at once, and the forge rule decides it: the last full document stays, and the notice lists everything missed.
- **Requirements**: at start the tool checks for `bash`, `git` and `awk` and refuses to run with a clear message where one is missing. `gh` stays optional, as `--json` allows.

<!-- /ai-toolkit:project-foundation -->

## Status

An overview answers at once from what the board holds. Refreshing a project's page reads it: the page shows at once what was last read, with an update mark saying it is being read again, and keeps it until the project's tasks as they stand once GitHub has been read replace it. Where nothing has been read, it says the project is being read, then shows what `git` gives within seconds, marked as such, and then the full read. A read that fails or misses something leaves the last document in place where Architecture says so, and the page says what is kept and what was missed.

Each workstream has a star, ☆, beside its name. Pressing it stars the workstream, ★, in place: the page does not reload, scroll or re-sort, and the starred workstream comes first in its section the next time the page is loaded; pressing it again clears it. Reloading a project's page reopens the blocks that were open and returns to where it was scrolled. Stars are kept on this machine across refreshes, restarts and upgrades.

The settings page sets the board up and changes its projects from the browser: projects are named in one projects folder, offered from the repositories found there, and each change is saved at once with no restart.

## Running it

Run `npx dev-task-board`, and open the address it prints. With no settings yet, it opens on its settings page, `http://127.0.0.1:8766/settings`: add a workspace, then add its projects from the git repositories it finds in `~/projects`, or by name. A project is named by its path in that folder, such as `shatynska/dev-task-board`, so one repository can be in two workspaces. Each button saves at once, and the board follows with no restart. Every page links to the settings.

The page writes `~/.config/dev-task-board/config.toml`, or the same under `$XDG_CONFIG_HOME`, which can also be written by hand:

```toml
projects_dir = "~/projects"

[workspaces.work]
projects = ["group/one", "group/two"]

[workspaces.other]
projects = ["three"]
github_account = "another-login"
```

Workspaces show as tabs. `projects_dir` is optional, `~/projects` where absent, and a project may also be an absolute path or one beginning `~/`. `github_account` is optional, and names a login `gh auth login` already holds: that workspace's reads use it through `gh`, and the active login does not change. `git fetch` is not `gh`, so a remote over SSH still uses your keys. Saving from the page rewrites the file without its comments. From 0.17.0 a workspace may not be named `settings`, the page's address.

The board's address is `http://127.0.0.1:8766`. `--port` takes another, from 1024, as does `port = <n>` at the top of the settings. Running a newer version while an older board still runs replaces the older one. Where another program holds the port, the board asks whether to start on the next free one, and says what `port = <n>` to add so that it is not asked again.

## Development

Run `npm ci` in every checkout, on a machine with `git`, `bash` and `awk`, and Node from `.nvmrc`. It installs the local hooks.

- `npm test`, `npm run typecheck`, `npm run build`
- `npx biome ci .`
- `npm run check:package`, which the gate runs on its own
