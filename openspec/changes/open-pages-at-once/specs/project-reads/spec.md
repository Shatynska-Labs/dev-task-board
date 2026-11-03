## MODIFIED Requirements

### Requirement: Each project is read at start and when requested

The command SHALL read each project after the server starts, one project at a time per workspace, by running the carried tool through `bash` with `--json` and the project's path. A request for a project's page SHALL read that project, and a request for a workspace's overview SHALL read nothing. A project SHALL have one read at a time: a request for a project being read SHALL wait for that read and start none. Between requests, once the pass at start has ended, nothing SHALL be read. A project SHALL be one of: being read, holding a document, or failed with a reason, and it SHALL be failed only where it holds no document. A project read before SHALL keep its state until its next read finishes, and SHALL NOT return to being read.

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
- **THEN** no second read starts, and both answers end when the read finishes

#### Scenario: Nobody is asking

- **GIVEN** a board whose pass at start has ended
- **WHEN** no page is requested
- **THEN** no read starts

#### Scenario: An overview reads every project

- **GIVEN** a workspace of two projects
- **WHEN** its overview is requested
- **THEN** no read starts, and it answers without waiting for any read in progress

#### Scenario: A request that names no project to read

- **WHEN** a request is refused, is answered 404, or is for the list of workspaces
- **THEN** no read starts

### Requirement: A read uses its workspace's GitHub account

For a workspace with a `github_account`, each read SHALL take the account's token from `gh auth token --user <account>`, and SHALL run the tool with it as `GH_TOKEN` in that read's environment alone. The token SHALL be taken for each read, and SHALL NOT be stored, logged or shown. Where the token cannot be had, because `gh` is missing, exits non-zero or prints nothing, the tool SHALL run in an environment where `gh` cannot use any login and neither `GH_TOKEN` nor `GITHUB_TOKEN` is set, so that the read has no access through `gh`. Such a read that fails SHALL name the account in its reason. Taking the token and running the tool SHALL together keep to the read's limit: where the limit passes while the token is being taken, `gh` SHALL be stopped and the read SHALL fail, naming the account, with no tool started. Stopping the board SHALL stop a token being taken, with no tool started. A workspace with no `github_account` SHALL read in the board's own environment, with no token taken.

#### Scenario: A token for the account

- **GIVEN** a workspace with `github_account` `someone`, and a `gh` holding a token for `someone`
- **WHEN** a project is read
- **THEN** `gh` is asked for that account, the tool's `GH_TOKEN` is that token, and the board's own environment does not change

#### Scenario: Two workspaces, two accounts

- **GIVEN** workspaces listing one project, with accounts `first` and `second`
- **WHEN** the project's page in each workspace is requested
- **THEN** each read has the token of its own workspace's account

#### Scenario: Asked for each read

- **GIVEN** a workspace with an account
- **WHEN** a project is read twice
- **THEN** `gh` is asked for the token twice

#### Scenario: No token

- **GIVEN** a workspace with an account `gh` does not hold, and `GH_TOKEN` and `GITHUB_TOKEN` set in the board's environment
- **WHEN** a project is read
- **THEN** the tool has neither set, `gh` run by the tool cannot use any login, the document's `forge` is `none`, and the project holds the account's name as what the read could not use

#### Scenario: Without gh

- **GIVEN** a workspace with an account, and no `gh` on `PATH`
- **WHEN** a project is read
- **THEN** it reads with `forge` `none`, and the project holds the account's name

#### Scenario: A token that does not come

- **GIVEN** a workspace with an account, and a `gh` that does not answer
- **WHEN** the read's limit passes
- **THEN** `gh` is stopped, no tool is started, the reason names the account and the limit, and the board has not waited for longer than the limit and its grace

#### Scenario: No token, and the tool fails

- **GIVEN** a project keeping a document, a workspace with an account `gh` does not hold, and a tool that exits non-zero
- **WHEN** a project is read
- **THEN** it keeps the document, and the latest read's reason names the account and the tool's reason

#### Scenario: Stopping while a token is taken

- **GIVEN** a workspace with an account, and a `gh` that does not answer
- **WHEN** the board is stopped
- **THEN** `gh` is stopped, and no tool is started

#### Scenario: No account

- **GIVEN** a workspace with no account, and `GH_TOKEN` set in the board's environment
- **WHEN** a project is read
- **THEN** `gh` is not asked for a token, and the tool sees the same `GH_TOKEN`

## ADDED Requirements

### Requirement: A project's page starts a quick read beside the full one

A request for a project's page SHALL start, at the same time as the full read, a quick read of that project: the carried tool run as for a full read, but in an environment where `gh` cannot use any login and neither `GH_TOKEN` nor `GITHUB_TOKEN` is set, with no token taken for any account. A quick read SHALL NOT change what the project holds, and its document SHALL reach only the requests waiting for it. A request that finds the project's full read already running, from the pass at start or another request, SHALL wait for that full read and SHALL still start a quick read where none is running. A project SHALL have one quick read at a time: a request during one SHALL wait for it and start none. A quick read SHALL be stopped where the full read beside it ends first, and SHALL have the full read's limit. The pass at start SHALL start no quick read.

#### Scenario: Both reads start

- **GIVEN** a project with a stub tool that logs its environment
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

- **GIVEN** a workspace with a `github_account`
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
