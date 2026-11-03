## Why

Opening a workspace's overview reads every project in it, so a page used to switch between repositories takes as long as the slowest read, 10 to 15 seconds for `commerce-ops`. A project's page shows nothing until its read ends. Measured on `commerce-ops`, the carried tool takes about 4 seconds with `gh` unable to log in and 10 to 15 with it, so most of the wait is the forge, and what `git` alone gives is ready well before.

- **Workstream**: `see-my-projects-live`, as a new step before `write-the-settings`.

## What Changes

- A workspace's overview starts no read. It answers at once, listing its projects with what the board already holds for each: counts and the time of the read, being read, or the reason a read failed.
- A project's page answers at once with its heading and that it is being read. It starts two reads of the project together: a quick one with `gh` unable to log in, and the full one as today.
- When the quick read ends first, its document appears on the page, marked as read from `git` alone, with GitHub still being read, so statuses may be wrong. When the full read ends, its result appears in place of what was shown, in the same response.
- Only the full read changes what a project holds. The quick read's document is shown in that response and never kept.
- The page stays without script: the server sends the page in parts, and a CSS rule hides each part once a later one has arrived.
- The pass at start is unchanged.
- `README.md`'s Architecture and Status say this, and the version rises to `0.6.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-reads`: an overview reads nothing, and a project's page starts a quick read beside the full one.
- `board-pages`: an overview answers from what is held, and a project's page shows each read as it arrives.

## Impact

- Changed: `src/reads.ts`, `src/server.ts`, `src/render.ts`, `src/style.ts`, their tests, `README.md`, `docs/workstreams/see-my-projects-live.md`, `package.json`, `package-lock.json`.
- No dependency is added, and the carried tool does not change.
- Opening a project's page runs the tool twice, so `git fetch` can run twice at once in one repository.
- Not here: the setup command (`write-the-settings`), showing a held document before the reads, and any page script.
