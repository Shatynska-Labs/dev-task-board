## Context

`README.md`'s Architecture holds the design this step builds part of. This records what this step takes, leaves, and adds. The document's shape is `schema_version` 1 of `vendor/task-board --json`.

## Goals / Non-Goals

**Goals:** a board that starts from settings and shows every project's tasks as they stood at start.

**Non-Goals:** anything after the first read. A restart is the only refresh until `keep-the-page-current`. A failed read has no last document to fall back on, since there is only one read, so `say-what-a-read-missed` adds that. A `forge` other than `full` gets a one-line notice here, and that change decides what stays on the page.

## Decisions

**Modules.** `src/settings.ts`: `parseSettings(text, { home, isDirectory })` returns the workspaces or throws `SettingsError`, and `settingsPath(env, home)` gives the file's place. `src/reads.ts`: `createReads(workspaces, { toolPath, limitMs, graceMs })` holds each project's state in memory, with `start()` and `stop()`. Each project's state is `{ state: "reading" } | { state: "read", document, readAt } | { state: "failed", reason }`, read through `reads.get(workspace, project)`, and `start()` and `stop()` return promises that settle when the reads have finished. `src/render.ts` exports `renderIndex`, `renderOverview`, `renderProject` and `renderNotFound`, pure functions from that state to HTML. `src/server.ts` is the `node:http` routes and the `Host` check, with `startServer(state, port)` returning the bound port. `src/board.ts` checks for `bash`, `git` and `awk`, reads the settings and wires the rest, and `src/cli.ts` parses arguments, handling `--version` before loading `board.ts` by dynamic import, so `--version` needs no dependency. `cli.ts` and `board.ts` alone read `process.env`, the file system's settings file and the real tool's path. No environment variable or flag exposes the tool's path or the limit, since that would be a route to running another program, so tests of a stub tool and a short limit call `createReads` directly.

**`gh` as logged in.** The tool runs with the user's environment. `github_account` is refused until `switch-between-workspaces` builds it, because accepting and ignoring it would read with the wrong account, which is what the field exists to prevent.

**The carried tool's path.** Found from `import.meta.url` as `../vendor/task-board`, so it works from `dist/` in a clone and in `npx`.

**The tool's report.** It writes its report to stderr, and the reason of a refusal is the `Reason:` line. For a non-zero exit `reads.ts` keeps that line, or the last stderr line where there is none. Where stderr is empty the reason names the exit code or signal. Output that cannot be parsed, an unknown version and the limit each have their own reason.

**Stopping a read.** `spawn` with a 60 second timer sending `SIGTERM`, then `SIGKILL` after 5 seconds. The tool's child processes are stopped by running it in its own process group (`detached`) and signalling the group. That keeps Ctrl-C from reaching reads, so the signal handlers are what stop them.

**Counts on the overview.** In flight counts tasks whose `status` is `in_flight`, the document's own word, so this reads a status and derives none.

**Layout.** The accepted page of `scripts/task-board`: the same four sections, `<details>` markup, columns, progress bars and CSS, inline in `src/style.ts`, with no script. The first merge carried simpler markup by mistake, and a fix brought this one in. The `script` waits for `keep-the-page-current`.

**The `Host` check.** Compares with the port actually bound. Ports begin at 1024, so a browser's `Host` always carries one, since it drops `:80`.

**Shutdown.** `SIGINT` and `SIGTERM` close the server and stop running reads with the same grace, then exit zero.

**Version `0.2.0`.** The first with a user-visible board. The release decision reads E404 and publishes nothing until the first publish is done.

**`@types/node` at 24.** Dependabot raised it past the runtime. It stays on the 24 major, with an `ignore` for higher majors in `dependabot.yml`.

## Risks / Trade-offs

- A project of many tasks gives a long read before its page fills; the page says it is being read, and a reload shows the result.
- `npm audit` now covers one runtime dependency.
- Nothing refreshes yet, so a page ages silently but for its `written_at`, which it shows.

## Migration Plan

None: nothing has been published. Rollback is a revert.

## Sequence

`establish-quality-gate` is not archived, since its archive waits on the first publish, so `package` is not yet in `openspec/specs/`. This change's delta to `package` applies only once that archive has synced it, so this change's archive comes after that one. This change's merge does not wait for it.

The operator's first publish stays `0.1.0`, as `establish-quality-gate` confirms. Where this has merged by then, they publish from `c03351a`, the commit before it, rather than from `main`. `release.yml` gains `workflow_dispatch`, so `0.2.0` can then be published by running the workflow once the trusted publisher is set, with no further push to `main`.

## Open Questions

None.
