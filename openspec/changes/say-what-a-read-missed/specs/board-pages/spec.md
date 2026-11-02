## MODIFIED Requirements

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

## ADDED Requirements

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
