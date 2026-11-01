## ADDED Requirements

### Requirement: The package holds what it runs

The packed package SHALL hold the compiled command and the carried tool with its source record, and SHALL NOT hold the project's sources or tests.

#### Scenario: Contents of the packed package

- **WHEN** the package is packed
- **THEN** its file list includes `dist/cli.js`, `vendor/task-board` and `vendor/task-board.source`
- **AND** its file list includes nothing under `src/`, `tests/` or `tools/`
- **AND** `dist/cli.js` begins with `#!/usr/bin/env node`

### Requirement: The package names its repository

`package.json` SHALL name `https://github.com/Shatynska-Labs/dev-task-board` in `repository.url`, since provenance is refused without it.

#### Scenario: Repository field

- **WHEN** `package.json` is read
- **THEN** `repository.url` names `Shatynska-Labs/dev-task-board`

### Requirement: The command reports its version

The command `dev-task-board` SHALL print the version in `package.json` when run with `--version`, and SHALL exit non-zero with a message on standard error for any other invocation until a later change gives it one.

#### Scenario: Asked for its version

- **WHEN** the built command runs with `--version`
- **THEN** it prints the version in `package.json` and exits zero

#### Scenario: Run with no supported argument

- **WHEN** the built command runs with no arguments, or with an unknown one
- **THEN** it writes a message to standard error, writes nothing to standard output, and exits non-zero

### Requirement: The carried tool works and names its source

`vendor/task-board.source` SHALL name the full commit of `ai-toolkit` the copy was taken from, and for a project holding `docs/backlog/` or `docs/workstreams/` on its trunk the carried tool SHALL produce a document of `schema_version` 1 when run through `bash`.

#### Scenario: Source record

- **WHEN** `vendor/task-board.source` is read
- **THEN** it holds a 40-character hexadecimal commit

#### Scenario: Reading a project

- **GIVEN** a fixture Git repository with one commit holding `docs/backlog/AGENTS.md`, no remote, and `gh` stubbed
- **WHEN** `bash` runs the carried tool by its absolute path with `--json` and the fixture as target
- **THEN** it exits zero, and standard output is one JSON document whose `schema_version` is 1 and whose `project` is the fixture's directory name

#### Scenario: A repository the tool cannot read

- **GIVEN** a fixture Git repository with one commit and no `docs/backlog/` or `docs/workstreams/`
- **WHEN** `bash` runs the carried tool by its absolute path with `--json` and the fixture as target
- **THEN** it exits 2 and standard output is empty
