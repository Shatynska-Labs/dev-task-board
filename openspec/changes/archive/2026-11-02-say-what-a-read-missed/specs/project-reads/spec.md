## MODIFIED Requirements

### Requirement: Each project is read at start and when requested

The command SHALL read each project after the server starts, one project at a time per workspace, by running the carried tool through `bash` with `--json` and the project's path. A request for a project's page SHALL read that project, and a request for a workspace's overview SHALL read its projects at the same time. A project SHALL have one read at a time: a request for a project being read SHALL wait for that read and start none. Between requests, once the pass at start has ended, nothing SHALL be read. A project SHALL be one of: being read, holding a document, or failed with a reason, and it SHALL be failed only where it holds no document. A project read before SHALL keep its state until its next read finishes, and SHALL NOT return to being read.

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

## ADDED Requirements

### Requirement: A read does not replace a better document

A failed read SHALL leave a project's document in place. A read whose `forge` is not `full` SHALL leave in place a document whose `forge` is `full`, and SHALL replace any other. A read whose `forge` is `full` SHALL always replace the document, whatever its `trunk.state` or `remote_branches_read`. A document left in place SHALL keep the time of its own read, and the project SHALL hold the time of the latest read and its reason, or what it missed, until a read replaces the document.

#### Scenario: A failure after a read

- **GIVEN** a project holding a document
- **WHEN** a read fails
- **THEN** it holds the same document and the time of that document's read, with the time of the failed read and its reason

#### Scenario: An unknown schema after a read

- **GIVEN** a project holding a document
- **WHEN** a read prints `schema_version` 2
- **THEN** it holds the same document, and the reason names version 2

#### Scenario: A degraded read after a full one

- **GIVEN** a project holding a document whose `forge` is `full`
- **WHEN** a read gives `forge` `none`
- **THEN** it holds the same document, with the time of the degraded read and what it missed

#### Scenario: A degraded read with no full document

- **GIVEN** a project holding a document whose `forge` is `none`
- **WHEN** a read gives `forge` `none`
- **THEN** it holds the new document

#### Scenario: A failure after a degraded read

- **GIVEN** a project holding a document whose `forge` is `none`
- **WHEN** a read fails
- **THEN** it holds the same document, with the failed read's reason

#### Scenario: A full read with a failed fetch

- **GIVEN** a project holding a document whose `forge` is `full`
- **WHEN** a read gives `forge` `full`, `trunk.state` `fetch_failed` and `remote_branches_read` false
- **THEN** it holds the new document

#### Scenario: A full read after a kept document

- **GIVEN** a project keeping a document through a failed read
- **WHEN** a read gives `forge` `full`
- **THEN** it holds the new document, with no failed read's reason

#### Scenario: A network outage

- **GIVEN** a project holding a document whose `forge` is `full`
- **WHEN** a read gives `forge` `none`, `trunk.state` `fetch_failed` and `remote_branches_read` false
- **THEN** it holds the same document, and what the read missed names all three
