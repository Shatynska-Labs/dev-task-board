# Test plan: hold-the-page-while-reading

Tests derived from this change's delta specs (`specs/board-pages/spec.md`, `specs/project-reads/spec.md`) before implementation, by an author who has not read the implementation. This file is not an artifact the OpenSpec schema knows about: it does not appear among `openspec instructions apply`'s context files and must be read on purpose before implementing.

All new tests are in `tests/hold-the-page-while-reading.test.ts`. Select one with `npx vitest run tests/hold-the-page-while-reading.test.ts -t "<name>"`, where `<name>` is the full name below (describe names and test name joined by spaces; `-t` also matches any unique part). The pass added tests and edited, deleted or disabled none.

## Tests written

| Id | Full name |
|----|-----------|
| T1 | A page being read says so > Held, then read > marks the first part's read time Being read again, and the last part's read time not at all |
| T2a | A page being read says so > Nothing held > marks the first part Being read, for a project still on its first read whose reads do not end |
| T2b | A page being read says so > Nothing held > marks the first part Being read, for a project whose reads have only failed whose reads do not end |
| T3 | A page being read says so > The quick part > marks the quick part's read time GitHub still being read, reading Read from git alone; statuses may be wrong. |
| T4 | A page being read says so > Reduced motion > turns the mark in the page's style, and stops it under prefers-reduced-motion: reduce |
| T5a | A project's page shows its document > The heading stays in view > holds the heading sticky at top 0, under a workspace's link, and each part's read time fixed |
| T5b | A project's page shows its document > The heading stays in view > holds the heading sticky at top 0, under tabs, and each part's read time fixed |
| T6 | A project's page shows its document > The heading stays in view > holds no script placing the heading or the read time |
| T7 | A project's page shows its document > A link lands below the heading > gives every element with an id a non-zero scroll-margin-top |
| T8 | A project's page shows each read as it arrives > Quick, then full > holds, for a project holding no document, the first part, then the quick document marked as from git alone, then the full document |
| T9 | A project's page shows each read as it arrives > Full first > holds, for a project holding no document, the first part and then the full document, and no quick part |
| T10 | A project's page shows each read as it arrives > A quick read that fails > adds, for a project holding no document, no part saying the quick read failed |
| T11 | A project's page shows each read as it arrives > A held document, no quick part > holds the first part and then the full document, and no part marked as from git alone, where a quick read would have ended first |
| T12 | The first part shows what is held > A held document > sends, before the reads end, a first part holding the document's tasks, alpha starred, Read and its time marked Being read again, and no id alpha, after the stars form |
| T13a | The first part shows what is held > Nothing held > says in the first part, for a project still on its first read, that it is being read, marked Being read, and shows no document |
| T13b | The first part shows what is held > Nothing held > says in the first part, for a project whose reads have only failed, that it is being read, marked Being read, and shows no document |
| T14 | The first part shows what is held > Held, then the reads > holds the held part and then the full document, in that order, and no quick part |
| T15 | A project's page starts a quick read beside the full one > Both reads start > runs the tool twice, overlapping, once with gh unable to log in, for a project holding no document |
| T16 | A project's page starts a quick read beside the full one > A quick read is not held > holds what it held before, for a project holding no document, once its quick read ends and its full read has not |
| T17 | A project's page starts a quick read beside the full one > No account is used > asks gh for a token once, by the full read, for a project holding no document in a workspace with a github_account |
| T18 | A project's page starts a quick read beside the full one > A held document starts no quick read > runs the tool once, as the full read, for a project holding a document |
| D1 | the style checks discriminate > finds no held heading where the heading is not sticky, and finds it where it is |
| D2 | the style checks discriminate > finds no fixed read time where it is placed absolutely or only on a wide page, and finds it where it is fixed |
| D3 | the style checks discriminate > names an id with no scroll-margin-top, or a zero one, and none where [id] has one |
| D4 | the style checks discriminate > finds a script placing the heading where one sets its position, and none where the script only scrolls |
| D5 | the style checks discriminate > finds no turning mark without an animation or with no stop under reduced motion, and finds both where they are |

## Scenarios and their tests

29 scenarios in the delta specs; 29 accounted for below. Where a scenario of a MODIFIED requirement is unchanged word for word and an existing test still bears on it as it stands, that existing test is named as its coverage rather than duplicated; every scenario whose text or meaning changed has new tests.

### board-pages, ADDED "A page being read says so"

| # | Scenario | Covered by |
|---|----------|------------|
| 1 | Held, then read | T1 |
| 2 | Nothing held | T2a, T2b |
| 3 | The quick part | T3 |
| 4 | Reduced motion | T4 (with D5) |

### board-pages, MODIFIED "A project's page shows its document"

| # | Scenario | Covered by |
|---|----------|------------|
| 5 | The sections (unchanged) | existing `tests/render.test.ts` "A project's page shows its document > The sections > puts each in its section, in order", "> shows a task in work with its stage", "> opens a workstream with <details> to its steps", "> puts the unplaced task inside its workstream, marked" |
| 6 | A project with no workstreams (unchanged) | existing `tests/render.test.ts` "A project's page shows its document > A project with no workstreams > shows its tasks, and no workstream section" |
| 7 | The time of the read (unchanged) | existing `tests/refresh-render.test.ts` "A project's page shows its document > The time of the read > shows it to the second, in UTC" |
| 8 | Only the time of the read (unchanged) | existing `tests/read-time-only.test.ts` "A project's page shows its document > Only the time of the read" (all five tests) |
| 9 | The heading stays in view | T5a, T5b, T6 (with D1, D2, D4) |
| 10 | A link lands below the heading | T7 (with D3), in part; see the deliberately untested part below |
| 11 | The time level with the name | **Uncovered**: needs a real browser's layout, which no test here can measure. To be checked by hand against the running board under task 2.2: at a wide window and at 320px, with tabs taking one line (two workspaces) and without (one workspace), the read time's top is level with the name's, at the right, below the tabs' line. |

### board-pages, MODIFIED "A project's page shows each read as it arrives"

| # | Scenario | Covered by |
|---|----------|------------|
| 12 | The first part comes at once (unchanged) | existing `tests/open-pages-at-once.test.ts` "A project's page shows each read as it arrives > The first part comes at once > sends the tabs, the heading and a part saying it is being read before the reads end"; existing `tests/held-document-first.test.ts` "A project's page shows each read as it arrives > The first part comes at once > sends the tabs, the heading and a first part showing what is held before the reads end" |
| 13 | Quick, then full | T8 |
| 14 | Full first | T9 |
| 15 | A quick read that fails | T10 |
| 16 | A held document, no quick part | T11 |
| 17 | Only the latest is seen (unchanged) | existing `tests/open-pages-at-once.test.ts` "A project's page shows each read as it arrives > Only the latest is seen > styles %s to hide every phase followed by another" (both cases); existing `tests/held-document-first.test.ts` "A project's page shows each read as it arrives > Only the latest is seen > styles a page with a held part to hide every phase followed by another" |

### board-pages, MODIFIED "The first part shows what is held"

| # | Scenario | Covered by |
|---|----------|------------|
| 18 | A held document | T12 |
| 19 | A kept document held (unchanged) | existing `tests/held-document-first.test.ts` "The first part shows what is held > A kept document held > shows in the first part the kept document's tasks, how long it was kept and the failed read's reason" |
| 20 | Nothing held | T13a, T13b |
| 21 | Held, then the reads | T14 |

### project-reads, MODIFIED "A project's page starts a quick read beside the full one"

| # | Scenario | Covered by |
|---|----------|------------|
| 22 | Both reads start | T15 |
| 23 | A quick read is not held | T16 |
| 24 | The full read ends first (unchanged; its arrangement holds no document) | existing `tests/open-pages-at-once.test.ts` "A project's page starts a quick read beside the full one > The full read ends first > stops the quick read" |
| 25 | No account is used | T17 |
| 26 | Joining a read at start (unchanged; a project being read by the pass at start holds no read document) | existing `tests/open-pages-at-once.test.ts` "A project's page starts a quick read beside the full one > Joining a read at start > starts no second full read, and starts a quick read" |
| 27 | Two requests during one quick read (unchanged; its arrangement holds no document) | existing `tests/open-pages-at-once.test.ts` "A project's page starts a quick read beside the full one > Two requests during one quick read > starts no second quick read" |
| 28 | Nothing quick at start (unchanged) | existing `tests/open-pages-at-once.test.ts` "A project's page starts a quick read beside the full one > Nothing quick at start > runs only full reads in the pass at start" |
| 29 | A held document starts no quick read | T18 |

No `REMOVED` or `RENAMED` delta exists in this change.

## Assertion classification

**Specified** (traces to a delta's text):

- T1: the first part carries one mark, named `Being read again`; the first part shows `↻ Read <YYYY-MM-DD HH:MM:SS> UTC` (mark first, then `Read <time>`); the last part shows the full document with `Read <time of the new read>` and carries no `↻`.
- T2a/T2b, T13a/T13b: the first part carries one mark, named `Being read`; T13: it says the project is being read, shows no `<li>`, does not show the failed reason, does not show `Shown as read`.
- T3: the quick part carries one mark, named `GitHub still being read`; its visible text holds `↻ Read from git alone; statuses may be wrong.`; the old line `GitHub still being read, so` is not visible text.
- T4: the style turns the mark and stops it under `prefers-reduced-motion: reduce`.
- T5a/T5b: an element enclosing the project's name, and one enclosing each workspace link or tab, takes `position: sticky` and `top: 0`; the read time in every part takes `position: fixed`.
- T7: every element with an `id` takes a non-zero `scroll-margin-top`.
- T8–T10: as the scenarios state, for a project holding no document (part count, order, `git alone`, `statuses may be wrong`, no `quick-refused`).
- T11, T14: two parts only, held then full, no `quick-task`, no `git alone`; T14 also: the held part shows `↻ Read <held time>`.
- T12: the first part arrives before the reads end, holds `held-task`, `↻ Read 2026-11-01 22:18:05 UTC`, one mark named `Being read again`, `alpha` as `unstar` naming form `stars`, no id `alpha`, the `stars` form before it, and no `Shown as read`.
- T15–T17: as the scenarios state (tokens of each run, overlap, one token request by the full read).
- T18: with a document held, no quick run starts while the full read is held, and the runs are exactly the start pass's full read and the page's full read.

**Derived** (the author's inference; reconsiderable, never repairable as a "broken test"):

- How the mark is found: an element whose only content is `↻` (raw or as `&#x21bb;`/`&#8635;`), its name read from `aria-label`, else `title` (design decision 2 gives `role="img"`, `title` and `aria-label`; the spec says only "named"). A `↻` that is a bare text node, not in its own element, is not found.
- "Begins its read time with the mark": read as the visible text `↻ Read …` / `↻ Read from git alone…` with only whitespace between.
- T4: "turns" read as a rule at every width selecting one of the mark element's classes with a non-`none` `animation`/`animation-name`, plus a `@keyframes` that contains `rotate`; "stops" read as a rule selecting that class inside `@media (prefers-reduced-motion: reduce)` with `animation: none`, `animation-name: none` or `animation-play-state: paused`. A mark with no class fails. An implementation that animates only under `prefers-reduced-motion: no-preference` would satisfy the requirement's prose but fail this test; the scenario names `reduce`, so this reading was kept.
- T5: "the heading" located as the elements enclosing the project's name text node and each workspace link (`/work`, `/other`) before the first part, not by the class `header.project` the design names; `sticky`/`top: 0` must be in one rule outside any `@media` block ("on a narrow page too"); "read time" located as the text `Read` after `>` in each part; `fixed` must be declared outside any `@media` block and no `@media` rule may give that element another position.
- T6: "the page holds no script for either" read as: no `<script>` sets `.style.position`/`.style.top`, calls `setProperty("position"|"top")`, or names `"sticky"`/`"fixed"` as a string.
- T7: a selector applies where it is `[id]` (optionally `*[id]` or `<tag>[id]`), or a tag/class selector whose subject matches the element; a value of `0` (any unit) counts as none; declared outside any `@media` block. T7 also asserts the last part holds exactly one element with id `alpha` (precondition that ids are present).
- T1: at least two parts (the change does not fix whether the current quick part appears in its arrangement).
- T3: the quick part read from the received body while the full read is held, 100 ms after `quick-task` arrives.
- T11, T14, T18: 600 ms after the page's full read starts is taken as long enough for a quick read that does not wait to have started and ended; T16: "before the request" read as what the project holds after both reads started and before the quick read ended, and the held state not holding `quick-task`.
- T14: the order check over the whole visible body (`Read <held time>`, `held-task`, `full-task`).
- D1–D5 cases each establish only that their check can fail on the property it asserts.

**Deliberately untested**:

- Scenario 11, "The time level with the name": layout, by hand under task 2.2 (see above).
- Scenario 10's "at least as tall as the heading": the heading's rendered height is layout; T7 asserts only a non-zero `scroll-margin-top` on every id. Add to the task 2.2 hand check: follow a link to a workstream (`#<name>`) at a wide window and at 320px, with and without tabs, and see the workstream land below the heading and its fade.
- The mark turning "once every 1.2 seconds", the fade's 28px height, `z-index` order, the stamp's `right`, width and 36px height, `body:has(.tabs)` tops: design values, not requirements; left to the hand check.
- "SHALL need no script" for the turning mark: covered only insofar as T4 finds the turning in CSS.

## Static checks: red at authoring, and their discriminators

T4, T5a, T5b, T6 and T7 read the page's served CSS and script rather than running a browser (a static read). Recorded at authoring: T4 red (no mark element exists, so no class to find), T5a and T5b red (no sticky heading at top 0 / no fixed read time), T7 red (`stars` and `alpha` take no `scroll-margin-top`). T6 is green at authoring (no script places the heading), which by itself establishes nothing; D4 runs its check over a supplied script that does place it and one that does not. D1, D2, D3 and D5 run the T5, T7 and T4 checks over supplied styles without and with the property; all five discriminators pass, so each check can fail.

## Obsolete tests (candidates for human confirmation)

Each is a **candidate for human confirmation**, not a conclusion. None was edited, deleted or disabled. Search: within `tests/**/*.test.ts` only, by grep for `Shown as read`, `being read again`, `GitHub`, `git alone`, `stamp`, `position`, `quick`, `reads.start()` and waits on three tool starts, then reading `tests/held-document-first.test.ts`, `tests/open-pages-at-once.test.ts` and `tests/part-layout.test.ts` in full and the arrangement of `tests/stars-parts.test.ts`, `tests/star-in-place-server.test.ts`, `tests/star-in-place-script.test.ts` and `tests/stars-server.test.ts`. Other test files were not read in full: no further bearing test was found by this search, which is not the same as none existing. No earlier `test-plan.md` was supplied.

| File | Test | Superseding delta | Evidence |
|------|------|-------------------|----------|
| `tests/held-document-first.test.ts` | The first part shows what is held > A held document > sends, before the reads end, a first part holding the document's tasks, alpha starred, the line of when it was read, and no id alpha, after the stars form | MODIFIED "The first part shows what is held" (read time `Read <time>` with the mark named `Being read again`) | asserts `Shown as read ${documentReadShown}; being read again.` |
| `tests/held-document-first.test.ts` | The first part shows what is held > Held, then the reads > holds the held part, then the quick part, then the full document, in that order | MODIFIED "The first part shows what is held", scenario "Held, then the reads" (no quick part); MODIFIED project-reads requirement | waits for three tool starts with a document held, expects three parts with `quick-task` in the second, and `Shown as read …; being read again.` |
| `tests/held-document-first.test.ts` | A project's page shows each read as it arrives > Quick, then full > holds the first part, then the quick document marked as from git alone, then the full document | MODIFIED "A project's page shows each read as it arrives" (quick part only where nothing was held); MODIFIED project-reads requirement | arranged with `boardHolding` (a document held), waits for three starts and expects a quick part; also expects `GitHub` in the quick part's visible text |
| `tests/held-document-first.test.ts` | A project's page shows each read as it arrives > Full first > holds the first part and then the full document, and no quick part | MODIFIED "A project's page shows each read as it arrives" (scenario now given a project holding no document); MODIFIED project-reads requirement | arranged with a document held, waits for `startsOf(m) === 3`, which needs a quick read that will no longer start |
| `tests/held-document-first.test.ts` | A project's page shows each read as it arrives > A quick read that fails > adds no part saying the quick read failed | as above | arranged with a document held, waits for the line `end quick`, which needs a quick read that will no longer start |
| `tests/open-pages-at-once.test.ts` | A project's page starts a quick read beside the full one > A quick read is not held > holds what it held before the request after the quick read ends | MODIFIED project-reads "A project's page starts a quick read beside the full one" (no quick read where a read document is held) | runs `reads.start()` first, so the project holds a document, then waits for three starts and for `quick-task` |
| `tests/open-pages-at-once.test.ts` | A project's page shows each read as it arrives > Quick, then full > holds the being-read part, the quick document marked as from git alone, then the full document | ADDED "A page being read says so", scenario "The quick part" (read time `Read from git alone; statuses may be wrong.`, `GitHub still being read` as the mark's name) | asserts `parts[1]` visible text matches `/GitHub/`; under the new wording `GitHub` is in an attribute, so this holds only if other visible text in the quick part names GitHub |
| `tests/part-layout.test.ts` | the parts of a project's page > marks the quick part as from git alone in a stamp, not a block above the document | ADDED "A page being read says so" (the mark begins the quick part's read time) | regex `<p class="stamp">[^<]*git alone[^<]*<\/p>` admits no element inside the stamp before the text |
| `tests/part-layout.test.ts` | the parts of a project's page > still says what the quick read missed, beside its stamp | as above | regex `<p class="stamp">[^<]*git alone` |
| `tests/part-layout.test.ts` | the parts of a project's page > gives every stamp one fixed height, so no part's document starts lower | MODIFIED "A project's page shows its document" (read time at the right of the name, level with it, held by `position: fixed`) | asserts the style holds `position: absolute;[^}]*[^-]height: 36px` |

## Unresolved project questions

1. **No stack skill.** The library carries no TypeScript or Vitest skill; the tests were written on the `testing` floor and the idiom of this project's existing tests. Depends: all tests.
2. **How the mark is named and found** (see Derived): assumed an element holding `↻` alone, named by `aria-label` or `title`, per design decision 2. Depends: T1–T4, T12, T13a/b, T14.
3. **What "turns" and "stops" mean in CSS** (see Derived): assumed an animation with a rotating `@keyframes`, stopped inside `@media (prefers-reduced-motion: reduce)`. Depends: T4.
4. **The heading's height for `scroll-margin-top`**: no stated value; assumed non-zero suffices for a static check, the rest by hand. Depends: T7.
5. **Timing margins** (600 ms for a quick read that would have ended; 300 ms for a first part to settle), as existing tests use similar margins. Depends: T11, T14, T18, T2, T12, T13.

## Missing shared arrangement

The dispatch named `tests/support/` as the shared arrangement (`document.ts`, `fixture.ts`, `page.ts`, `temporary.ts`; `build.ts` is the global setup). It was used read-only: `fullDocument`, `step`, `workstream` from `document.ts`; `isolatedEnvironment` from `fixture.ts`; `attribute`, `decode`, `enclosing`, `expectInOrder`, `matches`, `selectorsDeclaring`, `takesRule`, `textNodeAt`, `textOf` and the types `Compound`, `Element` from `page.ts`; `temporaryDirectory`, `removeTemporaryDirectories` from `temporary.ts`. Everything else the tests need is declared locally in `tests/hold-the-page-while-reading.test.ts`:

| Declared | Stands in for | Used by | Near-miss in shared arrangement | Found in test module | Proposed home |
|----------|---------------|---------|----------------------------------|----------------------|---------------|
| `stubStars` | the `Stars` port, in memory | T2, T4–T7, T12, T13 (via `serve`), T1, T3, T8–T11, T14–T18 (via `board`) | none | `tests/held-document-first.test.ts`, `tests/stars-parts.test.ts`, `tests/star-in-place-server.test.ts` | a new `tests/support/ports.ts` |
| `heldReads` | the `reads` port holding a given state, reads never ending | T2, T4, T12, T13 | none | `tests/held-document-first.test.ts` | `tests/support/ports.ts` |
| `settledReads` | the `reads` port holding a read document, reads ending at once with no quick document | T5a, T5b, T6, T7 | none | similar `stubReads` in `tests/star-in-place-script.test.ts`, `tests/stars-server.test.ts`, `tests/star-in-place-server.test.ts` | `tests/support/ports.ts` |
| `serve` | a server over a stub `reads` port and `stubStars` | T2, T4–T7, T12, T13 | none | `serveHeld` in `tests/held-document-first.test.ts` | `tests/support/ports.ts` |
| `alphaDocument`, `heldAlpha` | a document with workstream `alpha` and one step, and a read state holding it | most tests | `document.ts` `fullDocument`/`step`/`workstream` (composed, not replaced) | `tests/held-document-first.test.ts` | `tests/support/document.ts` |
| `open`, `Opened`, `delay`, `waitUntil`, `firstPartOf` | an HTTP client reading a page as it arrives, and polling | every server test | none | `tests/held-document-first.test.ts`, `tests/open-pages-at-once.test.ts` | a new `tests/support/http.ts` |
| `phaseTag`, `phaseStarts`, `phases`, `beforePhases`, `shown`, `tagsWithId`, `starButtons`, `utc` | reading a page's parts, visible text, ids, star buttons and a formatted time | most tests | `page.ts` `textOf` (used inside `shown`) | `tests/held-document-first.test.ts`, `tests/open-pages-at-once.test.ts` | `tests/support/page.ts` |
| `marksIn`, `markNames`, `hasMark`, `Mark` | reading the update mark and its name | T1–T4, T12, T13 | none | none | `tests/support/page.ts` |
| `stylesOf`, `atBlocks`, `withoutMedia`, `asStyle`, `heldAtTop`, `fixedAt`, `idsWithoutScrollMargin`, `classRule`, `turns`, `stopsUnderReducedMotion`, `readTimeAt`, `scriptPlaces`, `sticky`, `fixed` | reading the page's CSS and script for position, scroll margin and animation | T4–T7, D1–D5 | `page.ts` `selectorsDeclaring`/`takesRule` (used): they skip selectors holding `:` or `[`, so cannot see `[id]`, and do not tell rules inside `@media` blocks from those at every width | none | `tests/support/page.ts` (or a new `tests/support/style.ts`) |
| `machine`, `Machine`, `Run`, `started`, `endedRuns`, `tokenRequests` | a stub `gh` (tokens per account, no login where `GH_CONFIG_DIR` cannot be made) and a stub carried tool (logs starts with tokens, hold/release/fail per kind) | T1, T3, T8–T11, T14–T18 | `fixture.ts` `isolatedEnvironment` (used as the base): its `gh` stub always fails, so a full read cannot be told from a quick one | `tests/held-document-first.test.ts`, `tests/open-pages-at-once.test.ts` (the token handling) | `tests/support/fixture.ts` |
| `board`, `boardHolding`, `running`, `roots`, `outgoing` | a board over `createReads` and the machine, optionally after one read so a document is held | T1, T3, T8–T11, T14–T18 | none | `tests/held-document-first.test.ts`, `tests/open-pages-at-once.test.ts` | `tests/support/fixture.ts` |
| `documentRead`, `documentReadShown`, `unset`, `oneWorkspace`, `twoWorkspaces` | fixed values | various | `document.ts` `WRITTEN_AT` (a different time) | `tests/held-document-first.test.ts`, `tests/open-pages-at-once.test.ts` | with the builders above |

## Baseline

Full suite with `npm test` (which runs `vitest run --exclude tests/package.test.ts`; its global setup runs the build) before any test was written: 37 files passed, 641 tests passed, 2 skipped, none failing.

After adding `tests/hold-the-page-while-reading.test.ts`: 38 files, 653 passed, 2 skipped, 14 failed, all 14 in the new file, each a wrong value from code that ran (no missing target):

- T1, T2a, T2b, T3, T12 (first assertion reached that fails: no mark, or `Shown as read` in place of `↻ Read`), T13a, T13b: no mark element.
- T4: no mark element, so no class to check.
- T5a, T5b: no sticky heading at top 0, no fixed read time. T7: `stars` and `alpha` have no `scroll-margin-top`.
- T11, T14: three parts, a quick part after the held one. T18: a quick run starts with a document held.

The 12 that pass now: D1–D5 (discriminators); T6 (static, discriminated by D4); T8, T9, T10, T15, T16, T17, which state behaviour for a project holding no document that this change leaves as it is, so code that already exists satisfies them.
