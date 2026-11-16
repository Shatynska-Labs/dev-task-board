## ADDED Requirements

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
