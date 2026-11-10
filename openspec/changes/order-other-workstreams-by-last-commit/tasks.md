# Tasks

## 1. Order

- [x] 1.1 In `src/render.ts`, sort the inactive workstreams before rendering them: by the greatest `last_commit` over the tasks of the workstream's steps and its unplaced tasks, newest first, an absent or `null` value counting as none, a workstream with none after those with one, ties by name in code-unit order; leave active workstreams in the document's order; verify with the derived tests for "Other workstreams are ordered by their latest commit".

## 2. Release

- [x] 2.1 Raise the version from `0.9.0` to `0.10.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.
