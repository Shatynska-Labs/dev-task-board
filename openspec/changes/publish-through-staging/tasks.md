# Tasks

## 1. Workflow

- [ ] 1.1 In `.github/workflows/release.yml`, add a step running `npm run build` after `npm ci`, and replace `npm publish --provenance` with `npm stage publish --provenance`, each behind the decision's `publish == 'true'`; verify with the derived tests for "A raised version is staged for approval".

## 2. Record

- [ ] 2.1 In `AGENTS.md`, Development Tooling, Build tooling: a merge raising the version stages it, the operator's approval on npmjs.com publishes it and is the deploy, confirming a release is approving it and then running `npx dev-task-board@<version>`, and a rejected version is followed by a raised one; verify by reading it against `design.md` decision 6.
- [ ] 2.2 Run `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.
