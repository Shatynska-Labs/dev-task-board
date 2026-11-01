## ADDED Requirements

### Requirement: Each project is read once at start

The command SHALL read each project once after the server starts, one project at a time per workspace, by running the carried tool through `bash` with `--json` and the project's path, so that the server answers while reads run. A project SHALL be one of: being read, read, or failed with a reason.

#### Scenario: A readable project

- **GIVEN** a fixture project holding `docs/backlog/AGENTS.md`
- **WHEN** it is read
- **THEN** it holds the document the tool printed, and the time of the read

#### Scenario: The server answers during a read

- **GIVEN** a read that has not finished
- **WHEN** a page is requested
- **THEN** the page answers, showing that project as being read

### Requirement: A failed read has a reason

A read SHALL fail with a reason where the tool exits non-zero, its output is not one JSON document, its `schema_version` is not 1, or it passes 60 seconds, and a failure SHALL NOT stop the other projects' reads. A read stopped at its limit SHALL have the tool and the processes it started stopped, by `SIGTERM` and after a 5 second grace by `SIGKILL`.

#### Scenario: The tool refuses

- **GIVEN** a fixture project with neither `docs/backlog/` nor `docs/workstreams/`
- **WHEN** it is read
- **THEN** it has failed, with the tool's `Reason:` line as its reason

#### Scenario: A failure with nothing on standard error

- **GIVEN** a tool that exits non-zero, or is killed by a signal, writing nothing to standard error
- **WHEN** a project is read
- **THEN** it has failed, and the reason names the exit code or signal

#### Scenario: An unknown schema

- **GIVEN** a tool printing `schema_version` 2
- **WHEN** a project is read
- **THEN** it has failed, and the reason names version 2

#### Scenario: A read past its limit

- **GIVEN** a tool that starts a child and does not finish
- **WHEN** the limit passes
- **THEN** the tool and its child are stopped, and the project has failed with that reason

#### Scenario: A tool that exits zero with bad output

- **GIVEN** a tool printing text that is not JSON and exiting zero
- **WHEN** a project is read
- **THEN** it has failed, and the reason says the output could not be read

#### Scenario: One failure among several

- **GIVEN** a workspace whose first project fails
- **WHEN** it is read
- **THEN** the second project is still read

### Requirement: Stopping the board stops its reads

On `SIGINT` or `SIGTERM` the command SHALL close the server, stop running reads with the same signals and grace, start no further read, and exit zero.

#### Scenario: Stopped during a read

- **GIVEN** a board with a read running
- **WHEN** it receives `SIGINT`
- **THEN** the read's processes are gone, the port is free, and it exits zero within the grace and the kill

#### Scenario: Stopped with a project waiting

- **GIVEN** a workspace of two projects, the first being read
- **WHEN** the board is stopped
- **THEN** the second is never read

### Requirement: What the tool needs is checked at start

The command SHALL refuse to start, naming what is missing, where `bash`, `git` or `awk` is not on `PATH`. `gh` SHALL stay optional.

#### Scenario: A missing requirement

- **GIVEN** valid settings and a `PATH` with no `awk`
- **WHEN** the command starts
- **THEN** it exits non-zero, naming `awk`
