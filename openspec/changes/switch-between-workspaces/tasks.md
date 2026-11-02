## 1. Settings

- [ ] 1.1 Accept `github_account` in `src/settings.ts`, refuse one that is not a non-empty string, keeping the check ahead of the one on `projects`, remove the test in `tests/settings.test.ts` that asserts it is not yet supported, which this change replaces, change the case `a github account` in `tests/board.test.ts` to `github_account = ""` so that it still covers a refused account, and verify the derived tests of `settings` pass

## 2. Reads

- [ ] 2.1 Take the account's token per read in `src/reads.ts`, held in `running` and within the read's limit, and run the tool with the environment the design names, and verify the derived tests of `project-reads` pass, and record in this task, as a one-off manual check, since the suite stubs `gh`, that a real `gh` under the no-token environment cannot use a login
- [ ] 2.2 Set `no_token_for` on the document of a read with no token, add its line to `whatMissed`, begin a failed no-token read's reason with the account, and verify a kept document's notice names the account

## 3. Pages

- [ ] 3.1 Draw the tabs in `src/render.ts` and `src/style.ts`, pass the workspaces from `src/server.ts`, and verify the derived tests of `board-pages` pass

## 4. Finishing

- [ ] 4.1 Raise the version to `0.5.0` in `package.json` and `package-lock.json`, stop `README.md`'s Status saying `github_account` is refused, show the field in Running it, change Architecture's "no forge access" to "no access through `gh`", and verify `npm run check:package`
- [ ] 4.2 Run `npm test`, `npm run typecheck`, `npx biome ci .`, `npm run build` and `npm audit --audit-level=high`, and verify all pass
