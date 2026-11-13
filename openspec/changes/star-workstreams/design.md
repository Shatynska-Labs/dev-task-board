# Design

## Context

See `proposal.md` for why. Today the board holds nothing between runs but the settings it reads at start, and nothing between requests but its cache of documents. The server answers `GET` alone; every other method is 404. Pages carry no script and are sent in parts, each a `section.phase`, with a CSS rule hiding all but the last. A workstream is rendered by `renderStream` in `src/render.ts` as a `<details class="group">` whose `<summary>` holds its name, summary line, counts and progress bar. Workstreams are ordered in `renderDocument` by latest commit, then name.

## Goals / Non-Goals

**Goals**: a star set from the page, kept across refreshes, restarts and upgrades, with no script on the page and no write to any repository.

**Non-Goals**:

- Stars on the overview. The overview shows projects, not workstreams.
- Stars on tasks or backlog entries. Only workstreams were asked for.
- Pruning stars of workstreams that have been archived. They are not shown, since only workstreams the document names are rendered, and they cost a line each.
- Several boards running at once sharing a stars file safely. One board per machine is the use; the last write wins.

## Decisions

**1. A state file, not the settings and not the repository.** The operator, 2026-11-13, choosing between three options. Stars in the repository would need the carried tool to report them and a commit for each, and would be shared where the star is personal. Stars in `config.toml` would make the board rewrite a file the user writes, losing comments and formatting. A separate file under `$XDG_STATE_HOME` is what that directory is for: state an application keeps, which a user may still read or edit by hand.

**2. Keyed by the project's resolved path, not by workspace and address.** A project is the same repository whichever workspace lists it, and its address is only its directory's base name, which two workspaces may share for different repositories. The path is the one settings resolves. Moving a repository loses its stars, which is acceptable for a mark set with one click.

**3. The file's shape.** `{"version": 1, "stars": {"<path>": ["<workstream>", …]}}`, names sorted, paths with no star left removed. It is written to a temporary file in the same directory and renamed over the old one, so a crash leaves the old file or the new one, never half of either. The directory is created when first written. A missing file is no stars. A file that is not JSON, not an object of `version` `1` whose `stars` maps strings to arrays of strings, refuses the start with a message naming the file, as bad settings do, so a hand edit gone wrong is not silently overwritten at start. Order, repeats and empty lists are not validated: they are normalised by the next write. The file is read at start only, so a hand edit made while the board runs is overwritten by the next star; `README.md` says to edit it with the board stopped.

**4. Setting, not toggling.** The form says which state is wanted: a button named `star` or `unstar` whose value is the workstream's name. A request sent twice, or from a page that is out of date, leaves the star as asked rather than flipping it back.

**5. One form per page, buttons pointing at it.** A `<summary>` may hold phrasing content only, and a `<form>` is not phrasing content, while a `<button>` is. The project page's start, which is sent once whatever phases follow, holds one empty `<form id="stars" method="post" action="/<workspace>/<project>">`, and each workstream's summary holds a `<button form="stars" name="star|unstar" value="<name>">`. Every phase's buttons reach the same form.

**6. Post, then redirect to the page.** The `POST` starts no read: it checks the workstream against the held document and answers `303 See Other` to `/<workspace>/<project>#<workstream>`, so a refresh afterwards repeats the `GET`, not the `POST`, and the browser returns to the workstream starred. That `GET` reads the project, as every project page does; a star costs what a refresh costs. Today the quick and full parts both give a workstream its `id`, and the first, in the part hidden later, wins, so neither the fragment nor the in-work rows' links reach the shown workstream; the quick part therefore renders no workstream `id`. Answering the `POST` with the page itself would avoid the read but leave the browser offering to resend the form on every refresh.

**7. A stricter guard for the one write.** Every request already passes the `Host` check and is refused where `Sec-Fetch-Site` is `cross-site` or `same-site`. A `POST` must also carry `Sec-Fetch-Site: same-origin` and an `Origin` of `http://<the request's Host>`; a request missing either is refused 403. A form posted from another site is a simple request that needs no preflight, so the absence of a header cannot be read as safety here as it is for a read. The body is `application/x-www-form-urlencoded`, at most 4 KiB, holding exactly one field, `star` or `unstar`, whose value is a workstream named in the project's held document; anything else is answered 400, a longer body 413, and an unknown workspace, project or workstream 404. The checks run in a stated order, the first failing deciding the answer: an address that is not a project 404, then the guard 403, then 413, 400 and an unknown workstream 404. Checking the address first keeps every other `POST` at 404, as every other method is; that a cross-site caller learns whether a project name exists matters nothing on a local board. Nothing a request carries reaches a path on disk.

**8. Within its section, ahead of the rest.** A starred workstream that has nothing in work stays under "Other workstreams", which is collapsed, and comes first there. Moving starred workstreams into a section of their own was considered and left: the sections say whether work is happening, and a star should not hide that. The operator can revisit this once stars have been used.

**9. A view preference is not editing a task.** The Non-Goal "Editing tasks from the page" stands: a star changes nothing a project's repository holds, and the `backlog` skill still changes tasks. `README.md` says so beside the Non-Goal, and Technology's "no state beyond a cache" becomes "no state beyond a cache and the stars".

**10. Where it lives in code.** `src/stars.ts` exports `starsPath(env, home)`, `loadStars(path)` and a `Stars` object with `starred(projectPath): Set<string>` and `set(projectPath, workstream, on): Promise<void>`, which writes before it changes what it holds, so a failed write changes nothing. Sets are chained one after another, each computing the file from the result of the last, and each writes its own uniquely named temporary file, so overlapping requests lose no star. `startBoard` loads it beside the settings and passes it to `startServer` in `BoardState`. The render functions take the starred set for the project, so rendering stays a function of its inputs.

## Risks / Trade-offs

- [A star triggers a full read of the project, up to its 60-second limit] → The page shows what `git` gives within seconds, as it does on any refresh.
- [Two boards on one machine overwrite each other's stars] → Out of scope; the file is valid whichever write lands last.
- [A browser that sends no `Sec-Fetch-Site` or `Origin` cannot star] → Every browser the board targets sends both on a form `POST`; the refusal is the safe failure.
- [A star kept for a workstream that was renamed is lost to the new name] → It is set again with one click.

## Migration Plan

None: with no stars file the board starts with no stars. Rolling back to `0.11.0` ignores the file.
