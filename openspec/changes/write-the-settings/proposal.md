# Proposal

## Why

Setting the board up means writing `config.toml` by hand: TOML tables, full paths, and a restart after each edit. The workstream `see-my-projects-live` has held a step for a setup command since it opened. On 2026-11-16 the operator chose a page in the board itself over a terminal command, since the board is kept open in a tab anyway, and decided how projects are named: everything is within one projects folder, `~/projects` by default, and a project is named by its path inside it, as `shatynska/dev-task-board`, so that one repository can sit in two workspaces and a workspace need not be a folder. They asked that the page list the repositories it finds there, to add with a press, the name written with its prefix. Before choosing the page, the operator had chosen that a board with no settings file say how to set up; with a page, that becomes starting the board empty, printing the settings page's address and sending `/` there, since the page needs a running board.

- **Workstream**: `see-my-projects-live`, step `write-the-settings`, whose "the setup command" this change makes a settings page.

## What Changes

- Settings gain an optional top-level `projects_dir`, `~/projects` where absent. A project may be written as a name relative to it, `shatynska/dev-task-board`; absolute paths and paths beginning `~/` still work. A workspace may list no projects, and a file may name no workspace.
- With no settings file, the board starts with no workspaces instead of refusing, and its address opens the settings page. A file that cannot be read still refuses the start, so that nothing overwrites it.
- A settings page at `/settings`, linked from every page, with no script: the projects folder; each workspace with its projects, each with a button to remove it; the git repositories in the projects folder not yet in that workspace, each with a button to add it, and a field to add one by name; a form to add a workspace, and a button to remove one.
- Pressing a button saves the settings at once: the board checks the result as it checks the file at start, writes the file whole, and its workspaces and reads follow without a restart. A change it refuses leaves the file as it was and says why. Comments in the file are not kept, and the page says so.
- `settings` becomes a reserved workspace name, beside `api`; a file naming a workspace `settings` is refused from this version, and `README.md` says so.
- `README.md` (Scope, Non-Goals, Architecture, Running it) and the workstream say so; the version rises from `0.16.0` to `0.17.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `settings`: "Settings name workspaces and their projects" adds `projects_dir` and names relative to it, and allows a workspace with no projects; "Bad settings refuse the start" no longer refuses a missing file, no workspace or an empty `projects`, and reserves `settings`. Added "No settings file starts the board empty".
- `board-pages`: added "The settings page", "The settings page finds repositories", "Saving the settings", "A save is checked", "A save returns to its workspace" and "A save that cannot be written"; "Addresses reach workspaces and projects" adds `/settings`, "Document text is escaped" covers what the page finds and a save's answers, and "Several workspaces show as tabs" lets the list of workspaces link to the page.
- `project-reads`: added "Reads follow saved settings" and "A save meets the pass at start"; "Each project is read at start and when requested" lets a save read the projects it adds.

## Impact

- Changed: `src/settings.ts` (reading the new forms, and writing), `src/reads.ts` (following new workspaces), `src/server.ts` (the page's routes), `src/render.ts`, `src/style.ts`, `src/board.ts` (starting with no file), their tests, `README.md`, `docs/workstreams/see-my-projects-live.md`, `package.json`, `package-lock.json`.
- Not in scope, left for a later change: editing a workspace's `github_account`, `projects_dir` or `port` from the page, and renaming a workspace; they stay editable in the file.
