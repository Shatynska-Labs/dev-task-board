## MODIFIED Requirements

### Requirement: The server is local and refuses other hosts

The server SHALL bind `127.0.0.1`, on the port the command is given or the one accepted as "In a terminal, another port is offered" states, SHALL print its address on standard output once listening, and SHALL answer 403 to a request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`, the port being the one bound. A port that cannot be bound for any reason but being in use SHALL refuse the start with a message naming it. A port in use SHALL be handled as the requirements below state.

#### Scenario: An unexpected host

- **WHEN** a request arrives with `Host` `evil.example`, `evil.example:<port>` or `127.0.0.1:<another port>`
- **THEN** it is answered 403

#### Scenario: The expected hosts

- **WHEN** a request arrives with `Host` `127.0.0.1:<port>` or `localhost:<port>`
- **THEN** it is answered normally

#### Scenario: A port in use

- **GIVEN** the port is taken by a program that is not a board
- **WHEN** the command starts without a terminal
- **THEN** it exits non-zero, naming the port

## ADDED Requirements

### Requirement: A running board is replaced

Where the port is held by a process of the same user whose script, the first argument after its interpreter, is an absolute path that, with links resolved, is `dist/cli.js` in a directory whose `package.json` is named `dev-task-board`, the command SHALL send that process `SIGTERM`, SHALL bind the port once it is free, and SHALL print on standard output, before its address, that it replaced the dev-task-board on that port, naming its process id.

#### Scenario: A board already on the port

- **GIVEN** a board running on a port
- **WHEN** a second board starts on the same port
- **THEN** the first exits, and the second prints that it replaced the board with the first's process id, then its address, and the address answers

#### Scenario: A board reached through a link

- **GIVEN** a board running from a command whose path is a link to the package's `dist/cli.js`, as `npx` runs it
- **WHEN** a second board starts on the same port
- **THEN** the first exits and the second listens

### Requirement: A board that does not let go refuses the start

After `SIGTERM`, the command SHALL retry the bind for up to 10 seconds. A holder that has not freed the port by then SHALL refuse the start with a message naming the port and the process id, and SHALL NOT be sent any other signal.

#### Scenario: A board that does not let go

- **GIVEN** a dev-task-board holder that does not free the port within 10 seconds of `SIGTERM`
- **WHEN** the command starts on its port
- **THEN** it exits non-zero naming the port and the holder's process id, and the holder is sent nothing else

### Requirement: Another program's port is not taken

Where the port is held by anything that is not a board as "A running board is replaced" states, or by a holder that cannot be found, the command SHALL send no signal. Unless its standard input and output are both a terminal, it SHALL refuse the start with a message naming the port and advising `--port <m>` or the `port` setting, `m` being the port "The offered port" states.

#### Scenario: Another program, no terminal

- **GIVEN** a port held by a program that is not a board
- **WHEN** the command starts on it without a terminal
- **THEN** it exits non-zero, writing nothing to standard output, naming the port and `port =`, and the holder still runs

#### Scenario: A look-alike

- **GIVEN** a port held by a process whose command line names a `dist/cli.js` in a directory whose `package.json` is named otherwise
- **WHEN** the command starts on it without a terminal
- **THEN** it refuses the start, and the holder still runs

### Requirement: The offered port

The port offered or advised, `m`, SHALL be the nearest port above the one held, up to 100 above it and at most 65535, that the command can bind. Where none binds, the command SHALL refuse the start naming the port, with no port offered or advised.

#### Scenario: No port to offer

- **GIVEN** a port held by a program that is not a board, and every port up to 100 above it, or up to 65535, unbindable
- **WHEN** the command starts on it without a terminal
- **THEN** it exits non-zero naming the port, and advises no `--port`

### Requirement: In a terminal, another port is offered

Where another program holds the port and standard input and output are both a terminal, the command SHALL ask whether to start on port `m`, naming the port and, where found, the holder's command and process id. Answered `y` or `yes`, ignoring case and surrounding space, it SHALL start on `m` and print that adding `port = <m>` to the named settings file keeps it. Answered otherwise, or with the input ended or interrupted, it SHALL refuse the start and exit non-zero.

#### Scenario: Another program, answered yes

- **GIVEN** a port `n` held by a program that is not a board, and port `n+1` free
- **WHEN** the command starts on `n` in a terminal and is answered `y`
- **THEN** it listens on `n+1`, prints the settings file and `port = <n+1>`, and the holder is sent no signal

#### Scenario: Another program, answered no

- **GIVEN** a port held by a program that is not a board
- **WHEN** the command starts on it in a terminal and is answered with an empty line, or its input ends
- **THEN** it exits non-zero and binds nothing
