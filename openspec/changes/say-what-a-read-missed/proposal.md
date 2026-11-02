## Why

A read that fails today replaces what the page showed with a reason, and a read that reaches the forge only partly replaces a good document with one whose statuses may be wrong. So a network outage, which is when nothing can be checked any other way, takes the picture away. `README.md`'s Architecture already says what should happen, under Failure and Degraded reads, and its Status says the code does not do it yet.

- **Workstream**: `see-my-projects-live`, of which this is the fourth step.

## What Changes

- A project that cannot be read keeps the document it holds, marked with its age and the reason. One that has no document shows the reason, as now.
- A read with `forge` other than `full` does not replace a document whose `forge` is `full`. That document stays, with a notice of how old it is and what the latest read could not read.
- Where no such document exists, the latest degraded one is shown with what it missed.
- A read with `forge` `full` always replaces the document, and the page says what it missed where `trunk.state` is not `fetched` or `remote_branches_read` is false.
- A `schema_version` the board does not know is a failed read like any other: it keeps the last document, and the reason states the version.
- Overview rows and project pages say all of this.
- `README.md`'s Status stops saying this is outstanding.
- The version rises to `0.4.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-reads`: a read that fails, or misses the forge, no longer replaces a better document.
- `board-pages`: pages say what is kept, how old it is, and what the latest read missed.

## Impact

- Changed: `src/reads.ts`, `src/render.ts`, tests of both, `README.md`, `package.json`, `package-lock.json`.
- No dependency is added, and the carried tool does not change.
- Documents stay in memory, so a restart still forgets them.
- Not here: tabs and `github_account` (`switch-between-workspaces`), the setup command (`write-the-settings`).
