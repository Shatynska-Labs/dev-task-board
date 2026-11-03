# project-reads Specification

## Purpose

Reading each project with the carried tool, with a reason for every failed read and a bound on every read.

## Requirements

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

### Requirement: A failed read has a reason

A read SHALL fail with a reason where the tool exits non-zero, its output is not one JSON document, its `schema_version` is not 1, or it passes 60 seconds, and a failure SHALL NOT stop the other projects' reads. A read stopped at its limit SHALL have the tool and the processes it started stopped, by `SIGTERM` and after a 5 second grace by `SIGKILL`.

#### Scenario: The tool refuses

- **GIVEN** a fixture project with neither `docs/backlog/` nor `docs/workstreams/`
- **WHEN** it is read
- **THEN** it has failed, with the tool's `Reason:` line as its reason

#### Scenario: A failure with nothing on standard error

- **GIVEN** a tool that exits non-zero, or is killed by a signal, writing nothing to standard error
- **WHEN** a project is read
- **THEN** it has failed, and the reason names the exit code or signal

#### Scenario: An unknown schema

- **GIVEN** a tool printing `schema_version` 2
- **WHEN** a project is read
- **THEN** it has failed, and the reason names version 2

#### Scenario: A read past its limit

- **GIVEN** a tool that starts a child and does not finish
- **WHEN** the limit passes
- **THEN** the tool and its child are stopped, and the project has failed with that reason

#### Scenario: A tool that exits zero with bad output

- **GIVEN** a tool printing text that is not JSON and exiting zero
- **WHEN** a project is read
- **THEN** it has failed, and the reason says the output could not be read

#### Scenario: One failure among several

- **GIVEN** a workspace whose first project fails
- **WHEN** it is read
- **THEN** the second project is still read

### Requirement: Stopping the board stops its reads

On `SIGINT` or `SIGTERM` the command SHALL close the server, stop running reads with the same signals and grace, start no further read, and exit zero.

#### Scenario: Stopped during a read

- **GIVEN** a board with a read running
- **WHEN** it receives `SIGINT`
- **THEN** the read's processes are gone, the port is free, and it exits zero within the grace and the kill

#### Scenario: Stopped with a project waiting

- **GIVEN** a workspace of two projects, the first being read
- **WHEN** the board is stopped
- **THEN** the second is never read

### Requirement: What the tool needs is checked at start

The command SHALL refuse to start, naming what is missing, where `bash`, `git` or `awk` is not on `PATH`. `gh` SHALL stay optional.

#### Scenario: A missing requirement

- **GIVEN** valid settings and a `PATH` with no `awk`
- **WHEN** the command starts
- **THEN** it exits non-zero, naming `awk`

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

### Requirement: A read uses its workspace's GitHub account

For a workspace with a `github_account`, each read SHALL take the account's token from `gh auth token --user <account>`, and SHALL run the tool with it as `GH_TOKEN` in that read's environment alone. The token SHALL be taken for each read, and SHALL NOT be stored, logged or shown. Where the token cannot be had, because `gh` is missing, exits non-zero or prints nothing, the tool SHALL run in an environment where `gh` cannot use any login and neither `GH_TOKEN` nor `GITHUB_TOKEN` is set, so that the read has no access through `gh`. Such a read that fails SHALL name the account in its reason. Taking the token and running the tool SHALL together keep to the read's limit: where the limit passes while the token is being taken, `gh` SHALL be stopped and the read SHALL fail, naming the account, with no tool started. Stopping the board SHALL stop a token being taken, with no tool started. A workspace with no `github_account` SHALL read in the board's own environment, with no token taken.

#### Scenario: A token for the account

- **GIVEN** a workspace with `github_account` `someone`, and a `gh` holding a token for `someone`
- **WHEN** a project is read
- **THEN** `gh` is asked for that account, the tool's `GH_TOKEN` is that token, and the board's own environment does not change

#### Scenario: Two workspaces, two accounts

- **GIVEN** workspaces listing one project, with accounts `first` and `second`
- **WHEN** both overviews are requested
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
