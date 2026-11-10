# Proposal

## Why

The "Other workstreams" section lists workstreams in the order the document gives them, which the carried tool sorts by file name. The operator asked on 2026-11-10 that they be ordered by the last commit among their tasks instead, so the workstream touched most recently is found first.

- **Workstream**: this change advances none.

## What Changes

- On a project's page, the workstreams under "Other workstreams" are ordered by the greatest `last_commit` (Unix seconds) among the workstream's tasks, newest first. A workstream's tasks are the tasks its steps name and the tasks shown in it as unplaced.
- A workstream none of whose tasks has a `last_commit` (absent or `null`) comes after every workstream that has one. Workstreams with equal latest commits, including those with none, are ordered by name in code-unit order, as the document orders names.
- "Active workstreams" keep the document's order; the operator asked about "Other workstreams" only.
- The version rises from `0.9.0` to `0.10.0`, since the pages change visibly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: other workstreams are ordered by their latest commit.

## Impact

- Changed: `src/render.ts`, its tests, `package.json`, `package-lock.json`.
- The carried tool, reading, caching and the document's schema are unchanged: the order is computed from the tasks' `last_commit`, which the document already carries.
