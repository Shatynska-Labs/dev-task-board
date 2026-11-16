# Tasks

## 1. The reads

- [x] 1.1 In `src/server.ts`, start the quick read and draw its part only where the project held no read document when the page was requested (design decision 1); verify with the derived tests for "A project's page shows each read as it arrives" and "A project's page starts a quick read beside the full one".

## 2. The page

- [x] 2.1 In `src/render.ts`, give the held, quick and nothing-held parts their stamps with the update mark, and the last part its stamp without one (design decision 2); verify with the derived tests for "A page being read says so" and "The first part shows what is held".
- [ ] 2.2 In `src/style.ts`, hold the project's heading at the top with its fade, place the stamp level with the name at the right, turn the mark and stop it under reduced motion (design decisions 3 and 4); verify with the derived tests for "A project's page shows its document" and "A page being read says so", and against the running board at a wide window and at 320px, with and without tabs.

## 3. Record and release

- [x] 3.1 In `README.md`, say under Architecture and Status that a page holding a document shows it until the full read settles, with an update mark, and reads `git` alone only where nothing was held; in `docs/workstreams/see-my-projects-live.md`, add this change as step 9, before `write-the-settings`, and revise decision 1's account of the parts the same way, dated 2026-11-16; verify by reading both against `design.md`.
- [ ] 3.2 Raise the version from `0.15.2` to `0.16.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package` and `npm audit --audit-level=high`.
