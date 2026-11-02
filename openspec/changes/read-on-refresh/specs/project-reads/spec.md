## RENAMED Requirements

- FROM: `### Requirement: Each project is read once at start`
- TO: `### Requirement: Each project is read at start and when requested`

## MODIFIED Requirements

### Requirement: Each project is read at start and when requested

The command SHALL read each project after the server starts, one project at a time per workspace, by running the carried tool through `bash` with `--json` and the project's path. A request for a project's page SHALL read that project, and a request for a workspace's overview SHALL read its projects at the same time. A project SHALL have one read at a time: a request for a project being read SHALL wait for that read and start none. Between requests, once the pass at start has ended, nothing SHALL be read. A project SHALL be one of: being read, read, or failed with a reason. A project read before SHALL keep its state until its next read finishes, and SHALL NOT return to being read.

#### Scenario: A readable project

- **GIVEN** a fixture project holding `docs/backlog/AGENTS.md`
- **WHEN** it is read
- **THEN** it holds the document the tool printed, and the time of the read

#### Scenario: The server answers during a read

- **GIVEN** a read of one project that has not finished
- **WHEN** the page of another project, or the list of workspaces, is requested
- **THEN** it answers without waiting for that read

#### Scenario: A changed project is requested

- **GIVEN** a read project whose repository then changes
- **WHEN** its page is requested
- **THEN** it holds the new document and a later time of the read

#### Scenario: Two requests during one read

- **GIVEN** a project being read
- **WHEN** its page is requested twice
- **THEN** no second read starts, and both answers come when the read finishes

#### Scenario: Nobody is asking

- **GIVEN** a board whose pass at start has ended
- **WHEN** no page is requested
- **THEN** no read starts

#### Scenario: An overview reads every project

- **GIVEN** a workspace of two projects, the first of which fails
- **WHEN** its overview is requested
- **THEN** their reads overlap, and the answer comes when both have finished

#### Scenario: A request that names no project to read

- **WHEN** a request is refused, is answered 404, or is for the list of workspaces
- **THEN** no read starts
