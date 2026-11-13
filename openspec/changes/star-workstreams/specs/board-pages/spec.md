## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: A workstream shows its star

On a project's page, in every part that renders the project's document, each workstream's summary SHALL hold a button that submits the page's one stars form, whose `action` is the project's address and `method` is `post`. For a workstream not starred, the button SHALL be named `star`, show `☆` and have the accessible name `Star <workstream>`; for a starred one, it SHALL be named `unstar`, show `★` and have the accessible name `Unstar <workstream>`. Its value SHALL be the workstream's name, escaped. The page SHALL still carry no script.

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

### Requirement: Only the last part carries workstream ids

On a project's page, a workstream's `id`, which links and the address after a star point at, SHALL be carried only by the part that renders the full read's result, so that an address ending `#<workstream>` reaches the part left shown. A part rendered from the quick read SHALL carry no workstream `id`.

#### Scenario: Quick and full parts

- **GIVEN** a project's page sent in a quick part and a full part, both showing workstream `alpha`
- **WHEN** it is rendered
- **THEN** exactly one element has id `alpha`, and it is in the full part
