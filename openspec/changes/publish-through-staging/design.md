# Design

## Context

See `proposal.md` and `handoff.md`. `release.yml` runs on every push to `main`: it sets up Node from `.nvmrc` (`24`), runs `tools/release-decision.mjs`, and where that prints `publish=true` runs `npm ci` and `npm publish --provenance`. The decision compares `package.json`'s version with `npm view dev-task-board version`. The registry holds `0.11.0`, published by the operator, and `0.0.0-stage`, a placeholder npm creates when a package is first staged.

What npm's documentation states, read on 2026-11-13 (docs.npmjs.com: staged-publishing, cli/v11/commands/npm-stage, trusted-publishers):

- `npm stage publish` needs npm 11.15.0 or later and Node 22.14.0 or later. Node 24.22, which `.nvmrc`'s `24` resolves to in CI today, ships npm 11.19.1.
- It accepts `--provenance`, `--tag` (default `latest`) and `--access`, and "has parity with `npm publish`". A trusted publisher may always stage.
- A staged version is not public until a maintainer approves it, on npmjs.com or with `npm stage approve`, each asking for 2FA. Short-lived tokens, OIDC among them, cannot list, view, approve or reject staged versions.
- A version already staged, or already published, cannot be staged again. What becomes of a rejected version's number, whether it can be staged again, the pages do not say.

## Goals / Non-Goals

**Goals**: a merge raising the version stages it; nothing is published without the operator's approval; nothing ships from a local machine.

**Non-Goals**:

- Approving from CI. npm does not allow it, and it would remove the human check this change exists for.
- Making the decision see staged versions. CI's token cannot list them.

## Decisions

**1. Stage, never publish.** The operator, 2026-11-13. The workflow runs `npm stage publish --provenance` and never `npm publish`; the trusted publisher allows staging only, so a direct publish would fail there too. The tag is left to its default, `latest`, as before.

**2. Keep `--provenance`.** The command accepts it, and npm's statement that trusted publishing adds provenance on its own is made of `npm publish`, not of `npm stage publish`. Passing it explicitly holds either way.

**3. Build before staging.** In run 43514917835 npm warned `No bin file found at dist/cli.js`: it reads `package.json` before `prepack` builds `dist/`. Reproduced with npm 11.19.1 and `publish --dry-run` on a tree with no `dist/`; with `dist/` built first the warning is gone. A step running `npm run build` after `npm ci` makes the `bin` exist when npm reads it, so the published manifest keeps it whatever npm does with a missing one. `prepack` still builds again, harmlessly.

**4. No pinned npm.** Node 24 ships an npm new enough, and an npm too old fails at once with `Unknown command: "stage"`, not silently. Pinning npm would be one more version for Dependabot not to track.

**5. The decision is unchanged.** It reads what is published, and CI cannot read what is staged. A staged version waiting for approval therefore still reads as not published, so a merge to `main` in that time decides to publish again and staging is refused, since the version already exists as staged. That run fails, which is the right signal: a version is waiting for approval. Nothing is published or changed by it. The alternative, deciding from whether the push itself raised the version, would never retry a stage that failed, as `0.12.0`'s did, without a manual run. The `0.0.0-stage` placeholder does not bear on the decision: `npm view dev-task-board version` reports the `latest` dist-tag, which is `0.11.0`, as run 43514917835 shows by reaching `npm publish` (the decision refuses a version not of the form `MAJOR.MINOR.PATCH`); a staged version approved under the default tag `latest` keeps it so. `publish=true` now means a release is staged; the `release` requirement says so.

**6. The deploy becomes the approval.** `AGENTS.md` says the merge publishes and that this publish is the deploy. It becomes: a merge raising the version stages it, the operator's approval on npmjs.com publishes it, and that approval is the deploy. It is not a publish from a local machine, since the artefact approved is the one CI built and staged. Confirming a release is approving it and then running `npx dev-task-board@<version>`. A version the operator rejects is followed by a raised version.

## Risks / Trade-offs

- [A merge while a version waits for approval fails the release run] → Approve or reject the staged version before merging the next pull request; the failed run changes nothing.
- [A rejected version may not be stageable again, which npm's pages leave unsaid] → After rejecting a staged version, raise the version before merging again; `AGENTS.md` says so.
- [npm's staged publishing changes, being new] → The workflow fails loudly rather than publishing; the documentation was read on the date above.
- [Provenance not attached to a staged version] → Checked when `0.12.0` is approved: its page on npmjs.com shows provenance or not.

## Migration Plan

Merging this change runs the workflow with `0.12.0` unpublished, so it stages `0.12.0`. The operator approves it on npmjs.com. Rolling back means restoring `npm publish` and allowing direct publishing on the trusted publisher.
