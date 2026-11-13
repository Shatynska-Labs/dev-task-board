# Tasks

## 1. Stars

- [ ] 1.1 Add `src/stars.ts`: `starsPath(env, home)` from `XDG_STATE_HOME` or `~/.local/state`; `loadStars(path)`, a missing file being no stars and a bad one throwing an error naming the file and the reason; a `Stars` object with `starred(projectPath)` and `set(projectPath, workstream, on)`, which writes the sorted file through a uniquely named temporary file renamed over it, creating the directory, before changing what it holds, with sets chained one at a time; validate types and `version` on load and normalise order, repeats and empty lists on write; verify with the derived tests for "Stars are kept on this machine" and "A bad stars file refuses the start".
- [ ] 1.2 In `src/board.ts`, load the stars at start beside the settings, refusing the start on a bad file as bad settings do, and pass them to the server in `BoardState`; verify with the derived tests for "A bad stars file refuses the start".

## 2. Pages

- [ ] 2.1 In `src/render.ts`, take the project's starred set; order each section's workstreams starred first, then by latest commit and name; put a star button in each workstream's summary naming the form `stars`; put the one empty `<form id="stars" method="post">` in the project page's start; render the quick part with no workstream `id`; add the page for a star that could not be saved, its reason escaped. Style the button in `src/style.ts`. Verify with the derived tests for "Workstreams are ordered by their latest commit", "A workstream shows its star" and "Only the last part carries workstream ids".
- [ ] 2.2 In `src/server.ts`, answer `POST /<workspace>/<project>`, starting no read, in the spec's order: 404 for an address that is not a project, then refuse 403 without `Sec-Fetch-Site: same-origin` and a matching `Origin`, 413 over 4096 bytes, 400 for a body that is not one `star` or `unstar` field, 404 for a workstream the held document does not name, 500 with the page when the write fails, and otherwise set the star and answer 303 to the project's page at the workstream; keep every other non-`GET` 404; verify with the derived tests for "The page sets a star", "Only the board's own page sets a star" and "Addresses reach workspaces and projects".

## 3. Record and release

- [ ] 3.1 In `README.md`, state beside the Non-Goal "Editing tasks from the page" that a star is a view preference kept by the board, add the stars file to Technology and Architecture, saying to edit it with the board stopped, and the write route to Server, and describe starring under Status; verify by reading it against `design.md`.
- [ ] 3.2 Raise the version from `0.11.0` to `0.12.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.
