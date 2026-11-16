# Tasks

## 1. Settings

- [ ] 1.1 In `src/settings.ts`, read `projects_dir` and names relative to it, allow empty workspaces and no workspace, reserve `settings`, and read a missing file as empty settings (design decisions 1, 2 and 7); verify with the derived tests for `settings`.
- [ ] 1.2 In `src/settings.ts`, apply one action to the file's table and write the result whole, read back as at start, one save at a time (design decision 5); verify with the derived tests for "Saving the settings".

## 2. Reads and server

- [ ] 2.1 In `src/reads.ts`, add `replace(workspaces)` (design decision 6); verify with the derived tests for "Reads follow saved settings".
- [ ] 2.2 In `src/server.ts` and `src/board.ts`, start with no settings file, answer `/` with `303` to `/settings` where there is no workspace, serve `GET /settings` and `POST /settings`, and replace the board's workspaces after a save (design decisions 2, 5 and 6); verify with the derived tests for "No settings file starts the board empty", "The settings page" and "Saving the settings".

## 3. The page

- [ ] 3.1 In `src/render.ts` and `src/style.ts`, render the settings page and its refusal, list the repositories found (design decisions 3 and 4), and link it from every page; verify with the derived tests for "The settings page", and by hand against the running board with the operator's projects folder.

## 4. Record and release

- [ ] 4.1 In `README.md`, revise Scope's setup command, Non-Goals' scanning of folders, Architecture's settings and Running it for the page and `projects_dir`, and that a workspace named `settings` is refused from 0.17.0; in `docs/workstreams/see-my-projects-live.md`, revise step 10 to the settings page; verify by reading both against `design.md`.
- [ ] 4.2 Raise the version from `0.16.0` to `0.17.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package` and `npm audit --audit-level=high`.
