## 1. Reads

- [x] 1.1 Add the quick read to `src/reads.ts`, shared per project, never settled, stopped when the full read beside it ends first, with no quick read at start, and stop the overview's read in `src/server.ts`; revise the existing tests that assert an overview reads its projects, which this change replaces, and verify the derived tests of `project-reads` pass

## 2. Pages

- [x] 2.1 Send a project's page in parts from `src/server.ts`, with the parts drawn in `src/render.ts` and the rule in `src/style.ts`, and the overview drawn from what is held; revise the existing tests that assert a project's page answers only after its read in one piece, and verify the derived tests of `board-pages` pass
- [x] 2.2 Run the built board on `commerce-ops` and record, as a one-off manual check, when each part arrives, and that in a browser the being-read, quick and full parts each become visible in turn, with only the latest shown

## 3. Finishing

- [x] 3.1 Revise `README.md`'s Scope, its Architecture's Collector and Server, and its Status, add this step to `docs/workstreams/see-my-projects-live.md` before `write-the-settings` and revise its decision 1, raise the version to `0.6.0` in `package.json` and `package-lock.json`, and verify `npm run check:package`
- [x] 3.2 Run `npm test`, `npm run typecheck`, `npx biome ci .`, `npm run build` and `npm audit --audit-level=high`, and verify all pass

## Manual check

Task 2.2, 2026-11-03, the built board on `commerce-ops` and `infrastructure` with `github_account` `shatynska`, and `ai-toolkit` with none, read by `curl` and by a client timing each part. An overview answered in under 2 ms, both right after start and after the pass at start. A page of `commerce-ops` sent its being-read part at once, the part read from `git` alone at 4.2 and 5.4 seconds, and the full part at 9.6 and 10.3 seconds, in two runs, the last with no notice. That a browser draws each part in turn, with only the latest seen, is left to the operator's confirmation.

## Obsolete tests

Six existing tests asserted what this change replaces, and are removed: `tests/refresh-server.test.ts`'s `answers an overview once its workspace's reads are done`, `reads the workspace for / with one workspace` and `A read past its limit` for `/work/one` and `/work`, and `tests/refresh-board.test.ts`'s `answers another project's page and the list without waiting` and `Two requests during one read`. The derived tests in `tests/open-pages-at-once.test.ts` hold each scenario as it now stands. The other candidates the test plan lists still pass, since they call `refresh` directly, which is unchanged, and are kept.

## Test arrangement

Every local entry the test plan lists is kept local, for the backlog entry `share-the-test-arrangement`, which moves them with their near-misses in one change.

**Confirmed** by the operator on 2026-11-03, on the board built from `main` at `3202a5f` and run as their `systemd` user service, with the workspaces `fuperia` and `shatynska`: «працює». The checks proposed were an overview opening at once, and on `commerce-ops` the being-read part, then the part read from `git` alone, then the full part, with one shown at a time. Which of them were looked at was not reported, so that a browser drew each part in turn is unrecorded rather than observed; the timings above are what observed the parts arriving. `dev-task-board` is not yet on npm, so this was run from the clone and not as `npx dev-task-board@0.6.0`.
