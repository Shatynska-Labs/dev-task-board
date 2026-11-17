## ADDED Requirements

### Requirement: The settings page

`/settings` SHALL show the projects folder and each workspace: its projects as written, each with a remove button; the repositories found that it does not hold, each with an add button; a field adding a project by name or path; and, on a workspace with no projects only, a button removing it. It SHALL also hold a field adding a workspace and say that saving drops the file's comments. It SHALL need no script, and every other page SHALL link to it.

#### Scenario: Another workspace offers it too

- **GIVEN** workspaces `a` holding `group/one` and `b` holding nothing, and `group/one` found
- **WHEN** `/settings` is requested
- **THEN** `b` offers `group/one` to add, and `a` does not

#### Scenario: Removing a workspace

- **GIVEN** a workspace `a` with projects and a workspace `b` with none
- **WHEN** `/settings` is requested
- **THEN** only `b` has a button removing it

#### Scenario: Linked from every page

- **WHEN** the list of workspaces, an overview and a project's page are requested
- **THEN** each links to `/settings`

#### Scenario: No workspace

- **GIVEN** a board with no workspace
- **WHEN** `/` is requested
- **THEN** it is answered 303 to `/settings`

### Requirement: The settings page finds repositories

A repository found SHALL be a directory that is a child or a grandchild of the projects folder, holding `.git`, not named with a leading `.` nor `node_modules`, and not inside another found, listed by its name relative to the folder, sorted. A missing or unreadable projects folder SHALL list nothing, and the page SHALL say so.

#### Scenario: What is found

- **GIVEN** a projects folder holding `solo/.git`, `group/one/.git`, `group/two/.git`, `group/notes/`, `.hidden/x/.git`, `node_modules/y/.git` and `solo/inner/.git`, and a workspace `work` holding `group/one`
- **WHEN** `/settings` is requested
- **THEN** `work` lists `group/one` with a remove button, and offers `group/two` and `solo` to add, and nothing else

#### Scenario: No projects folder

- **GIVEN** a `projects_dir` that does not exist
- **WHEN** `/settings` is requested
- **THEN** no repository is offered, and the page says the folder could not be read

### Requirement: Saving the settings

A `POST` to `/settings` SHALL carry exactly one action: `workspace` and `add`, `workspace` and `remove`, `add_workspace`, or `remove_workspace`, checked as "A save is checked" states. The board SHALL read the file again, as empty where missing, apply the action keeping every other key, write the file whole by renaming a file written beside it, creating its directory, and answer 303 to its workspace's section, as "A save returns to its workspace" states. Saves SHALL be applied one at a time.

#### Scenario: Adding a found repository

- **GIVEN** a running board with workspace `work` holding `group/one`, and `group/two` found
- **WHEN** `add` of `group/two` to `work` is posted from the page
- **THEN** the answer is 303 to `/settings#workspace-work`, and the file lists `group/one` and `group/two` under `work`, keeping its `port` and `github_account`

#### Scenario: The first save

- **GIVEN** a board started with no settings file
- **WHEN** `add_workspace` of `work` is posted, and then `add` of `group/one` to `work`
- **THEN** the file exists with workspace `work` listing `group/one`

#### Scenario: Removing

- **GIVEN** workspace `work` holding `group/one` and `group/two`, and workspace `old` holding nothing
- **WHEN** `remove` of `group/two` from `work`, then `remove_workspace` of `old`, are posted
- **THEN** the file lists only `group/one`, under `work`, and no `old`

### Requirement: A save is checked

A save SHALL be checked in order, the first failure deciding the answer, the file unchanged: `Sec-Fetch-Site` `same-origin` and `Origin` the board's own, else 403; a body of at most 4096 bytes, else 413; one action's fields exactly, else 400; the result read as at start, else 400 with the fault. An action on a workspace not held, an `add_workspace` of one held, an `add` already held, a `remove` not held, or a `remove_workspace` of a workspace with projects SHALL be answered 400.

#### Scenario: A refused add

- **GIVEN** workspace `work` holding `a/one`, and a directory `b/one`
- **WHEN** `add` of `b/one` to `work` is posted
- **THEN** it is answered 400 naming `one`, and the file is unchanged

#### Scenario: A name that is no directory

- **WHEN** `add` of `group/missing` is posted
- **THEN** it is answered 400 naming it, and the file is unchanged

#### Scenario: Removing a workspace with projects

- **GIVEN** workspace `work` holding `group/one`
- **WHEN** `remove_workspace` of `work` is posted
- **THEN** it is answered 400, and the file is unchanged

#### Scenario: From another site

- **WHEN** a save is posted with `Sec-Fetch-Site` `cross-site`, or with another `Origin`
- **THEN** it is answered 403, and the file is unchanged

#### Scenario: A workspace that is not there, or already is

- **GIVEN** workspace `work`, and no workspace `gone`
- **WHEN** `add` of a project to `gone`, `add_workspace` of `work`, or `remove_workspace` of `gone` is posted
- **THEN** each is answered 400, and the file is unchanged

#### Scenario: Two actions at once

- **WHEN** a body holding both `add_workspace` and `remove_workspace` is posted
- **THEN** it is answered 400, and the file is unchanged

### Requirement: A save returns to its workspace

Each workspace's section on the settings page SHALL have the `id` `workspace-` followed by its name percent-encoded, and a save SHALL answer 303 to `/settings#` and that `id`, or to `/settings` after `remove_workspace`.

#### Scenario: A name needing care

- **GIVEN** a workspace `a b`
- **WHEN** a project is added to it
- **THEN** the answer is 303 to `/settings#workspace-a%20b`, and the page has a section with that `id`

### Requirement: A save that cannot be written

A settings file that exists but cannot be read, or that cannot be written, SHALL answer a save 500 with a page naming the fault, the file and the board's workspaces unchanged. Where `config.toml` is a symbolic link, a save SHALL write its target, and the link SHALL remain.

#### Scenario: A file that cannot be written

- **GIVEN** a settings directory that cannot be written
- **WHEN** `add_workspace` of `new` is posted
- **THEN** it is answered 500 with a page saying the settings could not be saved, and the board shows no workspace `new`

#### Scenario: A linked file

- **GIVEN** a `config.toml` that is a symbolic link to a file elsewhere
- **WHEN** a save is accepted
- **THEN** the link remains, and its target holds the saved settings

## MODIFIED Requirements

### Requirement: Addresses reach workspaces and projects

`/<workspace>` SHALL be a workspace's overview and `/<workspace>/<project>` a project. With one workspace `/` SHALL answer as that workspace, with several SHALL list them, and with none SHALL answer 303 to `/settings`. `/settings` SHALL be the settings page. Links SHALL percent-encode names. Any other address, including one that cannot be decoded, SHALL be answered 404. `/api/` SHALL stay reserved and answer 404 until a later change. A request whose method is not `GET` SHALL be answered 404, except a `POST` to a project's address, which sets a star, and a `POST` to `/settings`, which saves the settings.

#### Scenario: One workspace

- **GIVEN** one workspace `work`
- **WHEN** `/` is requested
- **THEN** it shows the overview of `work`

#### Scenario: Several workspaces

- **GIVEN** workspaces `a` and `b`
- **WHEN** `/` is requested
- **THEN** it links to `/a` and `/b`

#### Scenario: An unknown address

- **WHEN** `/nobody`, `/work/nothing` or `/%E0` is requested
- **THEN** it is answered 404

#### Scenario: Another method

- **WHEN** `/work` is posted to, or `/work/one` or `/settings` is sent a `PUT`
- **THEN** it is answered 404

### Requirement: Document text is escaped

All text from a document, all names from settings, every name found in the projects folder, every read's reason, and every fault and value a save answers with SHALL be escaped on render.

#### Scenario: Markup in a task

- **GIVEN** a task named `<script>alert(1)</script>`
- **WHEN** a page shows it
- **THEN** the markup appears as text, and no `<script>` element from it reaches the page

#### Scenario: Markup in a reason

- **GIVEN** a failed read whose reason holds `<b>`
- **WHEN** a page shows it
- **THEN** it appears as text

#### Scenario: Markup on the settings page

- **GIVEN** a repository found as `<b>x`, and a refused `add` of `<i>y`
- **WHEN** the settings page and the refusal are shown
- **THEN** both appear as text

### Requirement: Several workspaces show as tabs

With more than one workspace, an overview and a project's page SHALL show a tab for each workspace in the order of the settings, each a link to its overview with its name percent-encoded in the address and escaped in the text, the one being shown marked with `aria-current="page"`. With one workspace no tabs SHALL appear, and a project's page SHALL link to its workspace above its heading; with tabs its tab SHALL be that link, and no other SHALL be drawn. The tabs SHALL need no script. Following a tab SHALL start no read. The list of workspaces at `/` SHALL stay as it is, besides its link to the settings page.

#### Scenario: Several workspaces

- **GIVEN** workspaces `a` and `b`
- **WHEN** the overview of `b` is requested
- **THEN** it links to `/a` and `/b`, and only `b` is marked current

#### Scenario: On a project's page

- **GIVEN** workspaces `a` and `b`, and a project `one` in `b`
- **WHEN** `/b/one` is requested
- **THEN** it links to `/a` and `/b`, once each, and only `b` is marked current

#### Scenario: One workspace

- **GIVEN** one workspace `work`
- **WHEN** its overview and a project's page are requested
- **THEN** neither shows tabs, and the project's page links to `/work`

#### Scenario: A name needing care

- **GIVEN** workspaces `a b` and `<c>`
- **WHEN** an overview is requested
- **THEN** the tabs link to `/a%20b` and `/%3Cc%3E`, and `<c>` appears as text

#### Scenario: Another workspace is not read

- **GIVEN** workspaces `a` and `b`
- **WHEN** the overview of `a` is requested
- **THEN** no project of `b` is read
