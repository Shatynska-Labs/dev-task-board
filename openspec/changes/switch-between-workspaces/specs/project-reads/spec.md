## ADDED Requirements

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
