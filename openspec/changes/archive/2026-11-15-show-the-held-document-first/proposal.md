# Proposal

## Why

Each request for a project's page reads the project, and the page's first part says only that the project is being read, so for the seconds until `git` has been read the page shows a heading and nothing else. The operator found this on 2026-11-15 while starring workstreams on `0.12.0`: a star is answered by a redirect to the project's page, so every star blanks the page for those seconds. The same happens on every refresh. The board already holds the last document it read, and showing it in the first part keeps the page filled while it is read again.

- **Workstream**: `see-my-projects-live`, whose goal is a tab that shows each project's tasks on refresh; its decision 1, a refresh that reads, not a page that updates itself, stands, and its wording "so the wait shows what `git` gives first" is revised to name the held document shown before it.

## What Changes

- Where the board holds a document for the project, the first part of its page shows that document, with its stars, under a line saying when it was read and that the project is being read again. Where it holds none, the first part says the project is being read, as today.
- The parts that follow are unchanged: the quick read's part where it ends first, then the full read's.
- The held part, like the quick one, carries no workstream ids, so links and the address after a star still reach the last part.
- `README.md` says so under Status. The version rises from `0.13.0` to `0.14.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: "A project's page shows each read as it arrives" — the first part shows the held document where there is one.

## Impact

- Changed: `src/render.ts`, `src/server.ts`, their tests, `README.md`, `package.json`, `package-lock.json`.
- Reads, stars, settings and the carried tool are unchanged. The page carries no script.
