# settings Specification

## Purpose

Reading the file that names workspaces and their projects, and refusing a start on anything wrong in it.

## Requirements

### Requirement: Settings name workspaces and their projects

The command SHALL read `config.toml` under `$XDG_CONFIG_HOME/dev-task-board`, or `~/.config/dev-task-board` where that is unset or empty, whose `[workspaces.<name>]` tables each hold `projects`, a non-empty list of absolute paths or paths beginning `~/`. A project's address SHALL be its directory's base name.

#### Scenario: Where the file is

- **WHEN** `XDG_CONFIG_HOME` is set, unset or empty
- **THEN** the file is under its value in the first case, and under `~/.config` in the others

#### Scenario: A valid file

- **GIVEN** directories `<home>/a/one` and `<root>/b/two`, and a file with a workspace `work` listing `~/a/one` and `<root>/b/two`
- **WHEN** the settings are read
- **THEN** workspace `work` holds projects `one` and `two`, with `~/` expanded to the home directory

### Requirement: Bad settings refuse the start

The command SHALL exit non-zero, naming the settings file and the fault on standard error and starting no server, for a missing file, a file that is not valid TOML, no workspace, a `workspaces` that is not a table, a `projects` that is missing, empty or not a list of strings, a relative path, a path that is not a directory, two projects of one base name in a workspace, or a workspace named `api`, `.`, `..`, empty, or holding `/`. Paths SHALL be normalised before the base name is taken, a path with an empty or dot base name SHALL be refused, and paths SHALL be checked before duplicates are. It SHALL refuse `github_account`, saying it is not yet supported, rather than read with the wrong account.

#### Scenario: Missing file

- **WHEN** the command starts with no settings file
- **THEN** it exits non-zero, and standard error names the path, `[workspaces.<name>]` and `projects`

#### Scenario: Two projects of one name

- **GIVEN** directories `<root>/a/one` and `<root>/b/one`, and a workspace listing both
- **WHEN** the settings are read
- **THEN** the start is refused, naming `one`

#### Scenario: A reserved name

- **GIVEN** a workspace named `api`
- **WHEN** the settings are read
- **THEN** the start is refused, naming `api`

#### Scenario: A name unusable in an address

- **GIVEN** a workspace named `a/b`
- **WHEN** the settings are read
- **THEN** the start is refused, naming `a/b`

#### Scenario: Paths are checked before duplicates

- **GIVEN** a workspace listing `<root>/a/one`, which does not exist, and `<root>/b/one`
- **WHEN** the settings are read
- **THEN** the start is refused, naming the path and not the duplicate

#### Scenario: A project with no usable name

- **GIVEN** a project path of `/`
- **WHEN** the settings are read
- **THEN** the start is refused, naming the path

#### Scenario: A project that does not exist

- **GIVEN** a project path that is not a directory
- **WHEN** the settings are read
- **THEN** the start is refused, naming the path

#### Scenario: A github account

- **GIVEN** a workspace with `github_account`
- **WHEN** the settings are read
- **THEN** the start is refused, saying it is not yet supported
