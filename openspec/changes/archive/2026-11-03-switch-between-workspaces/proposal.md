## Why

Several workspaces already have addresses, but moving between them means going back to a list, so a pinned tab does not hold them together. And `github_account` is refused, so a workspace whose repositories need a login other than the active one reads the forge as the wrong account or not at all. `README.md`'s Scope and Architecture already say what both should do.

- **Workstream**: `see-my-projects-live`, of which this is the fifth step.

## What Changes

- With more than one workspace, an overview and a project's page show a tab for each workspace, linking to its overview, with the current one marked. With one workspace there are no tabs. `/` keeps listing them.
- A workspace may name `github_account`, a non-empty string. Anything else in that field refuses the start.
- A read for such a workspace takes the account's token from `gh auth token --user` and gives it to that read's tool alone as `GH_TOKEN`. The token is taken for each read, and is never stored or logged. The active login does not change.
- Where the token cannot be had, the read runs with no access through `gh` rather than falling through to the active login, and the page names the account, whether that read gives a document or fails.
- `README.md`'s Status stops saying `github_account` is refused, and Running it shows the field.
- The version rises to `0.5.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `settings`: `github_account` is accepted, and refused only when it is not a non-empty string.
- `project-reads`: a read uses its workspace's account, or no access through `gh`.
- `board-pages`: tabs between workspaces, and a notice naming an account that could not be used.

## Impact

- Changed: `src/settings.ts`, `src/reads.ts`, `src/render.ts`, `src/server.ts`, `src/style.ts`, their tests, `README.md`, `package.json`, `package-lock.json`.
- No dependency is added, and the carried tool does not change.
- The token reaches a child process's environment, and nowhere else.
- Not here: the setup command (`write-the-settings`), any host but `github.com`, and making `git` itself authenticate as the account over SSH.
