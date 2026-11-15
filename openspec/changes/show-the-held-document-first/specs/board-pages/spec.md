## MODIFIED Requirements

### Requirement: A project's page shows each read as it arrives

A project's page SHALL be sent in parts: first the head, the tabs and the heading with a part showing what the project holds, as "The first part shows what is held" states; then, where the quick read ends before the full one, a part showing its document, marked as read from `git` alone with GitHub still being read, so that statuses may be wrong; and last a part showing what the project holds once the full read has settled, as a page shows it today. Each part SHALL be a `section` of class `phase`, and the page's style SHALL hide every `phase` followed by another, so that only the latest is seen. A quick read that fails, or ends after the full read, SHALL add no part. The page SHALL carry no script.

#### Scenario: The first part comes at once

- **GIVEN** a project whose reads do not end
- **WHEN** its page is requested
- **THEN** the tabs, the heading and the first part arrive before the reads end

#### Scenario: Quick, then full

- **GIVEN** a project whose quick read ends before its full read
- **WHEN** its page is requested
- **THEN** the response holds the first part, then the quick document marked as from `git` alone, then the full document, in that order

#### Scenario: Full first

- **GIVEN** a project whose full read ends before its quick read
- **WHEN** its page is requested
- **THEN** the response holds the first part and then the full document, and no quick part

#### Scenario: A quick read that fails

- **GIVEN** a project whose quick read fails and whose full read succeeds
- **WHEN** its page is requested
- **THEN** no part says the quick read failed

#### Scenario: Only the latest is seen

- **WHEN** any page is requested
- **THEN** its style holds `.phase:has(~ .phase)` with `display: none`, and it carries no `<script>`

## ADDED Requirements

### Requirement: The first part shows what is held

Where the project holds a document when its page is requested, the first part SHALL show that document with the project's stars and without workstream ids, under the line `Shown as read <time>; being read again.`, the time as `YYYY-MM-DD HH:MM:SS UTC`, with the notices the last part would show for it. Where it holds none, the first part SHALL say the project is being read.

#### Scenario: A held document

- **GIVEN** a project holding a document read at a known time, with workstream `alpha` starred, whose reads do not end
- **WHEN** its page is requested
- **THEN** the first part arrives before the reads end, holding that document's tasks, `alpha` starred, `Shown as read <that time> UTC; being read again.`, and no element with id `alpha`, and the page's `stars` form arrives before it

#### Scenario: A kept document held

- **GIVEN** a project keeping a document through a later failed read, whose reads do not end
- **WHEN** its page is requested
- **THEN** the first part holds that document's tasks, how long it was kept and the failed read's reason

#### Scenario: Nothing held

- **GIVEN** a project still on its first read, or whose reads have only failed
- **WHEN** its page is requested
- **THEN** the first part says the project is being read and shows no document

#### Scenario: Held, then the reads

- **GIVEN** a project holding a document, whose quick read ends before its full read
- **WHEN** its page is requested
- **THEN** the response holds the held part, then the quick part, then the full document, in that order
