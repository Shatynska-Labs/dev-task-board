# Tasks

## 1. Workflow

- [x] 1.1 In `.github/workflows/release.yml`, add a step running `npm run build` after `npm ci`, and replace `npm publish --provenance` with `npm stage publish --provenance`, each behind the decision's `publish == 'true'`; verify with the derived tests for "A raised version is staged for approval".

## 2. Record

- [x] 2.1 In `AGENTS.md`, Development Tooling, Build tooling: a merge raising the version stages it, the operator's approval on npmjs.com publishes it and is the deploy, confirming a release is approving it and then running `npx dev-task-board@<version>`, and a rejected version is followed by a raised one; verify by reading it against `design.md` decision 6.
- [x] 2.2 Run `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.

## 3. Confirm

- [x] 3.1 The operator merged #34 on 2026-11-13, approved the staged 0.12.0 on npmjs.com on 2026-11-15 and ran it through `npx`. Every release since, 0.13.0 to 0.16.0, was staged by a merge and published by the operator's approval in the same way.
