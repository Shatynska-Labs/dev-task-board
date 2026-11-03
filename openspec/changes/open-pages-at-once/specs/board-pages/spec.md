## MODIFIED Requirements

### Requirement: The overview shows each project's state

A workspace's overview SHALL list its projects, each linking to its page, with what the board holds for it when the overview is requested: its counts of tasks in flight and in total and the time of its read when read, that it is being read, or its failure's reason.

#### Scenario: Mixed states

- **GIVEN** a workspace with one project that reads and one that fails
- **WHEN** the overview is requested
- **THEN** the first shows its counts and the time of its read, and the second its reason

#### Scenario: An overview while a project is read

- **GIVEN** a workspace with one project being read
- **WHEN** the overview is requested
- **THEN** it answers before that read ends, saying the project is being read

### Requirement: A page shows what was read for it

An overview SHALL answer at once, from what the board holds. A project's page SHALL begin its answer before its reads end, and SHALL end it once its full read has finished, showing that read's result, and a read's limit SHALL bound how long it waits. Pages SHALL be sent with `Cache-Control: no-store`, and SHALL carry no script. A request whose `Sec-Fetch-Site` is `cross-site` or `same-site` SHALL be answered 403, so that another site cannot start reads.

#### Scenario: A refresh shows a change

- **GIVEN** an open project page, and a change to the project after it was read
- **WHEN** the page is refreshed
- **THEN** it shows the change

#### Scenario: A read past its limit

- **GIVEN** a request whose read does not finish
- **WHEN** the limit passes
- **THEN** the page ends, with that reason

#### Scenario: A request from another site

- **GIVEN** a request for a page with `Sec-Fetch-Site` `cross-site` or `same-site`
- **WHEN** it arrives
- **THEN** it is answered 403, and no read starts

#### Scenario: A request from the reader

- **WHEN** a page is requested with `Sec-Fetch-Site` `none` or `same-origin`, or with no such header
- **THEN** it is answered normally

#### Scenario: Not cached

- **WHEN** a page is requested
- **THEN** its answer carries `Cache-Control: no-store`

### Requirement: Several workspaces show as tabs

With more than one workspace, an overview and a project's page SHALL show a tab for each workspace in the order of the settings, each a link to its overview with its name percent-encoded in the address and escaped in the text, the one being shown marked with `aria-current="page"`. With one workspace no tabs SHALL appear, and a project's page SHALL link to its workspace above its heading; with tabs its tab SHALL be that link, and no other SHALL be drawn. The tabs SHALL need no script. Following a tab SHALL start no read. The list of workspaces at `/` SHALL stay as it is.

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

## ADDED Requirements

### Requirement: A project's page shows each read as it arrives

A project's page SHALL be sent in parts: first the head, the tabs and the heading with a part saying the project is being read; then, where the quick read ends before the full one, a part showing its document, marked as read from `git` alone with GitHub still being read, so that statuses may be wrong; and last a part showing what the project holds once the full read has settled, as a page shows it today. Each part SHALL be a `section` of class `phase`, and the page's style SHALL hide every `phase` followed by another, so that only the latest is seen. A quick read that fails, or ends after the full read, SHALL add no part. The page SHALL carry no script.

#### Scenario: The first part comes at once

- **GIVEN** a project whose reads do not end
- **WHEN** its page is requested
- **THEN** the tabs, the heading and a part saying it is being read arrive before the reads end

#### Scenario: Quick, then full

- **GIVEN** a project whose quick read ends before its full read
- **WHEN** its page is requested
- **THEN** the response holds the being-read part, then the quick document marked as from `git` alone, then the full document, in that order

#### Scenario: Full first

- **GIVEN** a project whose full read ends before its quick read
- **WHEN** its page is requested
- **THEN** the response holds the being-read part and then the full document, and no quick part

#### Scenario: A quick read that fails

- **GIVEN** a project whose quick read fails and whose full read succeeds
- **WHEN** its page is requested
- **THEN** no part says the quick read failed

#### Scenario: Only the latest is seen

- **WHEN** any page is requested
- **THEN** its style holds `.phase:has(~ .phase)` with `display: none`, and it carries no `<script>`
