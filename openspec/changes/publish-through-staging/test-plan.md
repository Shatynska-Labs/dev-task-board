# Test plan: `publish-through-staging`

Derived from the delta spec `specs/release/spec.md` at plan commit `679dc00`, before any implementation. This file is not an OpenSpec schema artifact: `openspec instructions apply` does not list it, so read it on purpose before implementing.

Test command: `npm test`. Every test below is selectable with `npx vitest run <file> -t "<name>"`; names are given as the full `describe > it` path.

## Scenarios

Nine scenarios in the delta spec, nine accounted for.

### ADDED: A raised version is staged for approval

All in `tests/release-workflow.test.ts`. The workflow runs only on GitHub Actions, so every check is a static read of `.github/workflows/release.yml`; each check also runs over workflows the test file writes itself (fixture-driven discriminators) to show it can fail.

| Scenario | Test on the real workflow | Discriminators | State at authoring |
|---|---|---|---|
| A raised version | `A raised version is staged for approval > A raised version > runs npm ci, then npm run build, then npm stage publish --provenance, and no npm publish` | `A raised version is staged for approval > A raised version > the check > …` (2 passing, 8 failing workflows) | **Red**, on the property: reports `npm run build does not run after npm ci where publish=true` and `a step runs npm publish: npm publish --provenance`. Goes green when task 1.1 lands. |
| An unchanged version | `A raised version is staged for approval > An unchanged version > runs none of npm ci, npm run build or npm stage publish` | `A raised version is staged for approval > An unchanged version > the check > …` (2 passing, 5 failing, 1 refused) | Green at authoring: the current workflow already gates `npm ci` and its publish step on the decision, and has no build step. Its ability to fail rests on the discriminators. |
| No stored token | `A raised version is staged for approval > No stored token > grants id-token: write, and names no NODE_AUTH_TOKEN or NPM_TOKEN secret` | `A raised version is staged for approval > No stored token > the check > …` (3 passing, 4 failing) | Green at authoring: trusted publishing is already in place. Its ability to fail rests on the discriminators. |

### MODIFIED: A release is decided against the registry

The delta changes only the requirement's wording ("whether a merge publishes" → "whether a merge stages a release"); all six scenarios are textually identical to the requirement under `openspec/specs/release/spec.md`. Each is already covered by an existing test in `tests/release-decision.test.ts`, which asserts exactly the revised scenario's behaviour, so no duplicate was written. They are covered, not exempted:

| Scenario | Covering existing test |
|---|---|
| The package is not on the registry | `A release is decided against the registry > The package is not on the registry > prints publish=false, writes a notice to standard error, and exits zero` |
| The version is unchanged | `A release is decided against the registry > The version is unchanged > prints publish=false and exits zero` |
| The version is raised | `A release is decided against the registry > The version is raised > publishes %s over %s` (6 cases) |
| The version is lowered | `A release is decided against the registry > The version is lowered > fails with %s against %s` (4 cases) |
| A version of another form | `A release is decided against the registry > A version of another form > fails for %s where %s`, `… > fails where the registry's version is of another form` |
| The registry cannot be read | `A release is decided against the registry > The registry cannot be read > fails on %s` (3 cases) |

The wording change itself ("stages a release") has no behaviour of its own to assert; what "stages" means is asserted by the ADDED requirement's tests.

No uncovered scenarios.

## Assertion classification

Specified (traces to the ADDED requirement's scenarios):

- `npm ci`, `npm run build` and `npm stage publish --provenance` run, in that order, where the decision's output is `publish == 'true'`.
- No step runs `npm publish`.
- None of `npm ci`, `npm run build`, `npm stage publish` runs where the output is `publish == 'false'`.
- Some `permissions` mapping grants `id-token: write`; the workflow names no `NODE_AUTH_TOKEN` or `NPM_TOKEN`.

Derived (inferred by the test author; reconsiderable, never repairable into the observed value):

- **How "runs where publish=true/false" is read.** A step runs for a given decision if every `if:` on it and on its job holds. A conjunct (split on `&&`) that does not mention `outputs.publish` is taken as independent of the decision and treated as true. A conjunct that mentions it must have the form `<anything>.outputs.publish == 'true'|'false'` or `!= …`, optionally in `${{ }}` and parentheses; any other form (including with `||`) makes the check throw `a condition not understood` rather than guess. This constrains the implementation to a plain step- or job-level `if:` on the decision's `publish` output, which `tasks.md` 1.1 ("each behind the decision's `publish == 'true'`") also states. A shell-level `if` inside `run:` is not read as gating.
- **The decision is wired in.** `raisedVersionProblems` requires some step whose `run` mentions `tools/release-decision.mjs` (the requirement's "where the release decision prints …").
- **Order is by appearance**, across jobs in their order in the file and steps in order, then commands within a `run` split on newlines, `&&`, `||` and `;`. Not required to be in one job.
- **Command recognition**: a command must *begin* with `npm ci`, `npm run build`, or `npm stage publish` (the last also carrying `--provenance`); `npm publish` is matched anywhere in any step's `run`, gated or not. A third-party publishing action under `uses:` is not detected.
- **Token names** are matched case-insensitively (GitHub secrets are case-insensitive) in every key and value of the parsed workflow, not in comments.
- **The YAML reader** in the test file reads block mappings, block sequences (including same-indent sequences under a key), `|`/`>` block scalars and single-line scalars, keeps flow collections as text, and throws on anything else (multi-line plain or quoted scalars, unexpected indentation). A workflow using those forms will fail to be read (state 3 for the test, not a finding about the behaviour) and the reader would need extending.
- The discriminator cases each falsify one property the check exists to assert; the positive fixtures (one multi-line step; job-level gating; job-level `id-token`; a comment mentioning `NPM_TOKEN`) establish that the check does not over-reject forms the requirement permits.

Deliberately untested:

- That `--tag` is left to its default (`design.md` decision 1): not in the requirement.
- That npm is not pinned (decision 4), that `--provenance` is honoured by the registry, and that the operator's approval publishes: not observable from the repository.
- The `AGENTS.md` record (task 2.1): documentation, verified by reading per `tasks.md`.

## Obsolete tests

The change carries one MODIFIED delta; its superseded text is only the phrase "whether a merge publishes". Searched `tests/**/*.test.ts` (names, assertions, and references to `release-decision`, `publish`, `workflow`, `stage`). The tests bearing on the requirement are those in `tests/release-decision.test.ts`; each asserts behaviour the revised requirement states unchanged, so **none is superseded**. Not one was found that asserts the workflow runs `npm publish`. This is the result of that bounded search, not a claim that no such test exists elsewhere; no earlier `test-plan.md` was supplied.

Also within the glob, `tests/package.test.ts > … > reports a list holding tools/release-decision.mjs` references the decision script only as a file the package must not hold; it bears on neither delta. **Candidate for human confirmation**: that no existing test is obsolete.

## Unresolved project questions

- **Stack skill**: the library carries no TypeScript or Vitest skill; tests were written on the `testing` floor alone, following the idiom of the existing tests (e.g. `tests/release-decision.test.ts`). Depends: all tests in `tests/release-workflow.test.ts`.
- **Reading a workflow with no YAML parser**: `AGENTS.md` records no convention for testing a GitHub Actions workflow, and the project has no YAML parser. Assumption: a minimal reader declared in the test file, kept within existing devDependencies as dispatched. Depends: all tests in `tests/release-workflow.test.ts`. Whether to add a YAML devDependency instead is the project's decision.

## Missing shared arrangement

Shared arrangement dispatched: `tests/support/` (`build.ts`, `document.ts`, `fixture.ts`, `page.ts`, `temporary.ts`). It holds nothing for reading a workflow, and no near-miss: `page.ts` reads HTML, `document.ts` builds board documents, `fixture.ts` builds Git repositories. None was found in another test module.

All declared in `tests/release-workflow.test.ts`, used by every test in that file (`npx vitest run tests/release-workflow.test.ts`):

- **`parseYaml`** (with `scalar`, `unquote`, types `Yaml`, `Line`, regex `KEY`) — stands in for a YAML parser. Near-miss: none. Proposed home: `tests/support/yaml.ts`, if more workflow tests are expected; otherwise keep local.
- **`workflowOf`, `stepsOf`, `holds`, `runsWhen`, `commandsOf`** and the command regexes (`NPM_CI`, `NPM_RUN_BUILD`, `NPM_STAGE_PUBLISH`, `PROVENANCE`, `NPM_PUBLISH`) — stand in for a reader of a GitHub Actions workflow as conditional steps. Near-miss: none. Proposed home: `tests/support/workflow.ts`, with `parseYaml`, if `gate.yml` gains tests.
- **`workflow(variant)`** and `expression`, `PUBLISH_TRUE`, type `Variant` — a builder of fixture release workflows for the discriminators. Near-miss: none. Proposed home: none; it is specific to this requirement and should stay local.
- **`raisedVersionProblems`, `unchangedVersionProblems`, `storedTokenProblems`** — the checks themselves, not arrangement; listed so the disposition is unambiguous. Keep local.

## Baseline

Full suite, before writing any test, at `679dc00` with `npm ci` provisioned: `npm test` → 29 files passed, 538 tests passed, 1 skipped, 0 failing. (`npm test` excludes `tests/package.test.ts` by its own definition.)

After adding `tests/release-workflow.test.ts`: 30 files, 565 passed, 1 skipped, 1 failing — the single failure is the real-workflow check for "A raised version", red for the reasons recorded above. `biome ci` passes on the new file.
