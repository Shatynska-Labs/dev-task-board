## ADDED Requirements

### Requirement: Several workspaces show as tabs

With more than one workspace, an overview and a project's page SHALL show a tab for each workspace in the order of the settings, each a link to its overview with its name percent-encoded in the address and escaped in the text, the one being shown marked with `aria-current="page"`. With one workspace no tabs SHALL appear, and a project's page SHALL link to its workspace above its heading; with tabs its tab SHALL be that link, and no other SHALL be drawn. The tabs SHALL need no script. Following a tab SHALL read only the projects of the workspace it opens. The list of workspaces at `/` SHALL stay as it is.

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

### Requirement: A page names an account it could not use

Where the document shown, or the latest read past it, ran with no token for its workspace's `github_account`, a project's page and its row on the overview SHALL say so, naming the account, escaped, and never showing a token. The line of what was missed SHALL appear once; a failed read's reason MAY name the account as well.

#### Scenario: No token, nothing held before

- **GIVEN** a project whose only read had no token for `someone`
- **WHEN** its page and overview are requested
- **THEN** each names `someone` and says statuses may be wrong

#### Scenario: No token, a full document held

- **GIVEN** a project keeping a document whose `forge` is `full`, and a later read with no token for `someone`
- **WHEN** its page is rendered
- **THEN** it shows the kept document's tasks, its age, and `someone`

#### Scenario: No token, and the read failed

- **GIVEN** a project with no document, whose read failed with no token for `someone`
- **WHEN** its page and overview are requested
- **THEN** each shows the reason, naming `someone`

#### Scenario: An account's name needing care

- **GIVEN** a read with no token for `<b>`
- **WHEN** its page is rendered
- **THEN** it appears as text

#### Scenario: A token again

- **GIVEN** a project that had no token, and a later full read
- **WHEN** its page is rendered
- **THEN** no account is named
