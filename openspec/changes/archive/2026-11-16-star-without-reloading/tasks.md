# Tasks

## 1. The page

- [x] 1.1 Add `happy-dom` as a dev dependency, and in `AGENTS.md`'s testing strategy say that the project page's script is tested by running it in `happy-dom` against markup the board renders (design decision 8); verify with `npm ci` and `npm run typecheck`.
- [x] 1.2 In `src/render.ts`, give each `details` on a project's page its `data-key` (design decision 4); verify with the derived tests for "A project's page reopens what was open" > "A task's key".
- [x] 1.3 In `src/server.ts`, give `projectPage` the stars as a function called as each part is drawn (design decision 7); verify with the derived tests for "A workstream shows its star" > "A star set while the page arrives".

## 2. The script

- [x] 2.1 Write `src/page-script.ts` with `pageScript(window)`: the star in the background and its fallback (design decision 3), remembering on `pagehide` and `dtbRestore` (decisions 5 and 6); embed it in the head of a project's page only, and call `dtbRestore()` after each part (decision 1); verify with the derived tests for "A star is set in place", "A project's page reopens what was open" and "A page shows what was read for it" > "Only a project's page has a script".

## 3. Record and release

- [x] 3.1 In `README.md`, revise "with no script" under Technology and "the page needs no script" under Architecture to say what the project page's script does and that the page works without it, and say under Status that a star is set in place and a reload reopens what was open; in `docs/workstreams/see-my-projects-live.md`, revise decision 1's "pages carry no script" the same way, dated 2026-11-16; verify by reading both against `design.md`.
- [x] 3.2 Raise the version from `0.14.0` to `0.15.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package` and `npm audit --audit-level=high`.

## 4. Confirm

- [x] 4.1 The operator merged #41 and ran 0.15.0: a star changed in place and a reload reopened what was open, but the reload jumped while it was read, and the read time sat a line below the name. #42 (0.15.1) moved the quick part's mark into the stamp and hid the stars form; #43 (0.15.2) shortened `pull requests not checked` to `not checked`, as the operator asked. The jump remained, because the quick part listed more tasks in work than the full read, and `hold-the-page-while-reading` took it up (#44, 0.16.0). On 2026-11-16 the operator ran 0.16.0, which carries this change's script and those fixes, and reported that everything worked.
