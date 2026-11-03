## Why

A project's page shows when it was read, when the tool wrote its document, and the trunk's ref and commit. The tool writes the document at the end of the run whose result is the read, so the two times differ by moments, and the operator does not compare commits on the board. `move-the-read-time-aside` put the three in the top corner, where they cross the tabs' line, and the operator did not like it.

- **Workstream**: `see-my-projects-live`, whose goal of a tab kept open this serves; it is not among its steps, which this change does not edit, and is placed there at its archive.

## What Changes

- A project's page shows only the time of its read, as `Read 2026-11-03 14:15:28 UTC`, right-aligned on the line of the project's name, below the tabs' line.
- It no longer shows `written_at`, nor the trunk's ref and commit.
- The version rises to `0.7.0`, since a stated requirement changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: a project's page shows the time of its read alone.

## Impact

- Changed: `src/render.ts`, `src/style.ts`, `tests/render.test.ts`, `tests/refresh-render.test.ts`, `package.json`, `package-lock.json`.
- `written_at` still dates a task's last commit, as now. The document is unchanged.
