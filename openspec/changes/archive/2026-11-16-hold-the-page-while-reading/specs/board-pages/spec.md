## ADDED Requirements

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

## MODIFIED Requirements

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
