---
priority: normal
kind: fix
waits_on: []
design_with: []
workstream: none
recorded_by: "seen on 2026-11-03 while shipping open-pages-at-once and size-the-bar-by-its-steps"
re_checked: 2026-11-03
---

Two tests bound elapsed real time tightly and fail when the machine is busy, then pass on a rerun. On 2026-11-03 `tests/account-reads.test.ts`'s `stops a gh that ignores being stopped, starts no tool, and fails naming the account and the limit` took 2032 ms against a bound of 1800 and blocked a push through the pre-push hook, and `tests/account-board.test.ts`'s `starts the board` failed once in a full run. Give each a bound that still catches what it is there for, a read waiting past its limit and grace, without failing on load, or measure from a point that excludes start-up. A test changes how it measures, never what it asserts.

- **Kind**: it owes no specification delta, needs no decision, and fits one review sitting.
- **Recorded by**: seen while shipping other work, and outside its scope.
