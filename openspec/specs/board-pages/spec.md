# board-pages Specification

## Purpose

The local server, its addresses, and what its overview and project pages show from each project's document.

## Requirements

### Requirement: The server is local and refuses other hosts

The server SHALL bind `127.0.0.1`, on port 8766 or the one `--port` gives, SHALL print its address on standard output once listening, and SHALL answer 403 to a request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`, the port being the one bound. A port in use, or one that cannot be bound, SHALL refuse the start with a message naming it.

#### Scenario: An unexpected host

- **WHEN** a request arrives with `Host` `evil.example`, `evil.example:<port>` or `127.0.0.1:<another port>`
- **THEN** it is answered 403

#### Scenario: The expected hosts

- **WHEN** a request arrives with `Host` `127.0.0.1:<port>` or `localhost:<port>`
- **THEN** it is answered normally

#### Scenario: A port in use

- **GIVEN** the port is taken
- **WHEN** the command starts
- **THEN** it exits non-zero, naming the port

### Requirement: Addresses reach workspaces and projects

`/<workspace>` SHALL be a workspace's overview and `/<workspace>/<project>` a project. With one workspace `/` SHALL answer as that workspace, and with several SHALL list them. Links SHALL percent-encode names. Any other address, including one that cannot be decoded, SHALL be answered 404. `/api/` SHALL stay reserved and answer 404 until a later change.

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

### Requirement: A project's page shows its document

A read project's page SHALL show, in this order, tasks in work with their stage, active workstreams, other workstreams, and tasks in no workstream, each workstream opening with `<details>` to its steps and to the tasks whose `workstreams` name it but no step holds, marked as unplaced, and the time of the read, as `Read` and its date and time alone, beside the project's name, or under it on a narrow page. The page SHALL NOT show the document's `written_at`, nor the trunk's ref or commit. Every task in the document SHALL appear. Status, stage and placement SHALL come from the document alone. A page for a failed project SHALL say so, with the reason.

#### Scenario: The sections

- **GIVEN** a document fixture with a task in flight, an active workstream, an inactive one, a task in none and an unplaced task naming the active workstream
- **WHEN** the project's page is requested
- **THEN** each appears in its section, in that order, the workstream's steps are inside `<details>`, and the unplaced task is inside it, marked

#### Scenario: A project with no workstreams

- **GIVEN** a document with no workstreams
- **WHEN** the project's page is requested
- **THEN** its tasks are shown, and no workstream section appears

#### Scenario: The time of the read

- **GIVEN** a project read at `2026-11-01T22:18:05.123Z`
- **WHEN** its page is rendered
- **THEN** it shows `2026-11-01 22:18:05 UTC`

#### Scenario: Only the time of the read

- **GIVEN** a document with `written_at` `2026-11-01T22:17:44Z` and a trunk of ref `origin/main` and commit `2cc5bd8`, read at `2026-11-01T22:18:05.123Z`
- **WHEN** its page is rendered
- **THEN** it shows `Read 2026-11-01 22:18:05 UTC`, and neither `22:17`, `written`, `origin/main` nor `2cc5bd8`

### Requirement: A partial forge read is noticed

A project page, and its row on the overview, SHALL say in one line that statuses may be wrong where the document's `forge` is not `full`.

#### Scenario: No forge

- **GIVEN** a document whose `forge` is `none`
- **WHEN** its page and overview are requested
- **THEN** each shows the notice

#### Scenario: A full forge

- **GIVEN** a document whose `forge` is `full`, kept past no later read
- **WHEN** its page is requested
- **THEN** no notice appears

### Requirement: Document text is escaped

All text from a document, all names from settings, and every read's reason SHALL be escaped on render.

#### Scenario: Markup in a task

- **GIVEN** a task named `<script>alert(1)</script>`
- **WHEN** a page shows it
- **THEN** the markup appears as text, and no `<script>` element from it reaches the page

#### Scenario: Markup in a reason

- **GIVEN** a failed read whose reason holds `<b>`
- **WHEN** a page shows it
- **THEN** it appears as text

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

### Requirement: A page says what a read missed

A project's page, and its row on the overview, SHALL say each of these that holds of the document shown, in the tool's terms: `trunk.state` `fetch_failed`, that the trunk may be stale; `trunk.state` `no_origin`, that the project has no remote named origin and the current branch was read; `remote_branches_read` false, that remote branches were not read. A document with none of these and a `forge` of `full`, kept past no later read, SHALL show no such notice.

#### Scenario: A full read with a failed fetch

- **GIVEN** a document whose `forge` is `full`, `trunk.state` `fetch_failed` and `remote_branches_read` false
- **WHEN** its page and overview are requested
- **THEN** each says the trunk may be stale and remote branches were not read, and neither says statuses may be wrong

#### Scenario: No remote

- **GIVEN** a document whose `trunk.state` is `no_origin` and `trunk.branch` `work`
- **WHEN** its page is requested
- **THEN** it says there is no remote named origin and that `work` was read

#### Scenario: Nothing missed

- **GIVEN** a document whose `forge` is `full`, `trunk.state` `fetched` and `remote_branches_read` true
- **WHEN** its page and overview are requested
- **THEN** no notice appears

### Requirement: A page marks a kept document

Where a project keeps a document through a later read, its page and its overview row SHALL show that document with the time of its read, its age at the latest read, the time of the latest read, and that read's reason or everything it missed, escaped. Each thing missed SHALL appear once, whether the document shown or the latest read missed it, or both. The age SHALL be given in whole minutes, hours or days, the largest that fits, or as under a minute.

#### Scenario: Kept through a failure

- **GIVEN** a project keeping a document read at `2026-11-01T22:18:05.000Z`, and a read at `2026-11-01T22:48:10.000Z` that failed with the reason `<b>no`
- **WHEN** its page is rendered
- **THEN** it shows the document's tasks, `2026-11-01 22:18:05 UTC`, `30 min`, `2026-11-01 22:48:10 UTC`, and the reason as text

#### Scenario: Kept on the overview

- **GIVEN** the same project in a workspace
- **WHEN** the overview is rendered
- **THEN** its row shows the document's counts, the time of its read, its age and the reason

#### Scenario: Kept through an outage

- **GIVEN** a project keeping a document whose `forge` is `full`, and a later read with `forge` `none`, `trunk.state` `fetch_failed` and `remote_branches_read` false
- **WHEN** its page is rendered
- **THEN** it shows the document's tasks, each of the three things missed, and no `merge_unchecked` mark from the later read

#### Scenario: Missed by both

- **GIVEN** a project keeping a document whose `forge` is `full` and `trunk.state` `fetch_failed`, and a later read with `forge` `none` and `trunk.state` `fetch_failed`
- **WHEN** its page is rendered
- **THEN** it says once that the trunk may be stale

#### Scenario: The units of an age

- **GIVEN** kept documents 20 seconds, 59 minutes, 3 hours and 2 days older than the latest read
- **WHEN** their pages are rendered
- **THEN** they show `under a minute`, `59 min`, `3 h` and `2 d`

#### Scenario: A document shown new

- **GIVEN** a project whose latest read replaced its document
- **WHEN** its page is rendered
- **THEN** it marks nothing as kept

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
