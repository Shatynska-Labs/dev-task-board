## 1. Settings

- [x] 1.1 Accept `github_account` in `src/settings.ts`, refuse one that is not a non-empty string, keeping the check ahead of the one on `projects`, remove the test in `tests/settings.test.ts` that asserts it is not yet supported, which this change replaces, change the case `a github account` in `tests/board.test.ts` to `github_account = ""` so that it still covers a refused account, and verify the derived tests of `settings` pass

## 2. Reads

- [x] 2.1 Take the account's token per read in `src/reads.ts`, held in `running` and within the read's limit, and run the tool with the environment the design names, and verify the derived tests of `project-reads` pass, and record in this task, as a one-off manual check, since the suite stubs `gh`, that a real `gh` under the no-token environment cannot use a login
- [x] 2.2 Set `no_token_for` on the document of a read with no token, add its line to `whatMissed`, begin a failed no-token read's reason with the account, and verify a kept document's notice names the account

## 3. Pages

- [x] 3.1 Draw the tabs in `src/render.ts` and `src/style.ts`, pass the workspaces from `src/server.ts`, and verify the derived tests of `board-pages` pass

## 4. Finishing

- [x] 4.1 Raise the version to `0.5.0` in `package.json` and `package-lock.json`, stop `README.md`'s Status saying `github_account` is refused, show the field in Running it, change Architecture's "no forge access" to "no access through `gh`", and verify `npm run check:package`
- [x] 4.2 Run `npm test`, `npm run typecheck`, `npx biome ci .`, `npm run build` and `npm audit --audit-level=high`, and verify all pass

## Manual check

Task 2.1, against `gh` 2.92.0 and the built board on `ai-toolkit` and `dev-task-board`, with a stray `GH_TOKEN` in the board's environment. A workspace naming a held login read `forge` `full`. One naming a login `gh` does not hold showed the account and that statuses may be wrong, with no fall-through. One with no account read with the stray token, as its environment gave it. `GH_CONFIG_DIR=/dev/null/gh gh api user` exits 1. No token appeared in a page or the board's output. `gh` reads `XDG_CONFIG_HOME` as well, so a run pointing that at another directory has no logins unless `GH_CONFIG_DIR` says where they are.
