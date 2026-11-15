## ADDED Requirements

### Requirement: A raised version is staged for approval

Where the release decision prints `publish=true`, the release workflow SHALL install the locked dependencies, build the package, and then stage it with `npm stage publish --provenance`. It SHALL NOT run `npm publish`, and SHALL hold no npm token, authenticating through trusted publishing alone. Where the decision prints `publish=false`, it SHALL install, build and stage nothing.

#### Scenario: A raised version

- **GIVEN** the release decision prints `publish=true`
- **WHEN** the release workflow runs
- **THEN** it runs `npm ci`, then `npm run build`, then `npm stage publish --provenance`, and no `npm publish`

#### Scenario: An unchanged version

- **GIVEN** the release decision prints `publish=false`
- **WHEN** the release workflow runs
- **THEN** it runs none of `npm ci`, `npm run build` or `npm stage publish`

#### Scenario: No stored token

- **WHEN** the release workflow is read
- **THEN** it grants `id-token: write`, and names no `NODE_AUTH_TOKEN` or `NPM_TOKEN` secret

## MODIFIED Requirements

### Requirement: A release is decided against the registry

`tools/release-decision.mjs` SHALL decide whether a merge stages a release by comparing `package.json`'s version with the one `npm view` reports, printing `publish=true` or `publish=false` on standard output and failing where it cannot decide.

#### Scenario: The package is not on the registry

- **GIVEN** `npm view` fails with E404
- **WHEN** the decision runs
- **THEN** it prints `publish=false`, writes a notice to standard error, and exits zero

#### Scenario: The version is unchanged

- **GIVEN** `npm view` reports the version in `package.json`
- **WHEN** the decision runs
- **THEN** it prints `publish=false` and exits zero

#### Scenario: The version is raised

- **GIVEN** `npm view` reports a lower version than `package.json`, including one lower only by a numeric comparison such as `0.9.0` against `0.10.0`
- **WHEN** the decision runs
- **THEN** it prints `publish=true` and exits zero

#### Scenario: The version is lowered

- **GIVEN** `npm view` reports a higher version than `package.json`
- **WHEN** the decision runs
- **THEN** it exits non-zero and prints no `publish=` line

#### Scenario: A version of another form

- **GIVEN** `package.json`'s version is not of the form `MAJOR.MINOR.PATCH`, such as `0.1.0-beta.1`
- **WHEN** the decision runs
- **THEN** it exits non-zero and prints no `publish=` line

#### Scenario: The registry cannot be read

- **GIVEN** `npm view` fails with any error other than E404
- **WHEN** the decision runs
- **THEN** it exits non-zero and prints no `publish=` line
