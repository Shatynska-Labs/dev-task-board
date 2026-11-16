# Tasks

## 1. The page

- [ ] 1.1 Add `happy-dom` as a dev dependency, and in `AGENTS.md`'s testing strategy say that the project page's script is tested by running it in `happy-dom` against markup the board renders (design decision 8); verify with `npm ci` and `npm run typecheck`.
- [ ] 1.2 In `src/render.ts`, give each `details` on a project's page its `data-key` (design decision 4); verify with the derived tests for "A project's page reopens what was open" > "A task's key".
- [ ] 1.3 In `src/server.ts`, give `projectPage` the stars as a function called as each part is drawn (design decision 7); verify with the derived tests for "A workstream shows its star" > "A star set while the page arrives".

## 2. The script

- [ ] 2.1 Write `src/page-script.ts` with `pageScript(window)`: the star in the background and its fallback (design decision 3), remembering on `pagehide` and `dtbRestore` (decisions 5 and 6); embed it in the head of a project's page only, and call `dtbRestore()` after each part (decision 1); verify with the derived tests for "A star is set in place", "A project's page reopens what was open" and "A page shows what was read for it" > "Only a project's page has a script".

## 3. Record and release

- [ ] 3.1 In `README.md`, revise "with no script" under Technology and "the page needs no script" under Architecture to say what the project page's script does and that the page works without it, and say under Status that a star is set in place and a reload reopens what was open; in `docs/workstreams/see-my-projects-live.md`, revise decision 1's "pages carry no script" the same way, dated 2026-11-16; verify by reading both against `design.md`.
- [ ] 3.2 Raise the version from `0.14.0` to `0.15.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package` and `npm audit --audit-level=high`.
