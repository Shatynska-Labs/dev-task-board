## ADDED Requirements

### Requirement: Workstreams are ordered by their latest commit

On a project's page, the workstreams in the active-workstreams section, and those in the other-workstreams section, SHALL each be ordered by the greatest `last_commit`, a time in Unix seconds, among their tasks, newest first; a workstream's tasks are those its `steps` name and those whose `workstreams` name it but no step holds. A `last_commit` that is absent or `null` counts as none, and a workstream with none SHALL follow every workstream with one. Ties, including workstreams with none, SHALL be ordered by name in code-unit order, as the document orders names.

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
