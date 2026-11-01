## Why

The package answers only `--version`, so nothing yet shows a project's tasks. This step gives a first useful board: settings naming projects, one command to start, and pages showing what `scripts/task-board --json` reports.

- **Workstream**: `see-my-projects-live`, of which this is the second step.

## What Changes

- `dev-task-board` with no arguments starts the board, on `127.0.0.1` port 8766, or the port `--port` gives. `--version` stays.
- Settings are read from `config.toml` under `$XDG_CONFIG_HOME/dev-task-board`, or `~/.config/dev-task-board` where that is unset or empty.
- Each project is read once at start, in the background, with the carried tool.
- A workspace's overview, and a page for each project, rendered on the server.
- `smol-toml`, the first runtime dependency.
- `@types/node` goes back to 24, the Node the project runs on.

The command that refused every other invocation now starts the board, so the `package` capability's refusal requirement changes.

## Capabilities

### New Capabilities

- `settings`: reading and refusing the settings file.
- `project-reads`: reading a project with the carried tool.
- `board-pages`: the server and what its pages show.

### Modified Capabilities

- `package`: the command starts the board with no arguments.

## Impact

- New: `src/` modules and their tests.
- Changed: `tests/cli.test.ts`, which held the refusal this replaces; `.github/dependabot.yml`; `README.md`.
- `package.json`: a runtime dependency, and the version rises to `0.2.0`, which the release workflow publishes once the trusted publisher exists.
- Not here: refreshing (`keep-the-page-current`), keeping a last document (`say-what-a-read-missed`), tabs and `github_account` (`switch-between-workspaces`), the setup command (`write-the-settings`).
