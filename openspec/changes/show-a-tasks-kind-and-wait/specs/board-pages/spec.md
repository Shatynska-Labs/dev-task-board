## ADDED Requirements

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
