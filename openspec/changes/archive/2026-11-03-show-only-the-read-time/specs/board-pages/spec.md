## MODIFIED Requirements

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
