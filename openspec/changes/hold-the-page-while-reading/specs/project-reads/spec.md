## MODIFIED Requirements

### Requirement: A project's page starts a quick read beside the full one

A request for a project's page that finds the project holding no read document SHALL start, at the same time as the full read, a quick read of that project: the carried tool run as for a full read, but in an environment where `gh` cannot use any login and neither `GH_TOKEN` nor `GITHUB_TOKEN` is set, with no token taken for any account. A quick read SHALL NOT change what the project holds, and its document SHALL reach only the requests waiting for it. A request that finds the project's full read already running, from the pass at start or another request, SHALL wait for that full read and SHALL still start a quick read where none is running and the project holds no read document. A request that finds the project holding a read document SHALL start no quick read. A project SHALL have one quick read at a time: a request during one SHALL wait for it and start none. A quick read SHALL be stopped where the full read beside it ends first, and SHALL have the full read's limit. The pass at start SHALL start no quick read.

#### Scenario: Both reads start

- **GIVEN** a project holding no document, with a stub tool that logs its environment
- **WHEN** its page is requested
- **THEN** the tool runs twice, overlapping, once with `gh` unable to log in

#### Scenario: A quick read is not held

- **GIVEN** a project whose quick read ends and whose full read has not
- **WHEN** its state is read
- **THEN** it holds what it held before the request

#### Scenario: The full read ends first

- **GIVEN** a quick read that does not end
- **WHEN** the full read beside it ends
- **THEN** the quick read is stopped

#### Scenario: No account is used

- **GIVEN** a workspace with a `github_account`, and a project holding no document
- **WHEN** a project's page is requested
- **THEN** `gh` is asked for a token once, by the full read

#### Scenario: Joining a read at start

- **GIVEN** a project being read by the pass at start
- **WHEN** its page is requested
- **THEN** no second full read starts, and a quick read starts

#### Scenario: Two requests during one quick read

- **GIVEN** a project whose quick read has not ended
- **WHEN** its page is requested again
- **THEN** no second quick read starts

#### Scenario: Nothing quick at start

- **WHEN** the pass at start reads a project
- **THEN** no quick read starts

#### Scenario: A held document starts no quick read

- **GIVEN** a project holding a document, with a stub tool that logs its environment
- **WHEN** its page is requested
- **THEN** the tool runs once, as the full read
