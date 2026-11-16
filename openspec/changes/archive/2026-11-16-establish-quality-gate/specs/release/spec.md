## ADDED Requirements

### Requirement: A release is decided against the registry

`tools/release-decision.mjs` SHALL decide whether a merge publishes by comparing `package.json`'s version with the one `npm view` reports, printing `publish=true` or `publish=false` on standard output and failing where it cannot decide.

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
