# Test plan: show-the-held-document-first

Derived from `specs/board-pages/spec.md` as committed at `1289925`, before any implementation. This file is not an artifact the OpenSpec schema knows about: `openspec instructions apply` will not list it, so read it on purpose before implementing.

All new tests are in `tests/held-document-first.test.ts`. Select one with `npx vitest run tests/held-document-first.test.ts -t "<name>"`, the name being the `describe` path and the `it` text below.

## Baseline

Full suite, `npm test` (which excludes `tests/package.test.ts` by its own script), before any test was written, at `1289925` with `npm ci` done: 33 files, 600 passed, 2 skipped, 0 failed.

After writing: the new file has 11 tests, 8 failing and 3 passing; nothing else was touched.

## Scenarios

The delta holds nine scenarios: the `MODIFIED` requirement "A project's page shows each read as it arrives" has five and the `ADDED` requirement "The first part shows what is held" has four. All nine are accounted for below, and none is uncovered.

### The first part shows what is held (ADDED)

| Scenario | Test | State at authoring |
|---|---|---|
| A held document | `The first part shows what is held > A held document > sends, before the reads end, a first part holding the document's tasks, alpha starred, the line of when it was read, and no id alpha, after the stars form` | fails: code ran, first part shows only "This project is being read." |
| A held document | `The first part shows what is held > A held document > does not say only that the project is being read` | fails: same |
| A kept document held | `The first part shows what is held > A kept document held > shows in the first part the kept document's tasks, how long it was kept and the failed read's reason` | fails: same |
| Nothing held | `The first part shows what is held > Nothing held > says in the first part, for a project still on its first read, that it is being read, and shows no document` and `... for a project whose reads have only failed, ...` (one `it.each`) | passes: the behaviour is unchanged by the spec ("as today"); the pass is expected, not an alarm, and the test discriminates against the held-document tests once those pass |
| Held, then the reads | `The first part shows what is held > Held, then the reads > holds the held part, then the quick part, then the full document, in that order` | fails: code ran, first part lacks `held-task` |

### A project's page shows each read as it arrives (MODIFIED, scenarios as revised)

Each is written with a document held, the case the revision introduces; the existing tests in `tests/open-pages-at-once.test.ts` cover the same scenarios with nothing held.

| Scenario | Test | State at authoring |
|---|---|---|
| The first part comes at once | `A project's page shows each read as it arrives > The first part comes at once > sends the tabs, the heading and a first part showing what is held before the reads end` | fails: first part lacks `held-task` |
| Quick, then full | `A project's page shows each read as it arrives > Quick, then full > holds the first part, then the quick document marked as from git alone, then the full document` (also covered by "Held, then the reads") | fails: same |
| Full first | `A project's page shows each read as it arrives > Full first > holds the first part and then the full document, and no quick part` | fails: same |
| A quick read that fails | `A project's page shows each read as it arrives > A quick read that fails > adds no part saying the quick read failed` | fails: same |
| Only the latest is seen | `A project's page shows each read as it arrives > Only the latest is seen > styles a page with a held part to hide every phase followed by another, with no script` | passes: the style and the absence of script are unchanged; expected |

Every failure observed is state 1 (the code ran and produced a wrong value): `src/server.ts` and `src/render.ts` exist, and the assertions executed. The 8 failing tests going green as the change lands is the record that they discriminate.

## Assertion classification

Specified unless marked otherwise.

**A held document** (first test): before the reads end, the response has not ended and holds exactly one part (specified: "arrives before the reads end"; the stub's reads never end); the part's text holds `held-task` (specified: "that document's tasks"); it holds `Shown as read 2026-11-01 22:18:05 UTC; being read again.` (specified; the document's `readAt` is `2026-11-01T22:18:05.000Z`); exactly one star button valued `alpha`, named `unstar` (specified: "`alpha` starred", in the form "A workstream shows its star" gives a starred workstream); that button's `form` is `stars` (specified by "A workstream shows its star": "submits the page's one stars form"; the id `stars` is **derived** from the star-workstreams tests, which already require it); no element in the part has id `alpha` (specified); exactly one element with id `stars`, before the first part (specified: "the page's `stars` form arrives before it"; the id is derived as above).
- The text is compared after removing whitespace before `;`, `.` and `,` (**derived**: lets the time sit in its own element without changing what is read).

**A held document** (second test): the first part does not contain `This project is being read.` — **derived**: the spec says the held part shows the document under the being-read-again line, and says the being-read sentence only where nothing is held; it does not state that the sentence is absent.

**A kept document held**: the first part holds `kept-task` (specified), `30 min` between a read at `22:18:05` and a latest read at `22:48:10` (specified: "how long it was kept", in the unit form "A page marks a kept document" gives), and the reason `<b>no` as text, escaped (specified: "the failed read's reason", and "escaped" from "A page marks a kept document"). The response has not ended (specified by "whose reads do not end").

**Nothing held**: the first part matches `/being read/i` (specified); it holds neither `Shown as read` nor `being read again` (specified: "shows no document", whose sign is the line); it holds no `<li>` (**derived**: tasks are rendered as list items, per `tests/support/page.ts`'s `rowOf`); it does not hold the failure's reason (**derived**, from design.md decision 2: a failure shows in the last part once the reads settle).

**Held, then the reads**: three parts; the first holds `held-task` and `Shown as read <time of the held read> UTC; being read again.`, and neither `quick-task` nor `full-task`; the second holds `quick-task` and `git alone`; the third holds `full-task`, and neither `held-task` nor `quick-task` (all specified: the order of parts, and the third "as a page shows it today"). The time is taken from `reads.get` after the read at start and formatted as `YYYY-MM-DD HH:MM:SS UTC` (specified format).

**The first part comes at once**: not ended, one part, the head links `/a` and `/b`, the head's text holds `one`, the part holds `held-task` (specified).

**Quick, then full**: three parts in order; the first holds `held-task`; the second `quick-task`, `git alone`, `GitHub`, `statuses may be wrong`; the third `full-task` (specified).

**Full first**: two parts; first `held-task`, second `full-task`; no `quick-task` and no `git alone` anywhere (specified).

**A quick read that fails**: no `quick-refused` anywhere; two parts, first `held-task`, second `full-task` (specified; the part count is the existing tests' reading of "no part says the quick read failed", **derived** there and here).

**Only the latest is seen**: more than one part (**derived**: makes the test bear on a page with a held part); the style holds `.phase:has(~ .phase)` with `display: none`; no `<script` (specified).

**Deliberately untested**: the "notices of what is kept or missed" other than a failed read's reason (a kept document's missed trunk, branches or forge) in the held part — the scenario names only the age and the reason, and those notices are already covered for a rendered page by `tests/keep-render.test.ts`. That decision 1 takes the state before the reads start is not tested apart from its effect: a stub whose state changed on `refresh` would test the order of calls, which the spec does not state.

## Obsolete tests

The `MODIFIED` delta supersedes "a part saying the project is being read" with "a part showing what the project holds". Searched within `tests/**/*.test.ts` only, by first-part assertions (`phases(...)[0]`, `parts[0]`, "being read") and by whole-body assertions in tests whose stub `reads.get` holds a document. No earlier `test-plan.md` was supplied. Every entry is a **candidate for human confirmation**, not a conclusion.

1. `tests/refresh-server.test.ts` — `A page shows what was read for it > A refresh shows a change > answers a project's page once its read is done, with what it left`. Superseded by the `MODIFIED` "A project's page shows each read as it arrives" with the `ADDED` "The first part shows what is held". Evidence: its stub `get` holds a document whose task is `only-task` when the request comes, and it asserts `expect(body).not.toContain("only-task")` over the whole body; the held part now shows `only-task` in the first part. **Expected to fail once the change is implemented.** Its intent (the page ends with the fresh read) would be kept by asserting over the last part, as `tests/open-pages-at-once.test.ts` does; that rewrite is for whoever confirms it, not this pass.
2. `tests/open-pages-at-once.test.ts` — `A project's page shows each read as it arrives > The first part comes at once > sends the tabs, the heading and a part saying it is being read before the reads end`. Superseded wording: the scenario's THEN changed from "a part saying it is being read" to "the first part". Evidence: `expect(textOf(phases(received)[0] ?? "")).toMatch(/being read/i)`. Its board has read nothing when the page is requested, so nothing is held and the assertion stays true under "Nothing held"; **expected to stay green**. Candidate only for its name and for being re-read as the nothing-held case.
3. `tests/open-pages-at-once.test.ts` — `A project's page shows each read as it arrives > Quick, then full > holds the being-read part, the quick document marked as from git alone, then the full document`. As entry 2: `expect(parts[0]).toMatch(/being read/i)`, nothing held; expected to stay green.
4. `tests/open-pages-at-once.test.ts` — `A project's page shows each read as it arrives > Full first > holds the being-read part and then the full document, and no quick part`. As entry 2: `expect(parts[0]).toMatch(/being read/i)`, nothing held; expected to stay green.

No test was found asserting that the first part says "This project is being read." while a document is held; that is "none found by this search", not "none exists". Tests in `tests/stars-server.test.ts`, `tests/tabs-server.test.ts`, `tests/server.test.ts` and `tests/stars-parts.test.ts` were checked: the first three hold a document but assert over the last part or over things the held part does not add (tabs, escaping, script); `tests/stars-parts.test.ts` reads nothing before its page, so holds nothing. None of these was judged affected, but a held part adds a second rendering of the document to every stub-held page, and a whole-body count missed here would fail the same way as entry 1.

## Unresolved project questions

1. **No stack skill for TypeScript/Vitest** exists in the library; the pass proceeded on the testing floor alone. No test depends on an assumption from this.
2. **The `stars` form's id.** The spec says "the page's `stars` form"; the id `stars` is taken from `tests/stars-parts.test.ts`. Assumed: the form keeps id `stars`. Depends: `The first part shows what is held > A held document > sends, before the reads end, ...`.
3. **The stub `reads` port shape.** Taken from the existing server tests (`get`, `quick`, `refresh`), with `quick` and `refresh` never resolving for "whose reads do not end", and a held state of `{ state, document, readAt, latest? }` as `tests/keep-render.test.ts` gives. Assumed: the server needs nothing more from `reads`, and does not time the reads out itself before the first part is sent. Depends: every test using `serveHeld`.
4. **README.md** was named as a convention file; it states no testing convention beyond `npm test`. Nothing depends on it.

## Missing shared arrangement

The shared arrangement is `tests/support/`; the new file takes `fullDocument`, `step`, `task`, `workstream` (document.ts), `attribute`, `textOf` (page.ts), `isolatedEnvironment` (fixture.ts) and `temporaryDirectory`, `removeTemporaryDirectories` (temporary.ts) from it. Declared locally in `tests/held-document-first.test.ts`:

| Name | Stands in for | Used by | Near-miss in shared arrangement | Found in test module | Proposed home |
|---|---|---|---|---|---|
| `stubStars` | the `Stars` port (`starred`, `set`) | every test (via `serveHeld`, `boardHolding`) | none | `tests/stars-parts.test.ts`, `tests/stars-server.test.ts` (each its own copy) | `tests/support/stars.ts` |
| `heldReads` | the `reads` port, holding one state, with reads that never end | all `serveHeld` tests: A held document (both), A kept document held, Nothing held, The first part comes at once | none | variants in `tests/stars-server.test.ts`, `tests/refresh-server.test.ts`, `tests/server.test.ts`, `tests/keep-reads.test.ts` (each `stubReads`/`readEverything`, none with never-ending reads) | `tests/support/reads.ts` |
| `open` (with the `outgoing` list) | an HTTP client reading a streamed page as it arrives | every test | none | `tests/open-pages-at-once.test.ts` | `tests/support/http.ts` |
| `phaseTag`, `phases`, `phaseStarts`, `beforePhases` | the page's parts | every test | none (`tests/support/page.ts` has no part helpers) | `tests/open-pages-at-once.test.ts`, `tests/stars-parts.test.ts` | `tests/support/page.ts` |
| `tagsWithId`, `starButtons` | elements by id; a part's star buttons | A held document (first test) | none | `tests/stars-parts.test.ts` | `tests/support/page.ts` |
| `addresses` | a page's link targets | The first part comes at once | none | `tests/open-pages-at-once.test.ts` | `tests/support/page.ts` |
| `shown` | `textOf` with no space before `;`, `.`, `,` | every test asserting the line | near-miss: `textOf` in `tests/support/page.ts`, which leaves a space where markup closed before punctuation | — | `tests/support/page.ts` |
| `delay`, `waitUntil`, `firstPartOf` | waiting for a condition; reading a never-ending page's first part | every test | none | `delay`/`waitUntil` in `tests/open-pages-at-once.test.ts` | `tests/support/wait.ts` (`firstPartOf` beside `open`) |
| `machine`, `boardHolding`, `startsOf` | a stub gh and stub carried tool with hold/release/fail per kind of read; a board that has read once | Held, then the reads; Quick, then full; Full first; A quick read that fails; Only the latest is seen | none | adapted from `machine` in `tests/open-pages-at-once.test.ts` and `tests/stars-parts.test.ts` | `tests/support/fixture.ts` or a new `tests/support/tool.ts` |
| `alphaDocument`, `utc` | a document with workstream `alpha` and one step; the page's time format | as above | `fullDocument`/`workstream`/`step` are used, not replaced | `documentOf` in `tests/stars-parts.test.ts` | `tests/support/document.ts` |

## Obsolete tests: dispositions

Recorded at `build:applying`, 2026-11-15.

- `tests/refresh-server.test.ts` "answers a project's page once its read is done, with what it left": **updated** for the MODIFIED requirement. Its whole-body `not.toContain("only-task")` asserted that the held task appears nowhere, which the first part now shows by design; it now asserts `fresh-task` present and `only-task` absent in the last part, which is what "what it left" means.
- `tests/open-pages-at-once.test.ts` "The first part comes at once", "Quick, then full" and "Full first": **unchanged**; nothing is held in their setup, so their being-read first part still holds.

## Missing shared arrangement: dispositions

Every entry above is **kept** local: each repeats helpers other test files declare locally (`stubStars`, a stub `reads`, part helpers, a stub-tool `machine`), which the backlog entry `share-the-test-arrangement` consolidates at once; promoting this file's copies alone would add a second shared version beside those. The `shown` wrapper works around the shared `textOf`'s spacing for this file's assertions only.
