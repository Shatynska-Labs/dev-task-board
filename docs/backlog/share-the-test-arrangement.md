---
priority: normal
kind: fix
waits_on: []
design_with: []
workstream: none
recorded_by: read-on-refresh
re_checked: 2026-11-06
---

The test files declare the same arrangement separately: document builders, a stub tool, a stub `gh`, `waitUntil`, `lines`, a request helper and a running board. Move what several files share into `tests/support/`, as `read-on-refresh`'s, `say-what-a-read-missed`'s, `switch-between-workspaces`'s and `open-pages-at-once`'s test plans list with proposed homes, so that each stands in for one interface in one place. Tests change where they take arrangement from, and never what they assert.

- **Kind**: It owes no specification delta, needs no decision, and fits one review sitting.
- **Also takes**: `tests/keep-reads.test.ts` and `tests/keep-render.test.ts`, whose local arrangement `say-what-a-read-missed` kept for this entry, and `tests/account-reads.test.ts`, `tests/account-render.test.ts`, `tests/account-settings.test.ts`, `tests/account-board.test.ts` and `tests/tabs-server.test.ts`, whose local arrangement `switch-between-workspaces` kept for it, `tests/open-pages-at-once.test.ts`, which `open-pages-at-once` kept for it, and `tests/read-time-only.test.ts`, whose document builder and `textOf` `show-only-the-read-time` kept for it. Among them are a `gh` stub that holds tokens per account and logs its environment, and an HTTP client that reads a page as it arrives. The stubs of the reads port in `tests/keep-reads.test.ts`, `tests/refresh-server.test.ts`, `tests/server.test.ts` and `tests/tabs-server.test.ts` are one interface declared four times.
- **Already shared**: `show-a-tasks-kind-and-wait` promoted a document builder (`tests/support/document.ts`: `task`, `step`, `workstream`, `fullDocument`, `page`, `loosePage`) and page-reading helpers (`tests/support/page.ts`: `textOf`, `expectInOrder`, `rowOf` and others). The files above move their document builders and `textOf` onto these, adapting to their defaults, rather than adding second ones.
- **Recorded by**: `read-on-refresh`, whose derived tests repeated these helpers because new files could not import from the existing test files.
