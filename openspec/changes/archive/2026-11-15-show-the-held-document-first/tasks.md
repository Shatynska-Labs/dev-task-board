# Tasks

## 1. The first part

- [x] 1.1 In `src/render.ts`, give `projectPageStart` the held state and starred set; where the state is a held document, render its part with `Shown as read <time>; being read again.`, its notices, and the document with stars and no workstream ids; otherwise keep `This project is being read.`. In `src/server.ts`, take `reads.get` before starting the reads and pass it. Verify with the derived tests for "A project's page shows each read as it arrives" and "The first part shows what is held".

## 2. Record and release

- [x] 2.1 In `README.md`, say under Status that a project's page shows what was last read while it is read again; verify by reading it against `design.md`.
- [x] 2.2 Raise the version from `0.13.0` to `0.14.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.

## 3. Confirm

- [x] 3.1 The operator merged #38, approved 0.14.0 on npmjs.com and ran it: on 2026-11-15 they reported that pressing a star no longer blanks the page ("вже краще") and confirmed the change for archiving. They also reported that the page still reloads, scrolls to the top, closes the open workstream block and reorders it, which this change did not aim to fix and `star-without-reloading` takes up.
