# Tasks

## 1. The port

- [x] 1.1 In `src/settings.ts`, read an optional top-level `port`, refusing one that is not a whole number from 1024 to 65535, and return `{ workspaces, port }`; in `src/cli.ts`, leave the port undefined when `--port` is not given; in `src/board.ts`, start on `--port`, else the settings' `port`, else 8766. Verify with the derived tests for "Settings may name a port" and "The command reports its version or starts the board".

## 2. The holder

- [x] 2.1 Add `src/port.ts`: `holderOf(port)`, finding the listening process through `/proc` on Linux and `lsof` and `ps` on macOS, and deciding `isBoard` as design.md decision 1 states; `bindPort`, which on `EADDRINUSE` replaces a board, waiting up to 10 s, or else offers the nearest bindable port above within 100 where standard input and output are terminals, or refuses with the advice; verify with the derived tests for "A running board is replaced", "A board that does not let go refuses the start", "Another program's port is not taken", "The offered port" and "In a terminal, another port is offered".
- [x] 2.2 In `src/board.ts`, bind through `bindPort`, printing the replacement before the address, and keep other bind failures as today's refusal; verify with the derived tests for "The server is local and refuses other hosts".

## 3. Record and release

- [x] 3.1 In `README.md`, describe in Server and Running it that a running board is replaced and another program's port is not taken, and add `port` to Settings; verify by reading it against `design.md`.
- [x] 3.2 Raise the version from `0.12.0` to `0.13.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.

## 4. Confirm

- [x] 4.1 Confirmed by the operator on 2026-11-15 ("чудово, це спрацювало"), after PR #35 merged and `0.13.0` was approved from staging: `npx dev-task-board@0.13.0`, run while a `0.12.0` board held port 8766, replaced it.
