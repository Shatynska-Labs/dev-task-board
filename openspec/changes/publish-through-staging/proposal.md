# Proposal

## Why

The first automated release, of `0.12.0` after `star-workstreams` merged on 2026-11-13, failed at `npm publish` with `E404` (release run 43514917835): the package's trusted publisher on npmjs.com allows staged publishing only. npm recommends leaving direct publishing off, and the operator decided the same day to keep it off: the package is public and run through `npx`, so a compromised `main` or CI should not be able to reach users without a human approving the version. This change moves the release workflow to staged publishing, so a merge that raises the version stages it and the operator's approval on npmjs.com, with 2FA, publishes it. `star-workstreams` waits on it, since its `0.12.0` cannot be confirmed until it is published. The reasons and what bears on the change are in `handoff.md`.

- **Workstream**: this change advances none.

## What Changes

- `.github/workflows/release.yml`, where the release decision says to publish, builds the package and then stages it with `npm stage publish --provenance` instead of `npm publish --provenance`. Building first stops npm from reading a `bin` whose file `prepack` has not built yet, which it warned of in run 43514917835.
- `AGENTS.md`, Development Tooling, says a merge raising the version stages it, that the operator's approval on npmjs.com is the deploy, and that confirming a release is approving it and then running `npx dev-task-board@<version>`.
- `tools/release-decision.mjs` is unchanged: it still compares `package.json` with what the registry publishes, which a staged version is not.
- The version is unchanged: merging this change stages `0.12.0`, the first version released this way.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release`: a raised version is staged for the operator's approval, never published directly; the decision says whether a merge stages a release.

## Impact

- Changed: `.github/workflows/release.yml`, `AGENTS.md`, and a test of the workflow.
- The trusted publisher on npmjs.com stays as the operator has it: staged publishing only.
- Nothing ships from a local machine, and no token is stored.
