## ADDED Requirements

### Requirement: Stars are kept on this machine

The board SHALL keep stars in `$XDG_STATE_HOME/dev-task-board/stars.json`, or `~/.local/state/dev-task-board/stars.json` where `XDG_STATE_HOME` is unset or empty, as `{"version": 1, "stars": {"<project path>": ["<workstream>", …]}}`, keyed by the project's path as settings resolve it, each list's names sorted, and with no key whose list is empty. It SHALL read the file at start, SHALL treat a missing file as no stars, and SHALL write the file, creating its directory where absent, whenever a star is set or cleared, replacing it whole by renaming a file written beside it. Sets SHALL be applied one at a time, each written from the result of the one before, so that overlapping requests lose no star. It SHALL write nothing to a project's repository.

#### Scenario: No file

- **GIVEN** no stars file exists
- **WHEN** the board starts
- **THEN** it starts, and no workstream is starred

#### Scenario: Stars survive a restart

- **GIVEN** workstream `alpha` of the project at `/p/one` was starred, and the board was stopped
- **WHEN** the board starts again
- **THEN** `alpha` of that project is starred

#### Scenario: The file's content

- **GIVEN** no stars file exists
- **WHEN** `beta` and then `alpha` of the project at `/p/one` are starred
- **THEN** the file holds `{"version": 1, "stars": {"/p/one": ["alpha", "beta"]}}`

#### Scenario: The last star of a project cleared

- **GIVEN** only `alpha` of the project at `/p/one` is starred
- **WHEN** `alpha` is unstarred
- **THEN** the file's `stars` holds no key `/p/one`

#### Scenario: One project in two workspaces

- **GIVEN** workspaces `a` and `b` both list the project at `/p/one`
- **WHEN** `alpha` is starred from `/a/one`
- **THEN** `alpha` shows as starred on `/b/one` too

#### Scenario: Overlapping sets

- **GIVEN** no stars file exists
- **WHEN** `alpha` and `beta` of the project at `/p/one` are starred by two requests at once
- **THEN** the file holds both, and both show as starred

#### Scenario: The state directory from the environment

- **GIVEN** `XDG_STATE_HOME` is `/s`
- **WHEN** a star is set
- **THEN** it is written to `/s/dev-task-board/stars.json`

### Requirement: A bad stars file refuses the start

A stars file that cannot be read, is not JSON, is not an object whose `version` is `1` and whose `stars` is an object of arrays of strings, SHALL refuse the start with a message naming the file and the reason, and the board SHALL NOT overwrite it. Names out of order, repeated, or an empty list SHALL be accepted, and the next write SHALL hold them sorted, once each, with no empty list.

#### Scenario: Not JSON

- **GIVEN** the stars file holds `{not json`
- **WHEN** the board starts
- **THEN** it exits non-zero with a message naming the file, and the file is unchanged

#### Scenario: A hand edit out of order

- **GIVEN** the stars file holds `{"version": 1, "stars": {"/p/one": ["beta", "alpha", "beta"], "/p/two": []}}`
- **WHEN** the board starts and `gamma` of `/p/one` is starred
- **THEN** it starts, and the file then holds `{"version": 1, "stars": {"/p/one": ["alpha", "beta", "gamma"]}}`

#### Scenario: Not a list of names

- **GIVEN** the stars file holds `{"version": 1, "stars": {"/p/one": "alpha"}}`
- **WHEN** the board starts
- **THEN** it exits non-zero with a message naming the file

#### Scenario: Another version

- **GIVEN** the stars file holds `{"version": 2, "stars": {}}`
- **WHEN** the board starts
- **THEN** it exits non-zero with a message naming the file and the version

### Requirement: The page sets a star

`POST /<workspace>/<project>` with an `application/x-www-form-urlencoded` body holding exactly one field, `star` or `unstar`, whose value is a workstream that the project's held document names, SHALL star or unstar that workstream, starting no read and SHALL be answered `303 See Other` with `Location` `/<workspace>/<project>#<workstream>`, each name percent-encoded. Starring a starred workstream, or unstarring one not starred, SHALL leave it so and answer the same. A star that cannot be written SHALL be answered 500 with a page saying the star could not be saved and why, the reason escaped, and the stars held SHALL be unchanged.

#### Scenario: Starring

- **GIVEN** project `one` in workspace `work`, whose held document names workstream `alpha`, not starred
- **WHEN** `/work/one` is posted `star=alpha` from the board's own page
- **THEN** it is answered 303 to `/work/one#alpha`, `alpha` is starred, and no read of `one` starts

#### Scenario: Unstarring

- **GIVEN** `alpha` of `one` is starred
- **WHEN** `/work/one` is posted `unstar=alpha` from the board's own page
- **THEN** it is answered 303 to `/work/one#alpha`, and `alpha` is not starred

#### Scenario: Sent twice

- **GIVEN** `alpha` of `one` is starred
- **WHEN** `/work/one` is posted `star=alpha` again
- **THEN** it is answered 303, and `alpha` is still starred

#### Scenario: A star that cannot be saved

- **GIVEN** the stars file's directory cannot be written
- **WHEN** `/work/one` is posted `star=alpha`
- **THEN** it is answered 500 with a page saying the star could not be saved, and `alpha` is not starred

### Requirement: Only the board's own page sets a star

A `POST` to a project's address SHALL be checked in this order, the first that fails deciding the answer and nothing changing: its `Sec-Fetch-Site` SHALL be `same-origin` and its `Origin` `http://` followed by the request's `Host`, else 403; its body SHALL be at most 4096 bytes, else 413; its body SHALL be one `star` or `unstar` field, else 400; the field SHALL name a workstream the project's held document names, else 404. These are besides the `Host` and `Sec-Fetch-Site` checks every request passes. A `POST` to any other address is answered 404 before these checks, as `Addresses reach workspaces and projects` states.

#### Scenario: From another site

- **WHEN** `/work/one` is posted `star=alpha` with `Sec-Fetch-Site` `cross-site`, or with `Origin` `http://evil.example`
- **THEN** it is answered 403, and nothing is starred

#### Scenario: Without the headers

- **WHEN** `/work/one` is posted `star=alpha` with no `Sec-Fetch-Site`, or with no `Origin`
- **THEN** it is answered 403, and nothing is starred

#### Scenario: A malformed body

- **WHEN** `/work/one` is posted an empty body, `star=alpha&unstar=beta`, or `pin=alpha`
- **THEN** it is answered 400, and nothing changes

#### Scenario: A long body

- **WHEN** `/work/one` is posted a body of 5000 bytes
- **THEN** it is answered 413, and nothing changes

#### Scenario: An unknown workstream or project

- **WHEN** `/work/one` is posted `star=nobody`, or `/work/nothing` is posted `star=alpha`
- **THEN** it is answered 404, and nothing changes

#### Scenario: The first failing check decides

- **WHEN** `/work/one` is posted a body of 5000 bytes with no `Origin`, or `/work/one` is posted `pin=alpha` with a body of 5000 bytes, or `/work/nothing` is posted with no `Origin`
- **THEN** they are answered 403, 413 and 404 in turn
