# Proposal

## Why

A star is a form that posts and is answered by a redirect to the project's page, so every star reloads the page: it is drawn again from its first part, scrolls to the top, closes every block that was open, and, since starred workstreams sort first, moves the workstream just starred elsewhere in the list. The operator reported on 2026-11-15, on `0.14.0`, that these jumps make it hard to see where they just were, most of all in "Other workstreams", where they hold many workstreams and star most often. They asked that a star change nothing but the star, that the order change only on a reload, and that a reload reopen what was open. Neither can be done without a script: a page reloads to post a form, and the server never learns which blocks the browser has open. A frame per star was tried as a no-script alternative and rejected: it loaded each star twice and could not keep open blocks across a reload.

- **Workstream**: `see-my-projects-live`, as a new step before `write-the-settings`. Its decision 1, a refresh that reads, not a page that updates itself, stands; its "pages carry no script" is revised to allow a project's page one script that keeps the view and saves a star, and reads nothing.

## What Changes

- A project's page carries one inline script. Pressing a star sends the stars form's request in the background and turns the star over in place: nothing reloads, no block opens or closes, nothing scrolls, and the order holds until the page is next loaded, which still sorts starred workstreams first.
- Where the background request fails or is refused, the script submits the form as before, so the reason shows as it does now. Without a script the star works as today.
- Leaving a project's page remembers, for that browser tab and that page, which blocks were open and how far the page was scrolled; loading it again reopens those blocks in each part as it arrives, including parts holding blocks the first did not, and returns to that position until the operator scrolls. A block the operator opens or closes while the page is still arriving keeps that state in the parts that follow. With nothing remembered, the page shows as rendered.
- Each part of a project's page shows the stars as kept when that part is drawn, so a star set while the page is arriving is not undone by a later part.
- The overview still carries no script. The server, reads and the stars file are unchanged.
- `README.md` and the workstream's decision 1 say so; the version rises from `0.14.0` to `0.15.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: "A page shows what was read for it", "A project's page shows each read as it arrives" and "A workstream shows its star" allow the project page's script; added "A star is set in place" and "A project's page reopens what was open".

## Impact

- Changed: `src/render.ts`, `src/server.ts`, a new `src/page-script.ts`, their tests, `README.md`, `AGENTS.md` (testing strategy), `docs/workstreams/see-my-projects-live.md`, `package.json`, `package-lock.json`.
- New dev dependency: `happy-dom`, so tests can run the page's script against the page the board renders.
- `workstream-stars` is unchanged: the background request is the same `POST` with the same checks and answers.
