## MODIFIED Requirements

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

## ADDED Requirements

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
