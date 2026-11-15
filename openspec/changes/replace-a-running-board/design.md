# Design

## Context

See `proposal.md` for why. `src/cli.ts` parses `--port`, defaulting to 8766, and calls `startBoard(port)` in `src/board.ts`, which checks commands, reads settings and stars, then binds through `startServer`; `EADDRINUSE` becomes the refusal `port <n> is in use`. A board stops on `SIGINT` or `SIGTERM`, stopping its reads within `STOP_GRACE_MS` (5 s) and exiting 0. A board run through `npx` is `node <cache>/node_modules/.bin/dev-task-board`, that link pointing at `<cache>/node_modules/dev-task-board/dist/cli.js`.

## Goals / Non-Goals

**Goals**: running a newer, or the same, version replaces the board already running on its port, with nothing to stop by hand; another program's port is never taken; a port chosen once is kept.

**Non-Goals**:

- Replacing a board on another port than the one being started on. Two boards on two ports are left alone.
- A shutdown route on the server. See decision 2.
- Writing the settings file. The board says what to add; the user adds it, as with every other setting.
- Windows outside WSL, which the board does not support.

## Decisions

**1. Replace only what is verified to be a board.** The operator, 2026-11-15: replace only where the port's holder is a dev-task-board. A holder counts as one when all hold: it is a process listening on the port whose user id is the board's own, its script — the first argument after the interpreter — is an absolute path, and that path, with links resolved, is `dist/cli.js` inside a directory whose `package.json` has `"name": "dev-task-board"`. Anything short of that — a process of another user, a holder that cannot be found, a different command — is treated as another program, and nothing is signalled. A wrong refusal costs a manual stop; a wrong replacement stops someone else's program, so every doubt resolves to refusal.

**2. Found by its process, not asked over HTTP.** A board answering a request that identifies it would recognise only versions from this change on, leaving `0.11.0` and `0.12.0` to be stopped by hand, and a shutdown route would be the server's second write, open to any local process. The process is found from the operating system instead, which recognises every version: on Linux, the socket listening on the port is read from `/proc/net/tcp` and `/proc/net/tcp6` and matched to a process through `/proc/<pid>/fd`, whose command line is `/proc/<pid>/cmdline` and whose user id is the socket's `uid` column, compared with `process.getuid()`, so a board run as root still checks it; on macOS, `lsof -nP -iTCP:<port> -sTCP:LISTEN -Fp` gives the process and `ps -ww -o uid=,command= -p <pid>` its user id and command line, the command split on spaces, so an install path holding a space is not recognised and is refused. Where `lsof` is missing, the holder is unknown and refused.

**3. Stop, wait, then bind.** The board sends `SIGTERM` to the holder, which stops as on Ctrl+C, then retries the bind every 100 ms for up to 10 s, twice the old board's stop grace. A holder that has not let go by then refuses the start, naming its process, and is not sent `SIGKILL`: a board slow to stop is left to finish stopping. Once bound, standard output says `replaced the dev-task-board on port <n> (pid <pid>)` before the address.

**4. Another program: ask in a terminal, refuse otherwise.** The operator, 2026-11-15, asked that the board offer another port and warn that the question would come back at every start. The `port` setting removes the reason for the warning: the board offers the nearest port above that binds, up to 100 above and never past 65535, and where none binds refuses with no port offered, and on yes starts there and prints `to keep port <m>, add port = <m> to <settings file>`, so the next start uses it and asks nothing. Only where standard input and output are both a terminal is the question asked, `port <n> is used by <command> (pid <pid>). Start on <m> instead? [y/N]`, the holder omitted where unknown; anything but `y` or `yes`, and an ended or interrupted input, refuses the start and exits non-zero rather than leaving the board waiting at the prompt. Without a terminal, as when run by a service manager or a test, the start is refused naming the port and giving the same advice with `--port <m>` and the setting. Rewriting `config.toml` for the user was left for the reason the stars file is separate: it would lose the user's comments and formatting.

**5. Where the port comes from.** `--port`, else `port` in the settings, else 8766. A replacement and the offer both apply to whichever port that gives. The settings are read before the port is bound, as today, so a bad `port` refuses the start before anything is signalled.

**6. Where it lives in code.** `src/port.ts` exports `holderOf(port): Promise<Holder | undefined>`, a `Holder` being `{ pid, command, isBoard }`, and `bindPort(port, { bind, holderOf, signal, ask, settingsFile, log })`, which takes the bind as a function returning the bound port and decides replacement, waiting and the offer, so its decisions are tested with fakes and its operating-system reads against real processes. `startBoard` calls it in place of the bare bind. `parseSettings` returns `{ workspaces, port }`.

## Risks / Trade-offs

- A board started by mistake in a second terminal stops the first. That is the asked-for behaviour, and the message says what was replaced.
- A process of the same user that copies a dev-task-board install and serves something else from it would be stopped; such a process is the user's own and is a board by any test available.
- The process lookup reads `/proc` or runs `lsof` only when the bind has already failed, so a normal start costs nothing more.
