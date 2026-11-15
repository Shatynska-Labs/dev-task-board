## MODIFIED Requirements

### Requirement: The command reports its version or starts the board

The command SHALL print the version in `package.json` when run with `--version`, start the board with no arguments or with `--port <number>` for a whole number from 1024 to 65535, and exit non-zero with a message on standard error for anything else. The board SHALL start on the port `--port` gives, else on the settings' `port`, else on 8766.

#### Scenario: Asked for its version

- **WHEN** the built command runs with `--version`
- **THEN** it prints the version in `package.json` and exits zero

#### Scenario: Starting

- **GIVEN** valid settings
- **WHEN** the built command runs with `--port <free port>`
- **THEN** it prints its address, and the address answers

#### Scenario: The port from the settings

- **GIVEN** valid settings with `port` a free port
- **WHEN** the built command runs with no arguments
- **THEN** it prints its address on that port, and the address answers

#### Scenario: The flag over the settings

- **GIVEN** valid settings with `port` one free port
- **WHEN** the built command runs with `--port` another free port
- **THEN** it listens on the port `--port` gave

#### Scenario: An unknown argument

- **WHEN** the built command runs with an unknown argument, or `--port` with no number, or with `80` or `70000`
- **THEN** it writes a message to standard error, writes nothing to standard output, and exits non-zero
