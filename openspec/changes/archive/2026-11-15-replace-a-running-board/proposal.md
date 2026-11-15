# Proposal

## Why

Starting a newer version of the board while an older one still runs fails with `port 8766 is in use`, and the operator then has to find the old process and stop it by hand. It happened on 2026-11-15 on the first run of `0.12.0`: a `0.11.0` board started three days earlier in a forgotten terminal held the port. The operator asked on 2026-11-15 that a new board replace one already running, but only where what holds the port is a dev-task-board; where it is another program, the board should say so and offer to start on another port, without asking that question at every start.

- **Workstream**: this change advances none.

## What Changes

- Where the port is held by a dev-task-board process of the same user, a starting board stops it with `SIGTERM`, waits for the port to be free, takes it, and says on standard output which process it replaced. A running board of any version is recognised, including `0.11.0`, since it is recognised by its process, not by anything it answers.
- Where the port is held by anything else, or by a process that cannot be identified, nothing is stopped. Run in a terminal, the board names the port, and the holder where it can be seen, and asks whether to start on the nearest free port above it; answered yes, it starts there and says how to keep that port without the question. Run without a terminal, it refuses the start as today, with the same advice.
- Settings take an optional top-level `port`, a whole number from 1024 to 65535, used when `--port` is not given, so a port chosen once stays chosen and the question is not repeated. `--port` still wins.
- `README.md` describes the replacement and the `port` setting. The version rises from `0.12.0` to `0.13.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: "The server is local and refuses other hosts" — a port held by a dev-task-board is taken over; a port held by anything else is refused or, in a terminal, offered another.
- `settings`: an optional `port`, refused where it is not a whole number from 1024 to 65535.
- `package`: "The command reports its version or starts the board" — the port comes from `--port`, else the settings, else 8766.

## Impact

- New: `src/port.ts` and its tests.
- Changed: `src/board.ts`, `src/cli.ts`, `src/settings.ts`, their tests, `README.md`, `package.json`, `package-lock.json`.
- Pages, reads, stars and the carried tool are unchanged. No new route: the server answers nothing it did not answer before.
