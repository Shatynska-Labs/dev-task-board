---
priority: normal
kind: fix
waits_on: []
design_with: []
workstream: none
recorded_by: read-on-refresh
re_checked: 2026-11-02
---

The test files declare the same arrangement separately: document builders, a stub tool, a stub `gh`, `waitUntil`, `lines`, a request helper and a running board. Move what several files share into `tests/support/`, as `read-on-refresh`'s and `say-what-a-read-missed`'s test plans list with proposed homes, so that each stands in for one interface in one place. Tests change where they take arrangement from, and never what they assert.

- **Kind**: It owes no specification delta, needs no decision, and fits one review sitting.
- **Also takes**: `tests/keep-reads.test.ts` and `tests/keep-render.test.ts`, whose local arrangement `say-what-a-read-missed` kept for this entry.
- **Recorded by**: `read-on-refresh`, whose derived tests repeated these helpers because new files could not import from the existing test files.
