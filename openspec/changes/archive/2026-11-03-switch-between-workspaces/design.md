## Context

`src/settings.ts` refuses `github_account`. `src/reads.ts` spawns the carried tool with the board's own environment. The tool calls `gh pr list` in the project, and `forge` is `none` where that fails. `src/render.ts` draws each page with no knowledge of the other workspaces. See proposal.md for why, and `README.md`'s Architecture for the rules this implements.

Checked against `gh` 2.92.0: `gh auth token --user <name>` prints that account's token, or exits 1 for an account it does not hold, and is not affected by `GH_TOKEN`. `GH_TOKEN` in a process's environment overrides the stored login for it. `GH_CONFIG_DIR=/dev/null/gh` makes `gh pr list` and `gh auth status` exit 1 with `failed to read configuration`, before any login is read, and `gh auth git-credential` is the only credential helper configured for `github.com` here. The tool exports `GIT_TERMINAL_PROMPT=0`, so a fetch cannot wait on a prompt.

## Goals / Non-Goals

**Goals:** moving between workspaces in one click; each workspace reading the forge as its own account; a missing token never falling through to another login.

**Non-Goals:** switching `gh`'s active account; storing tokens; GitHub Enterprise hosts; a remembered last tab; changing what the carried tool reports.

## Decisions

**Tabs are links, in the page header.** Pages carry no script, and each workspace already has an address, so a tab is a link to `/<workspace>`, and the current one has `aria-current="page"`. A project's page marks its workspace, and its tab leads to the overview. A tab opens a workspace's overview, which reads that workspace's projects and no others, as any overview does.

**`/` stays a list.** With several workspaces, redirecting to the first would pick one for the user, and the list is already specified. It needs no tabs of its own, since all it shows is the same links.

**The render functions take the workspaces as a new last argument.** `renderOverview` and `renderProject` gain an optional list of workspace names, so a caller passing none, or one, draws no tabs and existing calls keep their meaning. The alternative, a page context object, would change every call for one field.

**The token is taken per read, inside the read's limit.** `readOnce` is where a project's read starts, so it runs `gh auth token --user <account>` there, and the tool runs for what remains of the limit. Caching it would hold a token in memory and outlive a re-login, and a separate limit would let a read pass the 60 seconds the specification states. The lookup is held in `running`, so stopping the board stops it. Its output is held only until the spawn, and its standard error is discarded, so no token can reach a reason.

**Only a read with a token sets `GH_TOKEN`.** A workspace with no `github_account` runs with the environment as it is today, whatever that holds. With an account, the child gets `GH_TOKEN`, which `gh` prefers to `GITHUB_TOKEN` and to stored logins.

**No token means a `gh` that cannot log in.** The child's environment drops `GH_TOKEN` and `GITHUB_TOKEN` and sets `GH_CONFIG_DIR` to `/dev/null/gh`, a path that can never exist, so `gh` refuses to run and the tool reports `forge` `none` by its own rule. Taking `gh` off `PATH` is the alternative, but the directory holding it commonly holds `git` too, and a directory created to stand empty could be filled by someone else. Any answer but a token counts: `gh` missing, an unknown account, a non-zero exit, or empty output.

**The limit passing during the lookup ends the read.** The lookup is stopped as the tool would be, and the read fails with the limit's reason and no tool started. A tool with no time left can give no document, and starting one would pass the bound. Being stopped ends it the same way.

**The account is carried on the document, and reported by `whatMissed`.** A read with no token sets a field of the board's own, `no_token_for`, on the document it holds. `whatMissed` adds a line naming the account, so `settle`, the kept document's notice, its de-duplication and the overview row all work unchanged. The `forge` line beside it stays true. The alternative, a field on the state, would have to pass through `settle` and `latest` by hand.

**A failed read with no token names the account in its reason.** It has no document to carry the field, so its reason begins `no token for GitHub account <account>: `, which reaches every page a reason reaches. That includes a lookup that passed the limit.

**`github_account` is checked only for its type.** Whether an account exists depends on `gh`'s logins at each read, which can change while the board runs, and is reported on the page. It goes to `gh` as an argument, with no shell between.

## Risks / Trade-offs

- [`git fetch` is not `gh`: a remote over SSH uses the user's keys, whatever the account] → The account governs `gh`, which is what decides `forge`, and HTTPS remotes through `gh`'s credential helper. A fetch failing is already reported.
- [No token leaves an HTTPS remote using `gh`'s helper unable to fetch] → It reports `fetch_failed`. A remote served by another helper, or by SSH, still fetches: what is withheld is access through `gh`, which is what decides `forge`.
- [A project on another host is not reached by a `github.com` token] → `GH_TOKEN` does not apply to an Enterprise host, so it reads as it does today. Out of scope.
- [A full document kept while a token is missing goes on ageing] → The notice names the account, its age and the latest read, and a working token replaces it.
- [A lookup that hangs uses up the read's limit] → The read fails at the limit, with the account named.

## Migration Plan

A settings file that names `github_account` was refused before, so nothing in use changes. The version rise publishes it.
