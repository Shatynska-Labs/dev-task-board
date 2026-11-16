# Test plan: star-without-reloading

Derived from the approved plan at commit `2c25b8b`, from `specs/board-pages/spec.md` only. No implementation source was read. This file is not an artifact the OpenSpec schema knows: `openspec instructions apply` does not list it, so read it on purpose before implementing.

Run one test with `npx vitest run <file> -t "<describe> <describe> <it>"`; the names below are given in that form, as `<file> :: <full name>`.

New test files:

- `tests/star-in-place-script.test.ts` — the project page's script, taken from the page the server serves and fed part by part into a `happy-dom` window, with `fetch`, `sessionStorage`, the page's reach and scroll events under the test's control (design decisions 2 and 8).
- `tests/star-in-place-server.test.ts` — what a served page carries: block keys, scripts, the phase style, the one stars form, stars per part.

## Baseline

- **Before**: full run of `npm test`, with `happy-dom` installed (task 1.1's uncommitted `package.json`/`package-lock.json`): 34 files, 611 passed, 2 skipped, 0 failed.
- **After adding these tests**: 36 files; 614 passed (the 611, plus 3 new), 2 skipped, 24 failed, every failure in the two new files.

## Failure states at authoring

- **Target absent (state 2)**, 23 tests: every test in `tests/star-in-place-script.test.ts` and 4 in `tests/star-in-place-server.test.ts` (the key tests and "Only a project's page has a script"). The page has no `data-key` and no script yet. Their assertions have not run against an implementation and are unverified until it exists.
- **Wrong value (state 1)**, 1 test: `tests/star-in-place-server.test.ts :: A workstream shows its star A star set while the page arrives shows alpha starred in the part sent after the star`. It fails with `expected 'star' to be 'unstar'` because the server takes the stars once per request (decision 7). This shows the test can fail on the property it checks.
- **Passed on first run**, 3 tests: `tests/star-in-place-server.test.ts :: A project's page shows each read as it arrives Only the latest is seen styles /work/one …` and `… styles /work …`, and `… A workstream shows its star One form for every part …`. These are not alarms. They are revised scenarios whose remaining behaviour already exists; the revision only removed a no-script clause. They are the replacements for the obsolete tests below with that clause dropped.
- **Harness check**: the browser harness was checked against today's script-less page with a temporary test that has since been removed. Pressing a star submits `#stars` with that button, a summary click toggles its block once, an operator scroll fires one `scroll`, the reach bound clamps, and a "being read" first part is followed by a full part. This rules out the harness's basic mechanics as a cause of state 3. It does not exercise the paths that need a script.

## Scenarios (32 in the delta; 32 accounted for)

### ADDED: A star is set in place

| # | Scenario | Covered by |
|---|---|---|
| 1 | Starring in place | `tests/star-in-place-script.test.ts :: A star is set in place Starring in place sends one POST of star=alpha, leaves the page as it was, and turns alpha's star over` |
| 2 | Unstarring in place | `tests/star-in-place-script.test.ts :: A star is set in place Unstarring in place sends one POST of unstar=alpha, and turns alpha's star back` |
| 3 | Pressed twice before the answer | `tests/star-in-place-script.test.ts :: A star is set in place Pressed twice before the answer sends one POST, and shows alpha starred once it is answered` |
| 4 | A part drawn while the request was on its way | `tests/star-in-place-script.test.ts :: A star is set in place A part drawn while the request was on its way shows alpha starred in the shown part once answered` |
| 5 | The block stays as it was | `tests/star-in-place-script.test.ts :: A star is set in place The block stays as it was leaves alpha's closed block closed when its star is pressed` |
| 6 | A star that is refused | `tests/star-in-place-script.test.ts :: A star is set in place A star that is refused submits the form with alpha's button, not turning it over, for a request answered 500`; `… for a request that cannot reach the board` |
| 7 | Sorted on the next load | `tests/star-in-place-script.test.ts :: A star is set in place Sorted on the next load keeps beta first after alpha is starred in place, and lists alpha first once loaded again` |

### ADDED: A project's page reopens what was open

| # | Scenario | Covered by |
|---|---|---|
| 8 | Reloaded again before the position was reached | `tests/star-in-place-script.test.ts :: A project's page reopens what was open Reloaded again before the position was reached still remembers the first position, and returns to it` |
| 9 | A reload reopens the blocks | `tests/star-in-place-script.test.ts :: A project's page reopens what was open A reload reopens the blocks opens the group and alpha in each part, closes everything else, and returns to the position` |
| 10 | A block found after the sort moved it | `tests/star-in-place-script.test.ts :: A project's page reopens what was open A block found after the sort moved it opens alpha, now listed first` |
| 11 | A block closed that is rendered open | `tests/star-in-place-script.test.ts :: A project's page reopens what was open A block closed that is rendered open keeps the group of tasks in no workstream closed on the next load` |
| 12 | Changed while the page arrives | `tests/star-in-place-script.test.ts :: A project's page reopens what was open Changed while the page arrives carries alpha closed and beta opened into the next part` |
| 13 | A first part that holds nothing | `tests/star-in-place-script.test.ts :: A project's page reopens what was open A first part that holds nothing opens alpha in the full part, and returns to the remembered position`; `… opens alpha in the full part, and leaves the position where the operator scrolled meanwhile` |
| 14 | Nothing remembered, a block rendered open | `tests/star-in-place-script.test.ts :: A project's page reopens what was open Nothing remembered, a block rendered open shows the group of tasks in no workstream open, as rendered, once the full part arrives` |
| 15 | Nothing remembered | `tests/star-in-place-script.test.ts :: A project's page reopens what was open Nothing remembered shows every block open or closed as rendered, in each part, at the top` |
| 16 | Storage that cannot be used | `tests/star-in-place-script.test.ts :: A project's page reopens what was open Storage that cannot be used shows the page as rendered after it is left and loaded again, and its stars still work` |
| 17 | A task's key | `tests/star-in-place-server.test.ts :: A project's page reopens what was open A task's key keys t1's row under alpha task:alpha:t1, and t2's in no workstream task::t2`. The requirement's other key kinds are covered by `… Each block's key keys each workstream, the group of other workstreams and the group of tasks in no workstream by what it shows` and `… Each block's key escapes a workstream's name in its key` |

### MODIFIED: A page shows what was read for it

Scenarios 18–22 read the same before and after the change; only the requirement's script sentence changed. They are accounted for by the existing tests that already assert them, rather than by duplicates (see unresolved question 5).

| # | Scenario | Covered by |
|---|---|---|
| 18 | A refresh shows a change | existing: `tests/open-pages-at-once.test.ts :: A page shows what was read for it A refresh shows a change shows the change in the page's last part` |
| 19 | A read past its limit | existing: `tests/open-pages-at-once.test.ts :: A page shows what was read for it A read past its limit ends the page, with that reason` |
| 20 | A request from another site | existing: `tests/open-pages-at-once.test.ts :: A page shows what was read for it A request from another site answers` (the `it.each` over `/work/one` and `/work`) |
| 21 | A request from the reader | existing: `tests/open-pages-at-once.test.ts :: A page shows what was read for it A request from the reader answers a project's page normally given` (the `it.each`) |
| 22 | Not cached | existing: `tests/open-pages-at-once.test.ts :: A page shows what was read for it Not cached sends` (the `it.each`) |
| 23 | Only a project's page has a script | new: `tests/star-in-place-server.test.ts :: A page shows what was read for it Only a project's page has a script sends the overview with no <script>, and the project's page with only inline scripts and no handler attributes`; `tests/star-in-place-script.test.ts :: A page shows what was read for it Only a project's page has a script lets the project's script start no read and request no page, through loading, opening a block, scrolling and leaving` |

### MODIFIED: A project's page shows each read as it arrives

| # | Scenario | Covered by |
|---|---|---|
| 24 | The first part comes at once | existing (unchanged text): `tests/held-document-first.test.ts :: A project's page shows each read as it arrives The first part comes at once sends the tabs, the heading and a first part showing what is held before the reads end` |
| 25 | Quick, then full | existing (unchanged text): `tests/held-document-first.test.ts :: A project's page shows each read as it arrives Quick, then full holds the first part, then the quick document marked as from git alone, then the full document` |
| 26 | Full first | existing (unchanged text): `tests/held-document-first.test.ts :: A project's page shows each read as it arrives Full first holds the first part and then the full document, and no quick part` |
| 27 | A quick read that fails | existing (unchanged text): `tests/held-document-first.test.ts :: A project's page shows each read as it arrives A quick read that fails adds no part saying the quick read failed` |
| 28 | Only the latest is seen (revised: "and it carries no `<script>`" dropped) | new: `tests/star-in-place-server.test.ts :: A project's page shows each read as it arrives Only the latest is seen styles /work/one to hide every phase followed by another`; `… styles /work to hide every phase followed by another` |

### MODIFIED: A workstream shows its star

| # | Scenario | Covered by |
|---|---|---|
| 29 | Not starred | existing (unchanged text): `tests/stars-server.test.ts :: A workstream shows its star Not starred gives alpha's summary a button named star, valued alpha, showing ☆, called Star alpha, submitting a form posting to /work/one` |
| 30 | Starred | existing (unchanged text): `tests/stars-server.test.ts :: A workstream shows its star Starred gives alpha's summary a button named unstar, valued alpha, showing ★, called Unstar alpha` |
| 31 | One form for every part (the existing test also asserts the superseded no-script clause) | new: `tests/star-in-place-server.test.ts :: A workstream shows its star One form for every part holds exactly one form with id stars, and every star button in either part names it` |
| 32 | A star set while the page arrives | new: `tests/star-in-place-server.test.ts :: A workstream shows its star A star set while the page arrives shows alpha starred in the part sent after the star` |

Uncovered scenarios: none. Every scenario has at least one named test. There are no `REMOVED` or `RENAMED` deltas.

## Assertion classification

**S** = specified (traces to the delta spec). **D** = derived (inferred, or taken from `design.md` rather than the spec). **U** = deliberately untested.

### `tests/star-in-place-script.test.ts`

- Starring in place: one request; `POST`; same origin, path `/work/one`; body exactly `star=alpha`; `redirect` is `manual` or `error`, so the redirect is not followed — **S**. No form submission, same `document`, same `location` — **S** ("not reloaded or left"). Name `unstar`, mark `★`, accessible name `Unstar alpha` — **S**. `aria-pressed` equal to what the server renders for a starred `alpha` — **D**: the spec requires `aria-pressed` but gives no value, so the rendered page's value is taken. Group still open, every `details` keeping its open state, `scrollY` unchanged, order unchanged — **S**. Precondition `beta` before `alpha` — **S** (the scenario's arrangement).
- Unstarring: body `unstar=alpha`, name `star`, `☆`, `Star alpha` — **S**. `aria-pressed` equal to the rendered unstarred value — **D**. No submission — **S**.
- Pressed twice: one request — **S**. `★` once answered — **S**. No form submission from the second press — **D** (a reading of "ignored").
- Part drawn on the way: the new part shows `☆` before the answer (precondition) and `unstar`/`★`/`Unstar alpha` after it — **S**.
- Block stays: closed after the press and after the answer — **S**.
- Refused (500; network failure): one submission of the form with id `stars`, whose submitter is the pressed button; the button is still `star`/`☆`/`Star alpha` — **S**.
- Sorted on next load: order `gamma, beta, alpha` before the star and still after it — **S**. After reloading, `gamma, alpha, beta` — **S** (with the existing ordering rules). `Stars` holds `alpha` after the forwarded request — **D** (sanity check that the request reached the board).
- Reloaded again before reached: on the short load, `scrollY` is 100 (the script scrolled as far as the first part reaches) — **D**. On the third load, `scrollY` is 600 — **S**.
- Reload reopens: the keys present include `other`, `loose`, `workstream:*`, `task:alpha:a-1` — **D** (precondition naming the blocks). In each part, `other` and `workstream:alpha` are open and every other keyed block is closed — **S**. `scrollY` is 300 — **S**.
- Block found after sort: `alpha` listed first — **S**. `alpha` open — **S**. `beta` closed — **D**.
- Block closed rendered open: `loose` open as rendered (precondition), and closed on the first and last part of the reload — **S**.
- Changed while arriving: `alpha` open on the first part (precondition: remembered) — **S**. After the operator's changes, `alpha` closed and `beta` open in the next part — **S**.
- First part holds nothing: the first part has no keyed block — **S**. `alpha` open in the full part, `scrollY` 400 — **S**. With the operator having scrolled to 30, `scrollY` stays 30 — **S**.
- Nothing remembered, rendered open: `loose` open — **S**.
- Nothing remembered: each part's keyed blocks match the markup's `open` attributes — **S**. `scrollY` 0 — **D**.
- Storage unusable: blocks as rendered — **S**. `scrollY` 0 — **D**. The star sends its request and turns over, with no submission — **S**.
- Only a project's page has a script (run): no `fetch`, no submission, same `location` and `document`, through loading, opening a block, scrolling and leaving — **S** ("start no read and request no page of its own").

### `tests/star-in-place-server.test.ts`

- A task's key: exactly one block keyed `task:alpha:t1` and one keyed `task::t2` in the shown part — **S** (values). The attribute is `data-key` — **D** (design decision 4). Each block's summary shows its task's name — **D**.
- Each block's key: `workstream:alpha`, `workstream:beta`, `other`, `loose`, `task:alpha:t1`, `task:beta:t3`, `task::t2` present — **S** (from the requirement's text). Every `details` carries a key — **D** (design decision 4: "each `details`"). `workstream:alpha`'s summary holds `alpha`'s star — **D**. `workstream:beta` sits inside `other` — **D**.
- Escaped key: a name with `" < > &` round-trips through the attribute, and is not written raw — **D** (design decision 4).
- Only a project's page has a script (markup): the overview holds no `<script>` — **S**. The project page holds at least one `<script>` — **S**. No script has `src` — **D** (design decision 1: inline). No `on*=` handler attributes — **D**.
- Only the latest is seen: the `.phase:has(~ .phase){display:none}` rule on `/work/one` and `/work` — **S**.
- One form for every part: three parts, the quick part holding `quick-task` and the full part `full-task` — **D** (arrangement check). Exactly one form, and one element, with id `stars`; star buttons in both parts; every star button has `form="stars"` — **S**.
- A star set while arriving: the first part shows `alpha` as `star` — **S**. Every part sent after the star shows `unstar` — **S**.

### Deliberately untested (U)

- That the view is kept per tab and per path, e.g. that another project's page does not reopen this one's blocks. The scenarios do not state it, and testing it would mean asserting design decision 5's storage key.
- What is stored and in what format (`dev-task-board:view:<path>`, `{"open":…,"y":…}`). This is a design detail. The tests carry the tab's storage across loads opaquely and assert behaviour only.
- `history.scrollRestoration = "manual"` (design decision 6). happy-dom does no scroll restoration of its own, so the test could not tell the setting apart from its absence.
- The order in a real browser after a star sent while parts arrive, beyond scenario 4.
- A remembered key no longer on the page being ignored. This is covered only indirectly (after a star moves `alpha`, keys still resolve). No scenario states a removed workstream, and the fixture would need a document change between loads.

## Obsolete tests (candidates for human confirmation)

These are candidates, not conclusions. They were found by searching `tests/**/*.test.ts` for `script` and reading each hit. None was edited.

1. `tests/held-document-first.test.ts :: A project's page shows each read as it arrives Only the latest is seen styles a page with a held part to hide every phase followed by another, with no script` — superseded by MODIFIED "A project's page shows each read as it arrives" (the "The page SHALL carry no script" sentence and the scenario's "and it carries no `<script>`" are gone) and MODIFIED "A page shows what was read for it". Evidence: `expect(body).not.toMatch(/<script\b/i)` on the body of `/work/one`. Its style assertion stays valid.
2. `tests/open-pages-at-once.test.ts :: A project's page shows each read as it arrives Only the latest is seen styles /work/one to hide every phase followed by another, with no script` — the `/work/one` case of the `it.each` only. The `/work` case, an overview, stays valid. Superseded by the same two deltas. Evidence: `expect(body).not.toMatch(/<script\b/i)`.
3. `tests/stars-parts.test.ts :: A workstream shows its star One form for every part holds exactly one form with id stars, and every star button in either part names it` — superseded by MODIFIED "A workstream shows its star" ("The page SHALL still carry no script" removed). Evidence: the final `expect(html).not.toMatch(/<script\b/i)` on `/work/one`. A replacement without that clause is in `tests/star-in-place-server.test.ts`.
4. `tests/stars-server.test.ts :: A workstream shows its star Every workstream carries no script` — superseded by MODIFIED "A workstream shows its star" and "A page shows what was read for it". Evidence: `expect(await pageOf(port, "/work/one")).not.toMatch(/<script\b/i)`.
5. `tests/refresh-render.test.ts :: A page shows what was read for it No script sends no script on any page` — superseded by MODIFIED "A page shows what was read for it" for its project-page inputs: `page(document)` (`renderProject`) and `renderProject("work", "alpha", failed(…))`. Evidence: `expect(html).not.toMatch(/<script/i)` over a loop including those renderings. Whether `renderProject`'s output carries the script depends on the implementation (design decision 1 puts it in the project page's head via `layoutStart`), so confirm against the implementation. Its overview and index inputs stay valid.

Examined and not obsolete: `tests/tabs-server.test.ts :: Several workspaces show as tabs Several workspaces needs no script` requests `/b` on a two-workspace board, which is an overview, so the revised requirement still holds there.

Design decision 7's superseded behaviour (stars taken once per request): this search found no test asserting it. A test asserting how many times `starred` is called could exist and not have been found, but no hit for `starred` call counts appeared in the glob.

## Unresolved project questions

1. **Stack skill.** The library carries no TypeScript/Vitest skill, so these tests follow only the general testing floor. Depends: all.
2. **The key's attribute.** The spec names keys, not where they live. The tests read them from `data-key` (design decision 4). Depends: every test calling `block`/`keyed`/`setOpen`/`toggle`, and all of `… A task's key …` and `… Each block's key …`.
3. **happy-dom fidelity.** The harness corrects three behaviours to what a browser does, assuming the browser is the reference:
   - happy-dom toggles a summary's `details` before listeners above it run, and even when the click was prevented. The harness undoes that and applies the toggle after dispatch unless prevented.
   - It does not deliver a form's `submit` to `document`. Submissions are heard on each form.
   - It lays nothing out, so nothing bounds a scroll and no `scroll` event fires. The harness bounds scrolling by a test-given reach and fires `scroll` after any position change, whoever made it.

   Consequence for the implementation: in a browser, the script's own scroll that is clamped short of the target fires a `scroll` whose `scrollY` differs from the target. Design decision 6's "any scroll event whose scrollY differs from the position the script last set" must compare against the position actually reached, not the one asked for, or scenarios 8 and 13 fail. Depends: scenarios 8, 9, 13, 15, 16 and every test that presses or toggles.
4. **The new test level.** `AGENTS.md`'s testing strategy does not yet name a level for running the page's script in `happy-dom`; task 1.1 adds it. Assumed: such tests take the page from the server, as served, and run it in `happy-dom`, in files named `*-script.test.ts`. Depends: `tests/star-in-place-script.test.ts`.
5. **Unchanged scenarios under a MODIFIED requirement** (18–22, 24–27, 29–30). Their text is the same as in `specsRoot`, and existing tests assert them. They are accounted for by those tests, not by duplicates. If the project wants each MODIFIED requirement's scenarios re-derived regardless, that is 11 more tests. Depends: those rows.
6. **"Storage that cannot be used"** is modelled as a `sessionStorage` whose every method throws. A getter that throws on access is the other form a browser takes, and it was not separately tested. Depends: scenario 16.
7. **The answer to a manual-redirect fetch** is modelled as a browser gives it: `type: "opaqueredirect"`, `status: 0`. A script checking `status === 303` would fail these tests, as it would fail in a browser. Depends: every test answering a star.
8. **Every `details` keyed.** Design decision 4 keys "each `details`", and `… Each block's key …` asserts that. A task row with no body is not a `details` today, so the fixtures give tasks bodies. Depends: the key tests, and every script test that keys a task row.

## Missing shared arrangement

`tests/support/` was named and read. It holds document builders, markup readers, fixture repositories and temporary directories. It holds no ports, no HTTP client and no browser. Nothing below was added to it. Every entry was declared locally in the file named.

| Declared | In | Stands in for | Used by | Near-miss in `tests/support/` | Found in another test module | Proposed home |
|---|---|---|---|---|---|---|
| `stubStars` | both new files | the `Stars` port (`starred`, `set`) | every test in both files | none | `tests/stars-server.test.ts`, `tests/stars-parts.test.ts`, `tests/held-document-first.test.ts` (same shape) | `tests/support/stars.ts` |
| `stubReads` (read or reading, `reset`) | `star-in-place-script` | the `reads` port | every test in that file | none | similar in `tests/refresh-server.test.ts`, `tests/keep-reads.test.ts`, `tests/held-document-first.test.ts` | `tests/support/reads.ts` |
| `stubReads` (held refresh, `release`, `refreshes`) | `star-in-place-server` | the `reads` port | every test in that file but `… One form for every part …` | none | `tests/keep-reads.test.ts` (`release`) | `tests/support/reads.ts` |
| `inactive` | both new files | an inactive workstream in the tool's document | the script tests using `mainDocument`; the key tests | `workstream` in `document.ts`: always `active: true`, with no way to set it, so it would need an option | `tests/stars-server.test.ts` | extend `workstream` in `tests/support/document.ts` |
| `serve`, `send`, `pageHtml`/`pageOf`, `star` | both new files | an HTTP client that sets `Host`, `Origin`, `Sec-Fetch-Site` | every test in both files | none | `tests/stars-server.test.ts` (`send`, `post`, `pageOf`) | `tests/support/server.ts` |
| `open`, `delay`, `waitUntil` | `star-in-place-server` | reading a page as it arrives | `… A star set while the page arrives …` | none | `tests/held-document-first.test.ts` | `tests/support/server.ts` |
| `phaseTag`, `split`, `phaseStarts`, `phases`, `starButtons`, `starButtonOf`, `scripts` | both new files | reading parts, star buttons and scripts from markup | every test in both files | `page.ts` reads rows, blocks and attributes but not phases or star buttons | `tests/stars-parts.test.ts`, `tests/held-document-first.test.ts`, `tests/stars-server.test.ts` | `tests/support/page.ts` |
| `quickThenFullBoard`, `documentOf` | `star-in-place-server` | a board over `createReads` and a stub tool whose page has a quick and a full part | `… One form for every part …` | `fixture.ts` gives the isolated environment only | `tests/stars-parts.test.ts` (`machine`, `board`) | `tests/support/fixture.ts` |
| `parsed` | `star-in-place-server` | a parsed page with no script run | the key tests | none | none | `tests/support/browser.ts` |
| `load` (the browser harness), `newTab`, `Tab`, `Call`, `redirected`, `answered`, `unreachable`, `settle`, `renderedOpen`, `starButton`, `order`, `showing`, `rendered`, `openStates`, `expectStarRequest` | `star-in-place-script` | a browser tab running the served page: fetch, session storage, layout reach, scroll events, faithful clicks | every test in that file | none | none | `tests/support/browser.ts` |

## Obsolete tests: dispositions

Each of the five was narrowed to what its modified requirement still says, changing no other assertion: 1, 2 and 3 lose their no-script assertion on a project's page (and 1 and 2 the words "with no script" from their names); 4 is removed, its whole subject being the project page's lack of a script; 5 keeps its overview and list-of-workspaces inputs and drops its project-page ones, renamed "sends no script on an overview or the list of workspaces". That an overview carries no script is also asserted by `tests/star-in-place-server.test.ts`'s "Only a project's page has a script".

## Missing shared arrangement: dispositions

Every entry above is **kept** local: each repeats helpers other test files declare locally (`stubStars`, a stub `reads`, a request helper, an HTTP client reading a page as it arrives, `phases`), which the backlog entry `share-the-test-arrangement` consolidates at once; promoting this change's copies alone would add a second shared version beside those. The browser harness (`load` and its helpers) is used by one file only, so there is nothing yet to share.
