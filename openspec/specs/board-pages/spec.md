# board-pages Specification

## Purpose

The local server, its addresses, and what its overview and project pages show from each project's document.

## Requirements

### Requirement: The server is local and refuses other hosts

The server SHALL bind `127.0.0.1`, on the port the command is given or the one accepted as "In a terminal, another port is offered" states, SHALL print its address on standard output once listening, and SHALL answer 403 to a request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`, the port being the one bound. A port that cannot be bound for any reason but being in use SHALL refuse the start with a message naming it. A port in use SHALL be handled as the requirements below state.

#### Scenario: An unexpected host

- **WHEN** a request arrives with `Host` `evil.example`, `evil.example:<port>` or `127.0.0.1:<another port>`
- **THEN** it is answered 403

#### Scenario: The expected hosts

- **WHEN** a request arrives with `Host` `127.0.0.1:<port>` or `localhost:<port>`
- **THEN** it is answered normally

#### Scenario: A port in use

- **GIVEN** the port is taken by a program that is not a board
- **WHEN** the command starts without a terminal
- **THEN** it exits non-zero, naming the port

### Requirement: Addresses reach workspaces and projects

`/<workspace>` SHALL be a workspace's overview and `/<workspace>/<project>` a project. With one workspace `/` SHALL answer as that workspace, and with several SHALL list them. Links SHALL percent-encode names. Any other address, including one that cannot be decoded, SHALL be answered 404. `/api/` SHALL stay reserved and answer 404 until a later change. A request whose method is not `GET` SHALL be answered 404, except a `POST` to a project's address, which sets a star.

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

- **WHEN** `/work` is posted to, or `/work/one` is sent a `PUT`
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

A read project's page SHALL show, in this order, tasks in work with their stage, active workstreams, other workstreams, and tasks in no workstream, each workstream opening with `<details>` to its steps and to the tasks whose `workstreams` name it but no step holds, marked as unplaced, and the time of the read, as `Read` and its date and time alone, at the right of the project's name and level with it, below the tabs where they take one line, on a narrow page too. The heading — the tabs or the workspace's link, the name and the time of the read — SHALL stay at the top of the window while the page scrolls, over a fade into the page below it, and SHALL need no script; a link to an element of the page SHALL bring that element into view below it. The page SHALL NOT show the document's `written_at`, nor the trunk's ref or commit. Every task in the document SHALL appear. Status, stage and placement SHALL come from the document alone. A page for a failed project SHALL say so, with the reason.

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

#### Scenario: The heading stays in view

- **WHEN** a project's page is requested
- **THEN** its style holds the project's heading with `position: sticky` and `top: 0`, and its read time with `position: fixed`, and the page holds no script for either

#### Scenario: A link lands below the heading

- **WHEN** a project's page is requested
- **THEN** its style gives every element with an `id` a `scroll-margin-top` at least as tall as the heading

#### Scenario: The time level with the name

- **GIVEN** a project's page, with tabs taking one line and without
- **WHEN** it is shown in a browser, at a wide window and a narrow one
- **THEN** the read time's top is the name's, at the right, below the tabs' line

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

An overview SHALL answer at once, from what the board holds. A project's page SHALL begin its answer before its reads end, and SHALL end it once its full read has finished, showing that read's result, and a read's limit SHALL bound how long it waits. Pages SHALL be sent with `Cache-Control: no-store`. An overview SHALL carry no script; a project's page SHALL carry only its own script, as "A star is set in place" and "A project's page reopens what was open" state, which SHALL start no read and request no page of its own; its fallback submits the stars form, as a page with no script would. A request whose `Sec-Fetch-Site` is `cross-site` or `same-site` SHALL be answered 403, so that another site cannot start reads.

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

#### Scenario: Only a project's page has a script

- **WHEN** an overview and a project's page are requested
- **THEN** the overview holds no `<script>`, and the project's page holds no script but its own

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

A project's page SHALL be sent in parts: first the head, the tabs and the heading with a part showing what the project holds, as "The first part shows what is held" states; then, where the project held no read document when its page was requested and the quick read ends before the full one, a part showing its document, marked as read from `git` alone with GitHub still being read, so that statuses may be wrong; and last a part showing what the project holds once the full read has settled, as a page shows it today. Each part SHALL be a `section` of class `phase`, and the page's style SHALL hide every `phase` followed by another, so that only the latest is seen. A quick read that fails, or ends after the full read, SHALL add no part.

#### Scenario: The first part comes at once

- **GIVEN** a project whose reads do not end
- **WHEN** its page is requested
- **THEN** the tabs, the heading and the first part arrive before the reads end

#### Scenario: Quick, then full

- **GIVEN** a project holding no document, whose quick read ends before its full read
- **WHEN** its page is requested
- **THEN** the response holds the first part, then the quick document marked as from `git` alone, then the full document, in that order

#### Scenario: Full first

- **GIVEN** a project holding no document, whose full read ends before its quick read
- **WHEN** its page is requested
- **THEN** the response holds the first part and then the full document, and no quick part

#### Scenario: A quick read that fails

- **GIVEN** a project holding no document, whose quick read fails and whose full read succeeds
- **WHEN** its page is requested
- **THEN** no part says the quick read failed

#### Scenario: A held document, no quick part

- **GIVEN** a project holding a document, whose full read ends after a quick read would have
- **WHEN** its page is requested
- **THEN** the response holds the first part and then the full document, and no part marked as from `git` alone

#### Scenario: Only the latest is seen

- **WHEN** any page is requested
- **THEN** its style holds `.phase:has(~ .phase)` with `display: none`

### Requirement: A task's row shows its kind and need

On a project's page, each row of a task in a workstream or in no workstream SHALL show, in columns headed `Kind`, `Need` and `Waits` between the task and its last commit, the task's `kind` and `need` from the document, neither for a task whose status is `done` or for a value that is `null`. A task whose `need` is `could` and whose status is not `done` SHALL have its name and description dimmed. Below 640px the three columns SHALL fold under the task.

#### Scenario: Kind and need

- **GIVEN** a task `t` with `status` `recorded`, `kind` `fix` and `need` `must`
- **WHEN** its project's page is rendered
- **THEN** its row shows `fix` and `must`, and the row's head shows `Kind`, `Need` and `Waits`

#### Scenario: A done task

- **GIVEN** a task with `status` `done`, `kind` `change` and `need` `should`
- **WHEN** its project's page is rendered
- **THEN** its row shows no kind, no need and nothing under `Waits`

#### Scenario: A could task

- **GIVEN** a task with `status` `recorded` and `need` `could`
- **WHEN** its project's page is rendered
- **THEN** its row is marked dimmed

### Requirement: A task's row shows what it waits on

A row's `Waits` SHALL show `ready` where the task's `readiness` is `ready`. Otherwise it SHALL show one mark per name in `waits_on`, struck through where `waits_on_done` holds it; one mark per value in `waits_for_type`, reading `your decision` for `decision`; one mark where `waits_for` is set and `waits_for_type` is empty; a `parked` mark where `priority` is `parked`; and the `waits_for` condition, cut to one line and given in full as a title. A done task SHALL show nothing under `Waits`.

#### Scenario: A ready task

- **GIVEN** a task with `readiness` `ready` and nothing in `waits_on` or `waits_for`
- **WHEN** its project's page is rendered
- **THEN** its row shows `ready`

#### Scenario: Waits on names, one done

- **GIVEN** a task with `waits_on` `["a", "b"]`, `waits_on_done` `["a"]` and `readiness` `blocked`
- **WHEN** its project's page is rendered
- **THEN** its row shows `a` struck through and `b` not, neither shows `ready`, and no note reads `Waits on`

#### Scenario: A typed condition

- **GIVEN** a task with `waits_for` `the operator's choice of model`, `waits_for_type` `["decision", "access"]` and `readiness` `waiting`
- **WHEN** its project's page is rendered
- **THEN** its row shows `your decision`, `access` and the condition, escaped

#### Scenario: An untyped condition

- **GIVEN** a task with `waits_for` `the head's answer`, `waits_for_type` `[]` and `readiness` `waiting`
- **WHEN** its project's page is rendered
- **THEN** its row shows one mark for the wait and the condition

#### Scenario: Markup in a wait

- **GIVEN** a task with `waits_on` `["<b>x</b>"]` and `waits_for` `<i>y</i>`
- **WHEN** its project's page is rendered
- **THEN** both appear as text

### Requirement: A wait already met stays visible

Beside `ready`, a row SHALL show a mark, struck through, for each name in `waits_on_done`, so that a wait already met stays visible until its entry is updated.

#### Scenario: A wait already met

- **GIVEN** a task with `waits_on` `["a"]`, `waits_on_done` `["a"]`, no `waits_for` and `readiness` `ready`
- **WHEN** its project's page is rendered
- **THEN** its row shows `ready` and `a` struck through

### Requirement: A wait is shown once

`waits_on` SHALL NOT appear among a row's notes, and `parked` SHALL NOT appear as a tag beside its name, since `Waits` shows them; any other priority than `normal` SHALL keep its tag. A document without the new keys SHALL render, with no kind, no need and no `ready`; its `waits_on` and `parked` marks still show.

#### Scenario: A parked task

- **GIVEN** a task with `priority` `parked`, `parked_until` `the API is public` and `readiness` `parked`
- **WHEN** its project's page is rendered
- **THEN** its row shows `parked` under `Waits` with `the API is public` as its title, and no `parked` tag beside its name

#### Scenario: A high task

- **GIVEN** a task with `priority` `high`
- **WHEN** its project's page is rendered
- **THEN** a `high` tag stays beside its name

#### Scenario: A document from an older tool

- **GIVEN** a task with none of `kind`, `need`, `waits_for`, `waits_for_type`, `parked_until`, `waits_on_done` or `readiness`
- **WHEN** its project's page is rendered
- **THEN** the page renders, and its row shows no kind, no need and no `ready`

### Requirement: A workstream counts its open steps

A workstream's summary on a project's page SHALL show, over its steps whose status is not `done`, the number whose `need` is `must` as `N must left`, whose `readiness` is `ready` as `N ready`, `blocked` as `N blocked by a task`, `waiting` with `decision` among `waits_for_type` as `N wait for your decision`, `waiting` without it as `N wait for someone else`, and `parked` as `N parked`, in that order, leaving out each count that is zero. The workstream's own summary SHALL still show.

#### Scenario: Mixed steps

- **GIVEN** a workstream with summary `s` and steps: one done with `need` `must`; one with `need` `must` and `readiness` `ready`; one `blocked`; one `waiting` with `waits_for_type` `["decision"]`; one `waiting` with `waits_for_type` `["answer"]`
- **WHEN** its project's page is rendered
- **THEN** its summary shows `s`, then `1 must left`, `1 ready`, `1 blocked by a task`, `1 wait for your decision` and `1 wait for someone else`, in that order, and no `parked` count

#### Scenario: Nothing open

- **GIVEN** a workstream whose steps are all done
- **WHEN** its project's page is rendered
- **THEN** no count appears

### Requirement: Workstreams are ordered by their latest commit

On a project's page, the workstreams in the active-workstreams section, and those in the other-workstreams section, SHALL each be ordered with the starred workstreams first and the rest after them; within each of those two groups, by the greatest `last_commit`, a time in Unix seconds, among their tasks, newest first; a workstream's tasks are those its `steps` name and those whose `workstreams` name it but no step holds. A `last_commit` that is absent or `null` counts as none, and a workstream with none SHALL follow every workstream with one in its group. Ties, including workstreams with none, SHALL be ordered by name in code-unit order, as the document orders names. A star SHALL NOT move a workstream between sections.

#### Scenario: Newest first

- **GIVEN** inactive workstreams `alpha`, whose step's task has `last_commit` 100, and `beta`, whose step's task has `last_commit` 200
- **WHEN** their project's page is rendered
- **THEN** `beta` appears before `alpha` among the other workstreams

#### Scenario: The latest of several tasks

- **GIVEN** inactive workstream `alpha` with step tasks of `last_commit` 100 and 300, and inactive workstream `beta` with one step task of `last_commit` 200
- **WHEN** their project's page is rendered
- **THEN** `alpha` appears before `beta`

#### Scenario: An unplaced task counts

- **GIVEN** inactive workstream `alpha` whose step's task has `last_commit` 100 and a task of `last_commit` 300 whose `workstreams` name `alpha` but no step holds, and inactive workstream `beta` whose step's task has `last_commit` 200
- **WHEN** their project's page is rendered
- **THEN** `alpha` appears before `beta`

#### Scenario: No commit comes last

- **GIVEN** inactive workstream `alpha` whose step's task has `last_commit` `null`, and inactive workstream `beta` whose step's task has `last_commit` 100
- **WHEN** their project's page is rendered
- **THEN** `beta` appears before `alpha`

#### Scenario: Equal commits by name

- **GIVEN** inactive workstreams `beta` and `alpha`, in that order in the document, whose step tasks both have `last_commit` 100
- **WHEN** their project's page is rendered
- **THEN** `alpha` appears before `beta`

#### Scenario: No commits by name

- **GIVEN** inactive workstreams `beta` and `alpha`, in that order in the document, none of whose tasks has a `last_commit`
- **WHEN** their project's page is rendered
- **THEN** `alpha` appears before `beta`

#### Scenario: Active workstreams are ordered too

- **GIVEN** active workstreams `alpha`, whose step's task has `last_commit` 100, and `beta`, whose step's task has `last_commit` 200, in that order in the document
- **WHEN** their project's page is rendered
- **THEN** `beta` appears before `alpha` among the active workstreams

#### Scenario: Starred first

- **GIVEN** active workstreams `alpha`, whose step's task has `last_commit` 100 and which is starred, and `beta`, whose step's task has `last_commit` 200 and which is not
- **WHEN** their project's page is rendered
- **THEN** `alpha` appears before `beta` among the active workstreams

#### Scenario: Starred among themselves by latest commit

- **GIVEN** inactive workstreams `alpha`, `last_commit` 100, `beta`, `last_commit` 200, both starred, and `gamma`, `last_commit` 300, not starred
- **WHEN** their project's page is rendered
- **THEN** the other workstreams appear in the order `beta`, `alpha`, `gamma`

#### Scenario: A star keeps its section

- **GIVEN** a starred inactive workstream `alpha` and an active workstream `beta` not starred
- **WHEN** their project's page is rendered
- **THEN** `alpha` appears among the other workstreams and `beta` among the active workstreams

### Requirement: A workstream shows its star

On a project's page, in every part that renders the project's document, each workstream's summary SHALL hold a button that submits the page's one stars form, whose `action` is the project's address and `method` is `post`. For a workstream not starred, the button SHALL be named `star`, show `☆` and have the accessible name `Star <workstream>`; for a starred one, it SHALL be named `unstar`, show `★` and have the accessible name `Unstar <workstream>`. Its value SHALL be the workstream's name, escaped. The buttons SHALL show the stars as kept when the part holding them is drawn, so that a star set while the page is still arriving shows in every part after it. Without a script, pressing a button SHALL submit the form.

#### Scenario: Not starred

- **GIVEN** workstream `alpha`, not starred, of project `one` in workspace `work`
- **WHEN** `/work/one` is rendered
- **THEN** `alpha`'s summary holds a button named `star` with value `alpha` showing `☆`, submitting a form posting to `/work/one`

#### Scenario: Starred

- **GIVEN** workstream `alpha`, starred
- **WHEN** its project's page is rendered
- **THEN** `alpha`'s summary holds a button named `unstar` with value `alpha` showing `★`

#### Scenario: One form for every part

- **GIVEN** a project's page sent in a quick part and a full part
- **WHEN** it is rendered
- **THEN** it holds exactly one form with id `stars`, and every star button in either part names that form

#### Scenario: A star set while the page arrives

- **GIVEN** a project's page whose first part has been sent with `alpha` not starred, and whose reads have not ended
- **WHEN** `alpha` is starred, and then the reads end
- **THEN** the parts sent after the star show `alpha` starred

### Requirement: Only the last part carries workstream ids

On a project's page, a workstream's `id`, which links and the address after a star point at, SHALL be carried only by the part that renders the full read's result, so that an address ending `#<workstream>` reaches the part left shown. A part rendered from the quick read SHALL carry no workstream `id`.

#### Scenario: Quick and full parts

- **GIVEN** a project's page sent in a quick part and a full part, both showing workstream `alpha`
- **WHEN** it is rendered
- **THEN** exactly one element has id `alpha`, and it is in the full part

### Requirement: A running board is replaced

Where the port is held by a process of the same user whose script, the first argument after its interpreter, is an absolute path that, with links resolved, is `dist/cli.js` in a directory whose `package.json` is named `dev-task-board`, the command SHALL send that process `SIGTERM`, SHALL bind the port once it is free, and SHALL print on standard output, before its address, that it replaced the dev-task-board on that port, naming its process id.

#### Scenario: A board already on the port

- **GIVEN** a board running on a port
- **WHEN** a second board starts on the same port
- **THEN** the first exits, and the second prints that it replaced the board with the first's process id, then its address, and the address answers

#### Scenario: A board reached through a link

- **GIVEN** a board running from a command whose path is a link to the package's `dist/cli.js`, as `npx` runs it
- **WHEN** a second board starts on the same port
- **THEN** the first exits and the second listens

### Requirement: A board that does not let go refuses the start

After `SIGTERM`, the command SHALL retry the bind for up to 10 seconds. A holder that has not freed the port by then SHALL refuse the start with a message naming the port and the process id, and SHALL NOT be sent any other signal.

#### Scenario: A board that does not let go

- **GIVEN** a dev-task-board holder that does not free the port within 10 seconds of `SIGTERM`
- **WHEN** the command starts on its port
- **THEN** it exits non-zero naming the port and the holder's process id, and the holder is sent nothing else

### Requirement: Another program's port is not taken

Where the port is held by anything that is not a board as "A running board is replaced" states, or by a holder that cannot be found, the command SHALL send no signal. Unless its standard input and output are both a terminal, it SHALL refuse the start with a message naming the port and advising `--port <m>` or the `port` setting, `m` being the port "The offered port" states.

#### Scenario: Another program, no terminal

- **GIVEN** a port held by a program that is not a board
- **WHEN** the command starts on it without a terminal
- **THEN** it exits non-zero, writing nothing to standard output, naming the port and `port =`, and the holder still runs

#### Scenario: A look-alike

- **GIVEN** a port held by a process whose command line names a `dist/cli.js` in a directory whose `package.json` is named otherwise
- **WHEN** the command starts on it without a terminal
- **THEN** it refuses the start, and the holder still runs

### Requirement: The offered port

The port offered or advised, `m`, SHALL be the nearest port above the one held, up to 100 above it and at most 65535, that the command can bind. Where none binds, the command SHALL refuse the start naming the port, with no port offered or advised.

#### Scenario: No port to offer

- **GIVEN** a port held by a program that is not a board, and every port up to 100 above it, or up to 65535, unbindable
- **WHEN** the command starts on it without a terminal
- **THEN** it exits non-zero naming the port, and advises no `--port`

### Requirement: In a terminal, another port is offered

Where another program holds the port and standard input and output are both a terminal, the command SHALL ask whether to start on port `m`, naming the port and, where found, the holder's command and process id. Answered `y` or `yes`, ignoring case and surrounding space, it SHALL start on `m` and print that adding `port = <m>` to the named settings file keeps it. Answered otherwise, or with the input ended or interrupted, it SHALL refuse the start and exit non-zero.

#### Scenario: Another program, answered yes

- **GIVEN** a port `n` held by a program that is not a board, and port `n+1` free
- **WHEN** the command starts on `n` in a terminal and is answered `y`
- **THEN** it listens on `n+1`, prints the settings file and `port = <n+1>`, and the holder is sent no signal

#### Scenario: Another program, answered no

- **GIVEN** a port held by a program that is not a board
- **WHEN** the command starts on it in a terminal and is answered with an empty line, or its input ends
- **THEN** it exits non-zero and binds nothing

### Requirement: The first part shows what is held

Where the project holds a document when its page is requested, the first part SHALL show that document with the project's stars and without workstream ids, with the read time `Read <time>`, the time as `YYYY-MM-DD HH:MM:SS UTC`, carrying the update mark named `Being read again`, as "A page being read says so" states, with the notices the last part would show for it. Where it holds none, the first part SHALL say the project is being read, with the update mark named `Being read`.

#### Scenario: A held document

- **GIVEN** a project holding a document read at a known time, with workstream `alpha` starred, whose reads do not end
- **WHEN** its page is requested
- **THEN** the first part arrives before the reads end, holding that document's tasks, `alpha` starred, `Read <that time> UTC` carrying the mark named `Being read again`, and no element with id `alpha`, and the page's `stars` form arrives before it

#### Scenario: A kept document held

- **GIVEN** a project keeping a document through a later failed read, whose reads do not end
- **WHEN** its page is requested
- **THEN** the first part holds that document's tasks, how long it was kept and the failed read's reason

#### Scenario: Nothing held

- **GIVEN** a project still on its first read, or whose reads have only failed
- **WHEN** its page is requested
- **THEN** the first part says the project is being read and shows no document

#### Scenario: Held, then the reads

- **GIVEN** a project holding a document, whose full read ends after a quick read would have
- **WHEN** its page is requested
- **THEN** the response holds the held part and then the full document, in that order, and no quick part

### Requirement: A star is set in place

On a project's page with its script running, pressing a star button SHALL send the request its form would send — `POST` to the form's `action` with the button's one field — in the background, without following the answer's redirect, and the page SHALL NOT be reloaded or left. Pressing it SHALL NOT open or close the block whose summary holds it. While the request is pending, presses on that workstream's star SHALL be ignored. Once it is answered `303`, every star button of that workstream, in every part, SHALL show the state the request set, as "A workstream shows its star" gives for it: its name, its mark, its accessible name and `aria-pressed`; and nothing else on the page SHALL change, neither the order of workstreams, which blocks are open, nor the scroll position. Where the request fails or is answered otherwise, the script SHALL submit the form with that button, as a page with no script would.

#### Scenario: Starring in place

- **GIVEN** a project's page showing workstream `alpha` not starred, inside the open group of other workstreams, scrolled part way down
- **WHEN** `alpha`'s star is pressed and the request is answered `303`
- **THEN** one `POST` with body `star=alpha` was sent to the project's address, the page was neither reloaded nor left, `alpha`'s button is named `unstar` and shows `★` with the accessible name `Unstar alpha`, and the group is still open, the scroll position unchanged and the workstreams in the same order

#### Scenario: Unstarring in place

- **GIVEN** a project's page showing workstream `alpha` starred
- **WHEN** its star is pressed and the request is answered `303`
- **THEN** one `POST` with body `unstar=alpha` was sent, and `alpha`'s button is named `star` and shows `☆` with the accessible name `Star alpha`

#### Scenario: Pressed twice before the answer

- **GIVEN** workstream `alpha` not starred, and its star pressed with the request not yet answered
- **WHEN** its star is pressed again, and then the request is answered `303`
- **THEN** one `POST` was sent, and `alpha`'s button shows `★`

#### Scenario: A part drawn while the request was on its way

- **GIVEN** `alpha`'s star pressed in the first part, and the next part drawn with `alpha` not starred before the request is answered
- **WHEN** the request is answered `303`
- **THEN** `alpha`'s button in the shown part shows `★`

#### Scenario: The block stays as it was

- **GIVEN** workstream `alpha`'s block, closed
- **WHEN** its star is pressed
- **THEN** the block is still closed

#### Scenario: A star that is refused

- **GIVEN** a project's page whose star request will be answered 500, or will fail to reach the board
- **WHEN** `alpha`'s star is pressed
- **THEN** the form is submitted with `alpha`'s button, and the button is not turned over by the script

#### Scenario: Sorted on the next load

- **GIVEN** workstreams `alpha` and `beta`, `beta` listed first, and `alpha` starred in place
- **WHEN** the page is loaded again
- **THEN** `alpha` is listed before `beta`

### Requirement: A project's page reopens what was open

Each block on a project's page — a workstream, the group of other workstreams, the group of tasks in no workstream and a task's row — SHALL carry a key naming what it shows, not where it stands: `workstream:<name>`, `other`, `loose`, or `task:<workstream>:<task>`, the workstream empty for a task in no workstream. On leaving the page, its script SHALL remember, for that browser tab and that page's path, each key with whether its block is open — every keyed block of the part shown, together with the keys remembered before whose blocks that part does not hold, as the operator last left them or else as remembered — and the scroll position where the operator has scrolled, else the one remembered before. When the page is loaded again in that tab, each part SHALL, once it has arrived, set each keyed block open as the operator last left it, where they opened or closed it since the load began; else as remembered, where its key is remembered; else leave it as rendered. Until the operator scrolls the page, by any means, each part SHALL scroll to the remembered position. A remembered key no longer on the page SHALL be ignored. Where nothing is remembered, or the browser's storage cannot be used, every block the operator has not opened or closed SHALL show as rendered.

#### Scenario: Reloaded again before the position was reached

- **GIVEN** a reload remembered at a position below what the first part reaches, and the operator has not scrolled
- **WHEN** the page is left and loaded again before a longer part arrives
- **THEN** the position remembered is still the first one, and the page returns to it

#### Scenario: A reload reopens the blocks

- **GIVEN** a project's page with the group of other workstreams and workstream `alpha` open, and everything else closed
- **WHEN** the page is left and loaded again in the same tab
- **THEN** the group and `alpha` are open in each part, everything else is closed, and the page is scrolled to where it was

#### Scenario: A block found after the sort moved it

- **GIVEN** workstream `alpha` open, then starred in place
- **WHEN** the page is loaded again, `alpha` now listed first
- **THEN** `alpha` is open

#### Scenario: A block closed that is rendered open

- **GIVEN** a project with no workstreams, whose group of tasks in no workstream is rendered open, and that group closed
- **WHEN** the page is loaded again in the same tab
- **THEN** the group is closed

#### Scenario: Changed while the page arrives

- **GIVEN** a reload whose first part has arrived with `alpha` open
- **WHEN** `alpha` is closed and `beta` opened, and then the next part arrives
- **THEN** in that part `alpha` is closed and `beta` is open

#### Scenario: A first part that holds nothing

- **GIVEN** a reload remembered with workstream `alpha` open, of a project the board does not hold, so that the first part says it is being read
- **WHEN** the full part arrives
- **THEN** `alpha` is open in it, and the page is scrolled to the remembered position unless the operator scrolled meanwhile

#### Scenario: Nothing remembered, a block rendered open

- **GIVEN** a project with no workstreams, opened for the first time in a tab, whose first part says it is being read
- **WHEN** the full part arrives
- **THEN** its group of tasks in no workstream is open, as rendered

#### Scenario: Nothing remembered

- **GIVEN** a project's page opened for the first time in a tab
- **WHEN** it loads
- **THEN** its blocks are open or closed as rendered

#### Scenario: Storage that cannot be used

- **GIVEN** a browser whose storage throws when read or written
- **WHEN** the page is left and loaded again
- **THEN** it shows as rendered, and its stars still work

#### Scenario: A task's key

- **GIVEN** task `t1` listed under workstream `alpha` and task `t2` in no workstream
- **WHEN** the page is rendered
- **THEN** their rows' blocks carry the keys `task:alpha:t1` and `task::t2`

### Requirement: A page being read says so

A part of a project's page drawn while the project is being read SHALL begin its read time with the mark `↻`, named `Being read again` where it shows a held document, `Being read` where nothing is held, and `GitHub still being read` on the quick part, whose read time SHALL be `Read from git alone; statuses may be wrong.`. The last part SHALL carry no mark. The mark SHALL turn, but not under reduced motion, and SHALL need no script.

#### Scenario: Held, then read

- **GIVEN** a project holding a document, whose full read ends
- **WHEN** its page is requested
- **THEN** the first part's read time carries the mark named `Being read again`, and the last part's read time carries no mark

#### Scenario: Nothing held

- **GIVEN** a project whose reads do not end and which holds no document
- **WHEN** its page is requested
- **THEN** the first part carries the mark named `Being read`

#### Scenario: The quick part

- **GIVEN** a project holding no document, whose quick read ends before its full read
- **WHEN** its page is requested
- **THEN** the quick part's read time carries the mark named `GitHub still being read` and reads `Read from git alone; statuses may be wrong.`

#### Scenario: Reduced motion

- **WHEN** a project's page is requested
- **THEN** its style turns the mark, and stops it under `prefers-reduced-motion: reduce`

### Requirement: A workstream's steps are numbered

On a project's page, each row of a workstream's step SHALL show, before the step's name, its position among the workstream's `steps` in the document, counted from 1 and followed by a full stop, whether or not the document holds a task of that name. A step's row keeps its number whatever the task's status. A task shown in a workstream as unplaced, a row in the tasks-in-work section and a task in no workstream SHALL show no number.

#### Scenario: Numbered steps

- **GIVEN** a workstream `w` whose `steps` are `a`, `b` and `c`, each the name of a task in the document
- **WHEN** its project's page is rendered
- **THEN** `w`'s rows show `1.` before `a`, `2.` before `b` and `3.` before `c`

#### Scenario: A step with no task

- **GIVEN** a workstream whose `steps` are `a` and `b`, and a document with a task `b` but none named `a`
- **WHEN** its project's page is rendered
- **THEN** the row for `a` shows `1.` and the row for `b` shows `2.`

#### Scenario: An unplaced task

- **GIVEN** a workstream `w` whose `steps` are `a`, and a task `u` whose `workstreams` name `w`
- **WHEN** its project's page is rendered
- **THEN** `a`'s row shows `1.` and `u`'s row, marked unplaced, shows no number

#### Scenario: A step in work

- **GIVEN** a workstream `w` whose `steps` are `a` and `b`, where task `b` has `status` `in_flight`
- **WHEN** its project's page is rendered
- **THEN** `w`'s rows show `1.` before `a` and `2.` before `b`, and `b`'s row in the tasks-in-work section shows no number

#### Scenario: A task in no workstream

- **GIVEN** a task `t` whose `workstreams` is empty
- **WHEN** its project's page is rendered
- **THEN** `t`'s row shows no number
