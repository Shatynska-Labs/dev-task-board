# Design

## Context

See `proposal.md` for why. `src/settings.ts` reads `config.toml` at start (`readSettings`, `parseSettings`) into workspaces of projects `{ name, path }`, refusing anything wrong with a `SettingsError`; `src/board.ts` refuses the start on one. `createReads` in `src/reads.ts` closes over the workspaces it was given, holding a state per workspace and project. `src/server.ts` routes `GET` to the index, an overview or a project's page, and a `POST` to a project's address sets a star, after checking `Sec-Fetch-Site`, `Origin`, the body's size and its one field, and answers `303`. Stars are written whole through a file beside the target and a rename, one at a time (`src/stars.ts`).

## Goals / Non-Goals

**Goals**: set the board up and change its projects from the page, with no restart and no hand-written paths; keep every file that works today working, but one naming a workspace `settings` (decision 7).

**Non-Goals**:

- Editing `github_account`, `projects_dir` or `port`, or renaming a workspace, from the page: rarer, and each a field with its own checks; they stay in the file.
- Tracking a repository without being asked: the page lists what it finds, and only what is added is read.
- Keeping the file's comments and layout through a save.

## Decisions

**1. One projects folder, and names relative to it.** A top-level `projects_dir`, absolute or beginning `~/`, `~/projects` where absent. A project written without a leading `/` or `~/` is a name relative to it, `shatynska/dev-task-board`; one holding an empty, `.` or `..` segment is refused, so a name stays inside the folder. Absolute paths and `~/` paths are read as today, so the operator's file keeps working unchanged. A project's address stays its base name, and two of one base name in a workspace are still refused; the same name in two workspaces is allowed, as today. The folder must be a directory only where a name uses it.

**2. Empty is allowed.** A workspace may list no projects, and a file may name no workspace, since the page builds settings up one press at a time. A missing file is read as no workspaces and no other key, and the board starts: its address answers `/` with `303` to `/settings`, and the start prints that address. A file that exists but cannot be read still refuses the start, so the page never saves over what it could not read.

**3. What the page finds.** Each request for `/settings` lists the git repositories in the projects folder: its child and grandchild directories holding `.git`, a directory or a file, skipping names beginning `.` and `node_modules`, and not looking inside a directory found to be a repository. They are listed by their name relative to the folder, sorted, and each workspace shows those it does not already hold, compared by resolved path. A folder that is missing or unreadable lists nothing, and the page says so. Two levels cover `~/projects/<name>` and `~/projects/<group>/<name>`, the operator's layout, at the cost of a few directory reads per request.

**4. The page.** `/settings`, with no script and the board's style: the projects folder; a section per workspace, `id` `workspace-<name>`, listing its projects as written, each with a `Remove` button, then the repositories not in it, each with an `Add` button, then a field to add a project by name; a `Remove workspace` button only on a workspace with no projects, so that removing one never drops a list or an account by one press; a field to add a workspace; and the note that saving rewrites the file without its comments. Every page links to it: at the end of the tabs, or beside the workspace's link where there are no tabs, and on the index.

**5. Saving.** Each button is a form posting to `/settings` with exactly one action: `workspace` and `add` (a project's name or path), `workspace` and `remove` (a project as written), `add_workspace`, or `remove_workspace`. The checks are the stars': `Sec-Fetch-Site` `same-origin` and `Origin` the board's own, else `403`; a body of at most 4096 bytes, else `413`; exactly one action's fields, else `400`. The file is read again (missing as empty), the action applied to its table — other keys, `port`, `projects_dir`, `github_account` and any it does not know, kept as read — and the result written out with `smol-toml` and read back through `parseSettings`, as at start. A `SettingsError`, an action naming a workspace the file does not hold (or, for `add_workspace`, one it does), an `add` already in the workspace, a `remove` it does not hold, or a `remove_workspace` of a workspace holding projects answers `400` with a page naming the fault, escaped, and a link back, the file untouched. A file that exists but cannot be read, or a write that fails, answers `500` the same way, and the board's workspaces are replaced only after the rename succeeds. Where `config.toml` is a symbolic link, the link is resolved and the file written beside its target, so a link kept by a dotfiles manager stays one. Otherwise the text is written to a file beside `config.toml`, creating the directory, and renamed over it, and the answer is `303` to `/settings#workspace-<name>`, the name percent-encoded as in the section's `id`, or to `/settings` after `remove_workspace`. Saves are applied one at a time, each reading the file the one before wrote.

**6. The board follows.** After a save, the board's workspaces become the saved ones: the server's state is replaced, and `reads.replace(workspaces)` keeps the state of each project still named in the same workspace with the same path, drops the rest and stops their reads, sets each new project to being read and reads it as the pass at start would. A read that ends is held only where its workspace still names that project with the same path, so a late read of a dropped project, or of an old path under a name re-added, is not held. The pass at start reads each workspace's projects from the current list as it goes, so a project removed before its turn is never read; the projects a save adds are read one at a time per workspace. Stars are untouched: a star of a removed project waits in the stars file for its return.

**7. `settings` is reserved.** A workspace named `settings` would take the page's address, so it is refused as `api` is.

## Risks / Trade-offs

- **Comments are lost** on the first save; the page says so beside its forms. Keeping them would need a TOML editor that preserves layout, which the one dependency does not offer.
- **A file edited by hand while the board runs** is read again by each save, so the save keeps the hand edit; but the board itself follows the file only on a save or a restart, as today.
- **A press with no confirmation** removes a project; adding it back is one press, and its stars wait for it. A workspace is removable only when empty.
- **Listing on each request** reads up to two levels of the projects folder; a folder of thousands of directories would make the page slower, which the operator's does not.
