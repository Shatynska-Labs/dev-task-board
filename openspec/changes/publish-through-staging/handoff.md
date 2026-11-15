# Handoff: `publish-through-staging`

## Why this change was identified

On 2026-11-13 the release of `0.12.0`, the first automated publish after the operator's manual first publish of `0.11.0`, failed at `npm publish --provenance` with `E404 Not Found - PUT https://registry.npmjs.org/dev-task-board` (release run 43514917835, after pull request #33 of `star-workstreams` merged). The package's trusted publisher on npmjs.com allowed staged publishing only; `npm stage publish` is always allowed, and direct publishing is a separate option that npm marks "Not recommended. For stronger security, leave this unchecked to require staged publishing for new versions."

The operator decided, on 2026-11-13, to keep direct publishing off and publish through staging: a merge that raises the version stages it, and the operator approves it on npmjs.com, with 2FA, before it goes live. The reason is supply-chain risk: the package is public and run through `npx`, and with direct publishing a compromised `main` or CI would reach users with no human check.

`star-workstreams` waits on this change: its `0.12.0` is merged but unpublished, and its confirmation cannot happen until a release reaches the registry.

## What bears on it

- `.github/workflows/release.yml` runs `npm publish --provenance` where `tools/release-decision.mjs` prints `publish=true`. It becomes the staging command. Check the current npm documentation for `npm stage publish`: its flags, whether `--provenance` applies, the npm CLI version it needs against the one Node 24 in `.nvmrc` ships, and how a staged version is approved.
- `tools/release-decision.mjs` and `openspec/specs/release/spec.md` decide by comparing `package.json` with `npm view dev-task-board version`. A version that is staged and not yet approved is presumably not what `npm view` reports, so a re-run of the workflow, or another merge before the approval, would try to stage the same version again. Decide what the decision does then — publish nothing, or tolerate the registry refusing a duplicate — and whether it can read staged versions at all. The registry also holds a `0.0.0-stage` version, from the operator's setup on 2026-11-10; check whether it bears on the comparison.
- `AGENTS.md`, Development Tooling, says a workflow "publishes with npm trusted publishing when a merge to `main` raises the version", that "that publish is this project's deploy", and that confirming a release means running `npx dev-task-board@<version>`. It changes to say the merge stages the version and the operator's approval on npmjs.com publishes it; the deploy is then that approval, which is the operator's, not a local publish. `README.md`'s Running it needs no change.
- The release log of run 43514917835 also warned `No bin file found at dist/cli.js` during `npm publish`, though the tarball held `dist/cli.js`. Probably a check run before the build; worth a look while the workflow is open, not necessarily in scope.

## What it must not undo

- Nothing ships from a local machine: no local `npm publish`, and no stored npm token. Trusted publishing stays.
- A merge that leaves the version alone stages nothing.
- The release decision still fails rather than guesses where it cannot read the registry, and still refuses a lowered version or one not of the form `MAJOR.MINOR.PATCH`.
- `0.12.0` should be the first version released this way: do not raise the version only to get past the failed run unless the staging behaviour requires it.
