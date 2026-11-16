---
priority: normal
kind: fix
waits_on: []
design_with: []
workstream: none
recorded_by: "seen on 2026-11-16 in CI on pull request 45, the record of star-without-reloading"
re_checked: 2026-11-16
---

`tests/replace-board.test.ts`'s `advises --port with the nearest free port above` finds three free ports in a row, occupies the second and expects the board to advise the third. Between the test finding it free and the board checking it, another process can take that third port, and the board then rightly advises a higher one: on macOS in CI the board said `port 49518 is used by…` and the test expected `--port 49520`. It passed on a rerun. Hold the expected port for the test's own use until just before the board checks it, or assert the advice is the nearest port above that was free when the board checked, so the test fails only when the board advises wrongly. A test changes how it arranges, never what it asserts.

- **Kind**: it owes no specification delta, needs no decision, and fits one review sitting.
- **Recorded by**: seen while shipping a record pull request that changed no code, and outside its scope.
