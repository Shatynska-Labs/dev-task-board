## 1. Settings

- [x] 1.1 Add `smol-toml`, write `src/settings.ts`, and verify the module's derived tests of `settings` pass

## 2. Reads

- [x] 2.1 Write `src/reads.ts` and verify the module's derived tests of `project-reads` pass, including that a stopped read leaves no process behind

## 3. Pages

- [x] 3.1 Write `src/render.ts` and verify the derived tests of `board-pages` for the pages pass, including that every task of a real document appears
- [x] 3.2 Write `src/server.ts`, `src/board.ts` and `src/cli.ts`, and verify the derived tests of the server and of `package` pass, with those needing the whole command: a missing settings file, a read during a request, a missing requirement and stopping
- [x] 3.3 Take the no-arguments case out of `tests/cli.test.ts`'s refusals, and give every spawn there a temporary `HOME` and `XDG_CONFIG_HOME` and a timeout, and verify with a real `config.toml` present that no test reads it

## 4. Finishing

- [x] 4.1 Pin `@types/node` to 24 with a Dependabot `ignore`, and verify `npm run typecheck`
- [x] 4.2 Raise the version to `0.2.0`, add `workflow_dispatch` to `release.yml`, and say in `README.md`'s Status and Architecture how to write the settings, where they live, how to start the board, and that `github_account` is refused until `switch-between-workspaces`
- [x] 4.3 Run it against this project, `ai-toolkit` and `basis`, and verify each page's task count equals `--json`'s
