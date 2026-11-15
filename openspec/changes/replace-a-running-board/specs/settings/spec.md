## ADDED Requirements

### Requirement: Settings may name a port

The settings MAY hold a top-level `port`, a whole number from 1024 to 65535, which SHALL be the port the board starts on where `--port` is not given. A `port` that is not such a number SHALL refuse the start, naming the settings file and `port` on standard error and starting no server.

#### Scenario: With a port

- **GIVEN** settings with `port = 8800`
- **WHEN** the settings are read
- **THEN** they hold port 8800

#### Scenario: Without a port

- **GIVEN** settings with no `port`
- **WHEN** the settings are read
- **THEN** they hold no port

#### Scenario: A bad port

- **GIVEN** settings whose `port` is `80`, `70000`, `8800.5` or `"8800"`
- **WHEN** the command starts
- **THEN** it exits non-zero, naming the settings file and `port` on standard error, and starts no server
