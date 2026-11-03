## 1. Page

- [x] 1.1 Draw the time of the read alone in `src/render.ts`, and place it on the heading's line below the tabs in `src/style.ts`; remove what asserts `written_at` is shown, which this change replaces: the test `shows the document's written_at` in `tests/render.test.ts`, and the `written_at` assertion of `keeps the sections in order, with the written and read times` in `tests/refresh-render.test.ts`, whose other assertions stay and whose title becomes `keeps the sections in order, with the read time`, and verify the derived tests of `board-pages` pass

## 2. Finishing

- [x] 2.1 Raise the version to `0.7.0` in `package.json` and `package-lock.json`, and run `npm test`, `npm run typecheck`, `npx biome ci .`, `npm run build`, `npm run check:package` and `npm audit --audit-level=high`, and verify all pass

**Obsolete tests**: `shows the document's written_at` in `tests/render.test.ts` is removed, and the `written_at` assertion of the test now titled `keeps the sections in order, with the read time` in `tests/refresh-render.test.ts`, as task 1.1 names.

**Test arrangement**: the local helpers of `tests/read-time-only.test.ts` are kept local, for the backlog entry `share-the-test-arrangement`.
