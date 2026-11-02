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

A workspace's overview SHALL list its projects, each linking to its page, with its counts of tasks in flight and in total and the time of its read when read, or its failure's reason.

#### Scenario: Mixed states

- **GIVEN** a workspace with one project that reads and one that fails
- **WHEN** the overview is requested
- **THEN** the first shows its counts and the time of its read, and the second its reason

### Requirement: A project's page shows its document

A read project's page SHALL show, in this order, tasks in work with their stage, active workstreams, other workstreams, and tasks in no workstream, each workstream opening with `<details>` to its steps and to the tasks whose `workstreams` name it but no step holds, marked as unplaced, and the document's `written_at` and the time of the read. Every task in the document SHALL appear. Status, stage and placement SHALL come from the document alone. A page for a failed project SHALL say so, with the reason.

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

An overview or project page SHALL answer once the reads its request calls for have finished, showing their results, and a read's limit SHALL bound how long it waits. Pages SHALL be sent with `Cache-Control: no-store`, and SHALL carry no script. A request whose `Sec-Fetch-Site` is `cross-site` or `same-site` SHALL be answered 403, so that another site cannot start reads.

#### Scenario: A refresh shows a change

- **GIVEN** an open project page, and a change to the project after it was read
- **WHEN** the page is refreshed
- **THEN** it shows the change

#### Scenario: A read past its limit

- **GIVEN** a request whose read does not finish
- **WHEN** the limit passes
- **THEN** the page answers, with that reason

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
