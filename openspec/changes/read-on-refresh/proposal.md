## Why

The board reads each project once, at start, so a restart is the only way to see anything newer. Refreshing a page should be enough: the operator wants fresh data on asking, and has no need of a page that updates itself or of reads running in between. The operator chose this on 2026-11-02 over the planned timer and page script.

- **Workstream**: `see-my-projects-live`, of which this is the third step, replacing `keep-the-page-current`. Its Goal and Done when are revised with this plan.

## What Changes

- A request for a project's page reads that project, and a request for a workspace's overview reads its projects in parallel, and each answers once its reads have finished.
- A request for a project already being read waits for that read rather than starting another.
- Nothing is read between requests, beyond the one pass at start.
- Overview rows and project pages show when each project was read.
- Pages are sent so that the browser does not reuse them, and a request from another site is refused, since a request now starts work.
- `README.md` stops promising a timer, a page script and `/api/...` documents. `/api/` stays reserved.
- The version rises to `0.3.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-reads`: a project is read when its page is requested, not only at start.
- `board-pages`: pages answer with fresh reads, show the read time, and are not cached.

## Impact

- Changed: `src/reads.ts`, `src/server.ts`, `src/render.ts`, the tests task 3.2 names, `README.md`, `docs/workstreams/see-my-projects-live.md`, `package.json`, `package-lock.json`.
- No dependency is added.
- Not here: keeping a project's last document through a failed read, ages and degraded reads (`say-what-a-read-missed`), tabs (`switch-between-workspaces`).
