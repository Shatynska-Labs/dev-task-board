## 1. Reads

- [x] 1.1 Add `whatMissed`, `settle` and the `latest` field to `src/reads.ts`, and call `settle` from `readOnce`, revise the test in `tests/refresh-reads.test.ts` titled `settles, with the reason in place of the document, when the read fails`, which asserts what this change replaces, to the kept document, and verify the derived tests of `project-reads` pass, including that a project failing with no document is still failed

## 2. Pages

- [x] 2.1 Draw what a document missed and what a kept document is in `src/render.ts`, on the project page and the overview row, with the age function the design names, and verify the derived tests of `board-pages` pass, with the existing forge notice's tests unchanged

## 3. Finishing

- [x] 3.1 Raise the version to `0.4.0` in `package.json` and `package-lock.json`, remove the sentence from `README.md`'s Status that says a failed or partial read replaces the document, and verify `npm run check:package`
- [x] 3.2 Run `npm test`, `npm run typecheck`, `npx biome ci .`, `npm run build` and `npm audit --audit-level=high`, and verify all pass
- [x] 3.3 With `gh` logged in, run the built board against a clone of a real project and open its page, so that its first read is `full`. Point the clone's `origin` at an address that refuses at once, such as `https://127.0.0.1:9/x.git`, since neither git call has a timeout and an address dropping packets would pass the read's limit instead, then refresh, and verify the page keeps the document and names the fetch, the remote branches and the forge. Restore `origin`, refresh, and verify the notice goes. Record what was seen here

**Run** on 2026-11-02 by `curl` against the built board and a clone of this repository, with `gh` logged in. The first read showed no notice. With `origin` at `https://127.0.0.1:9/x.git`, a refresh kept the document, read at 12:04:17 UTC, and page and overview row both said `1 min before the latest read, at 12:05:20 UTC` and named the forge, the fetch and the remote branches. With `origin` restored, a refresh read 12:05:22 UTC and the notice was gone. No browser was used. `XDG_CONFIG_HOME` also moves `gh`'s login, so a run isolating the board's settings that way reads `forge` `none` unless `GH_CONFIG_DIR` is set.

**Confirmed** by the operator on 2026-11-02, on the running board built from `main` at `01b487f`: «все добре працює». What was looked at was not reported, and the operator's settings name a real project rather than a clone, so whether the kept notice itself was seen is unrecorded rather than observed; the run above is what observed it. `dev-task-board` is not yet on npm, so this was run from the clone and not as `npx dev-task-board@0.4.0`.
