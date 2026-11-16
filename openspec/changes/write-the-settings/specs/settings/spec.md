## ADDED Requirements

### Requirement: No settings file starts the board empty

Where the settings file does not exist, the command SHALL start the board with no workspaces, SHALL print the address of its settings page, and SHALL write no file until a change is saved. A file that exists but cannot be read SHALL still refuse the start, as "Bad settings refuse the start" states.

#### Scenario: No file

- **GIVEN** no settings file
- **WHEN** the command starts
- **THEN** the board serves, prints `/settings` in its address, and no settings file exists

#### Scenario: A file that cannot be read

- **GIVEN** a settings file that is not valid TOML
- **WHEN** the command starts
- **THEN** it exits non-zero, naming the file, and the file is unchanged

## MODIFIED Requirements

### Requirement: Settings name workspaces and their projects

The command SHALL read `config.toml` under `$XDG_CONFIG_HOME/dev-task-board`, or `~/.config/dev-task-board` where that is unset or empty. It MAY hold a top-level `projects_dir`, an absolute path or one beginning `~/`, which SHALL be `~/projects` where absent. Its `[workspaces.<name>]` tables SHALL each hold `projects`, a list, possibly empty, of absolute paths, paths beginning `~/`, or names relative to `projects_dir`, such as `group/one`. A project's address SHALL be its directory's base name. The same project MAY appear in more than one workspace.

#### Scenario: Where the file is

- **WHEN** `XDG_CONFIG_HOME` is set, unset or empty
- **THEN** the file is under its value in the first case, and under `~/.config` in the others

#### Scenario: A valid file

- **GIVEN** directories `<home>/a/one` and `<root>/b/two`, and a file with a workspace `work` listing `~/a/one` and `<root>/b/two`
- **WHEN** the settings are read
- **THEN** workspace `work` holds projects `one` and `two`, with `~/` expanded to the home directory

#### Scenario: A name in the projects folder

- **GIVEN** a directory `<home>/projects/group/one`, no `projects_dir`, and a workspace listing `group/one`
- **WHEN** the settings are read
- **THEN** the workspace holds project `one` at `<home>/projects/group/one`

#### Scenario: Another projects folder

- **GIVEN** a directory `<root>/code/one`, `projects_dir = "<root>/code"`, and a workspace listing `one`
- **WHEN** the settings are read
- **THEN** the workspace holds project `one` at `<root>/code/one`

#### Scenario: One project in two workspaces

- **GIVEN** a directory `<home>/projects/group/one`, and workspaces `a` and `b` each listing `group/one`
- **WHEN** the settings are read
- **THEN** both hold project `one` at that path

#### Scenario: Empty

- **GIVEN** a file with a workspace `work` whose `projects` is empty, and a file naming no workspace
- **WHEN** each is read
- **THEN** the first holds workspace `work` with no projects, and the second no workspace

### Requirement: Bad settings refuse the start

The command SHALL exit non-zero, naming the settings file and the fault on standard error and starting no server, for a file that is not valid TOML, a `workspaces` that is not a table, a `projects` that is missing or not a list of strings, a `projects_dir` that is not a string beginning `/` or `~/`, a project name holding an empty, `.` or `..` segment, a path that is not a directory, two projects of one base name in a workspace, a `github_account` that is not a non-empty string, or a workspace named `api`, `settings`, `.`, `..`, empty, or holding `/`. Paths SHALL be normalised before the base name is taken, a path with an empty or dot base name SHALL be refused, and paths SHALL be checked before duplicates are.

#### Scenario: Missing file

- **WHEN** the command starts with no settings file
- **THEN** it is not refused, as "No settings file starts the board empty" states

#### Scenario: Two projects of one name

- **GIVEN** directories `<root>/a/one` and `<root>/b/one`, and a workspace listing both
- **WHEN** the settings are read
- **THEN** the start is refused, naming `one`

#### Scenario: A reserved name

- **GIVEN** a workspace named `api`, and one named `settings`
- **WHEN** each is read
- **THEN** the start is refused, naming the workspace

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

- **GIVEN** a project path, or a name in the projects folder, that is not a directory
- **WHEN** the settings are read
- **THEN** the start is refused, naming it

#### Scenario: A name leaving the projects folder

- **GIVEN** a workspace listing `../elsewhere`, or `group//one`
- **WHEN** the settings are read
- **THEN** the start is refused, naming it

#### Scenario: A bad projects folder

- **GIVEN** `projects_dir` as `code`, or as `7`
- **WHEN** the settings are read
- **THEN** the start is refused, naming `projects_dir`

#### Scenario: A github account

- **GIVEN** a workspace whose `github_account` is empty, or a number
- **WHEN** the settings are read
- **THEN** the start is refused, naming the workspace and `github_account`
