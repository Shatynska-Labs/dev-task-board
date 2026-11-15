# Proposal

## Why

Everything the board shows is read from Git, so it has no way to say which workstreams the operator considers a priority. The operator asked on 2026-11-13 to mark workstreams with a star from the page, and for the marks to survive refreshes, restarts and upgrades of the package. A star is the operator's own view of the board, not a fact about the project, so it is kept on this machine and never written to a repository.

- **Workstream**: this change advances none.

## What Changes

- Each workstream on a project's page carries a star button in its summary: ☆ when not starred, ★ when starred. Pressing it stars or unstars that workstream, and the page reloads at that workstream.
- Only the part of a project's page left shown carries workstream ids. Today the quick part carries them too, so a link to a workstream, such as an in-work row's, lands in the part that is later hidden.
- Starred workstreams come first within their own section, "Active workstreams" or "Other workstreams", ahead of the existing order by latest commit, which still orders the starred among themselves and the rest among themselves.
- Stars are kept in `$XDG_STATE_HOME/dev-task-board/stars.json`, `~/.local/state/dev-task-board/stars.json` by default, keyed by the project's resolved path and the workstream's name, so a project listed in several workspaces shares its stars. The file is read at start, written on each change, and survives package upgrades.
- The server takes its first request that changes anything: `POST /<workspace>/<project>` with a form body naming the workstream to star or unstar, answered `303 See Other` to the project's page. It is refused unless its `Origin` is the board's own and its `Sec-Fetch-Site` is `same-origin`, so another site cannot change stars.
- A stars file that is not valid refuses the start with a message naming it, rather than being overwritten. A star that cannot be saved is answered with a page saying so, and the stars held do not change.
- `README.md` records the decision: a star is a view preference held by the board, not an edit of a task, so the Non-Goal "Editing tasks from the page" stands. Technology and Architecture name the stars file and the one write route.
- The version rises from `0.11.0` to `0.12.0`, since the pages change visibly.

## Capabilities

### New Capabilities

- `workstream-stars`: where stars are kept, how the page changes them, and how such a request is guarded.

### Modified Capabilities

- `board-pages`: workstreams are ordered with the starred first, and each shows its star; only the part left shown carries workstream ids, so links and the address after a star reach it; the address requirement admits the `POST` to a project's address.

## Impact

- New: `src/stars.ts` and its tests.
- Changed: `src/server.ts`, `src/render.ts`, `src/style.ts`, `src/board.ts`, their tests, `README.md`, `package.json`, `package-lock.json`.
- The carried tool, reading, caching and the document's schema are unchanged. Nothing is written to a project's repository.
