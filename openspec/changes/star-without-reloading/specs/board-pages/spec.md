## ADDED Requirements

### Requirement: A star is set in place

On a project's page with its script running, pressing a star button SHALL send the request its form would send — `POST` to the form's `action` with the button's one field — in the background, without following the answer's redirect, and the page SHALL NOT be reloaded or left. Pressing it SHALL NOT open or close the block whose summary holds it. While the request is pending, presses on that workstream's star SHALL be ignored. Once it is answered `303`, every star button of that workstream, in every part, SHALL show the state the request set, as "A workstream shows its star" gives for it: its name, its mark, its accessible name and `aria-pressed`; and nothing else on the page SHALL change, neither the order of workstreams, which blocks are open, nor the scroll position. Where the request fails or is answered otherwise, the script SHALL submit the form with that button, as a page with no script would.

#### Scenario: Starring in place

- **GIVEN** a project's page showing workstream `alpha` not starred, inside the open group of other workstreams, scrolled part way down
- **WHEN** `alpha`'s star is pressed and the request is answered `303`
- **THEN** one `POST` with body `star=alpha` was sent to the project's address, the page was neither reloaded nor left, `alpha`'s button is named `unstar` and shows `★` with the accessible name `Unstar alpha`, and the group is still open, the scroll position unchanged and the workstreams in the same order

#### Scenario: Unstarring in place

- **GIVEN** a project's page showing workstream `alpha` starred
- **WHEN** its star is pressed and the request is answered `303`
- **THEN** one `POST` with body `unstar=alpha` was sent, and `alpha`'s button is named `star` and shows `☆` with the accessible name `Star alpha`

#### Scenario: Pressed twice before the answer

- **GIVEN** workstream `alpha` not starred, and its star pressed with the request not yet answered
- **WHEN** its star is pressed again, and then the request is answered `303`
- **THEN** one `POST` was sent, and `alpha`'s button shows `★`

#### Scenario: A part drawn while the request was on its way

- **GIVEN** `alpha`'s star pressed in the first part, and the next part drawn with `alpha` not starred before the request is answered
- **WHEN** the request is answered `303`
- **THEN** `alpha`'s button in the shown part shows `★`

#### Scenario: The block stays as it was

- **GIVEN** workstream `alpha`'s block, closed
- **WHEN** its star is pressed
- **THEN** the block is still closed

#### Scenario: A star that is refused

- **GIVEN** a project's page whose star request will be answered 500, or will fail to reach the board
- **WHEN** `alpha`'s star is pressed
- **THEN** the form is submitted with `alpha`'s button, and the button is not turned over by the script

#### Scenario: Sorted on the next load

- **GIVEN** workstreams `alpha` and `beta`, `beta` listed first, and `alpha` starred in place
- **WHEN** the page is loaded again
- **THEN** `alpha` is listed before `beta`

### Requirement: A project's page reopens what was open

Each block on a project's page — a workstream, the group of other workstreams, the group of tasks in no workstream and a task's row — SHALL carry a key naming what it shows, not where it stands: `workstream:<name>`, `other`, `loose`, or `task:<workstream>:<task>`, the workstream empty for a task in no workstream. On leaving the page, its script SHALL remember, for that browser tab and that page's path, each key with whether its block is open — every keyed block of the part shown, together with the keys remembered before whose blocks that part does not hold, as the operator last left them or else as remembered — and the scroll position where the operator has scrolled, else the one remembered before. When the page is loaded again in that tab, each part SHALL, once it has arrived, set each keyed block open as the operator last left it, where they opened or closed it since the load began; else as remembered, where its key is remembered; else leave it as rendered. Until the operator scrolls the page, by any means, each part SHALL scroll to the remembered position. A remembered key no longer on the page SHALL be ignored. Where nothing is remembered, or the browser's storage cannot be used, every block the operator has not opened or closed SHALL show as rendered.

#### Scenario: Reloaded again before the position was reached

- **GIVEN** a reload remembered at a position below what the first part reaches, and the operator has not scrolled
- **WHEN** the page is left and loaded again before a longer part arrives
- **THEN** the position remembered is still the first one, and the page returns to it

#### Scenario: A reload reopens the blocks

- **GIVEN** a project's page with the group of other workstreams and workstream `alpha` open, and everything else closed
- **WHEN** the page is left and loaded again in the same tab
- **THEN** the group and `alpha` are open in each part, everything else is closed, and the page is scrolled to where it was

#### Scenario: A block found after the sort moved it

- **GIVEN** workstream `alpha` open, then starred in place
- **WHEN** the page is loaded again, `alpha` now listed first
- **THEN** `alpha` is open

#### Scenario: A block closed that is rendered open

- **GIVEN** a project with no workstreams, whose group of tasks in no workstream is rendered open, and that group closed
- **WHEN** the page is loaded again in the same tab
- **THEN** the group is closed

#### Scenario: Changed while the page arrives

- **GIVEN** a reload whose first part has arrived with `alpha` open
- **WHEN** `alpha` is closed and `beta` opened, and then the next part arrives
- **THEN** in that part `alpha` is closed and `beta` is open

#### Scenario: A first part that holds nothing

- **GIVEN** a reload remembered with workstream `alpha` open, of a project the board does not hold, so that the first part says it is being read
- **WHEN** the full part arrives
- **THEN** `alpha` is open in it, and the page is scrolled to the remembered position unless the operator scrolled meanwhile

#### Scenario: Nothing remembered, a block rendered open

- **GIVEN** a project with no workstreams, opened for the first time in a tab, whose first part says it is being read
- **WHEN** the full part arrives
- **THEN** its group of tasks in no workstream is open, as rendered

#### Scenario: Nothing remembered

- **GIVEN** a project's page opened for the first time in a tab
- **WHEN** it loads
- **THEN** its blocks are open or closed as rendered

#### Scenario: Storage that cannot be used

- **GIVEN** a browser whose storage throws when read or written
- **WHEN** the page is left and loaded again
- **THEN** it shows as rendered, and its stars still work

#### Scenario: A task's key

- **GIVEN** task `t1` listed under workstream `alpha` and task `t2` in no workstream
- **WHEN** the page is rendered
- **THEN** their rows' blocks carry the keys `task:alpha:t1` and `task::t2`

## MODIFIED Requirements

### Requirement: A page shows what was read for it

An overview SHALL answer at once, from what the board holds. A project's page SHALL begin its answer before its reads end, and SHALL end it once its full read has finished, showing that read's result, and a read's limit SHALL bound how long it waits. Pages SHALL be sent with `Cache-Control: no-store`. An overview SHALL carry no script; a project's page SHALL carry only its own script, as "A star is set in place" and "A project's page reopens what was open" state, which SHALL start no read and request no page of its own; its fallback submits the stars form, as a page with no script would. A request whose `Sec-Fetch-Site` is `cross-site` or `same-site` SHALL be answered 403, so that another site cannot start reads.

#### Scenario: A refresh shows a change

- **GIVEN** an open project page, and a change to the project after it was read
- **WHEN** the page is refreshed
- **THEN** it shows the change

#### Scenario: A read past its limit

- **GIVEN** a request whose read does not finish
- **WHEN** the limit passes
- **THEN** the page ends, with that reason

#### Scenario: A request from another site

- **GIVEN** a request for a page with `Sec-Fetch-Site` `cross-site` or `same-site`
- **WHEN** it arrives
- **THEN** it is answered 403, and no read starts

#### Scenario: A request from the reader

- **WHEN** a page is requested with `Sec-Fetch-Site` `none` or `same-origin`, or with no such header
- **THEN** it is answered normally

#### Scenario: Not cached

- **WHEN** a page is requested
- **THEN** its answer carries `Cache-Control: no-store`

#### Scenario: Only a project's page has a script

- **WHEN** an overview and a project's page are requested
- **THEN** the overview holds no `<script>`, and the project's page holds no script but its own

### Requirement: A project's page shows each read as it arrives

A project's page SHALL be sent in parts: first the head, the tabs and the heading with a part showing what the project holds, as "The first part shows what is held" states; then, where the quick read ends before the full one, a part showing its document, marked as read from `git` alone with GitHub still being read, so that statuses may be wrong; and last a part showing what the project holds once the full read has settled, as a page shows it today. Each part SHALL be a `section` of class `phase`, and the page's style SHALL hide every `phase` followed by another, so that only the latest is seen. A quick read that fails, or ends after the full read, SHALL add no part.

#### Scenario: The first part comes at once

- **GIVEN** a project whose reads do not end
- **WHEN** its page is requested
- **THEN** the tabs, the heading and the first part arrive before the reads end

#### Scenario: Quick, then full

- **GIVEN** a project whose quick read ends before its full read
- **WHEN** its page is requested
- **THEN** the response holds the first part, then the quick document marked as from `git` alone, then the full document, in that order

#### Scenario: Full first

- **GIVEN** a project whose full read ends before its quick read
- **WHEN** its page is requested
- **THEN** the response holds the first part and then the full document, and no quick part

#### Scenario: A quick read that fails

- **GIVEN** a project whose quick read fails and whose full read succeeds
- **WHEN** its page is requested
- **THEN** no part says the quick read failed

#### Scenario: Only the latest is seen

- **WHEN** any page is requested
- **THEN** its style holds `.phase:has(~ .phase)` with `display: none`

### Requirement: A workstream shows its star

On a project's page, in every part that renders the project's document, each workstream's summary SHALL hold a button that submits the page's one stars form, whose `action` is the project's address and `method` is `post`. For a workstream not starred, the button SHALL be named `star`, show `☆` and have the accessible name `Star <workstream>`; for a starred one, it SHALL be named `unstar`, show `★` and have the accessible name `Unstar <workstream>`. Its value SHALL be the workstream's name, escaped. The buttons SHALL show the stars as kept when the part holding them is drawn, so that a star set while the page is still arriving shows in every part after it. Without a script, pressing a button SHALL submit the form.

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

#### Scenario: A star set while the page arrives

- **GIVEN** a project's page whose first part has been sent with `alpha` not starred, and whose reads have not ended
- **WHEN** `alpha` is starred, and then the reads end
- **THEN** the parts sent after the star show `alpha` starred
