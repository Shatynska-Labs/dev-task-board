## REMOVED Requirements

### Requirement: The command reports its version

**Reason**: the command now starts the board with no arguments, so refusing them no longer holds.

**Migration**: replaced by `The command reports its version or starts the board`.

## ADDED Requirements

### Requirement: The command reports its version or starts the board

The command SHALL print the version in `package.json` when run with `--version`, start the board with no arguments or with `--port <number>` for a whole number from 1024 to 65535, and exit non-zero with a message on standard error for anything else.

#### Scenario: Asked for its version

- **WHEN** the built command runs with `--version`
- **THEN** it prints the version in `package.json` and exits zero

#### Scenario: Starting

- **GIVEN** valid settings
- **WHEN** the built command runs with `--port <free port>`
- **THEN** it prints its address, and the address answers

#### Scenario: An unknown argument

- **WHEN** the built command runs with an unknown argument, or `--port` with no number, or with `80` or `70000`
- **THEN** it writes a message to standard error, writes nothing to standard output, and exits non-zero
