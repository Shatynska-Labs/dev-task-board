---
priority: normal
kind: change
waits_on: []
waits_for: "ai-toolkit's report-a-tasks-kind-and-wait is archived, so that vendor/task-board can carry kind and waits_for"
design_with: []
workstream: none
recorded_by: "the operator, using the board on 2026-11-02"
re_checked: 2026-11-02
---

In use, the board does not show what a task is or what holds it up. Show on every task row whether it is a fix or a change, and what it waits on, both names and conditions. `waits_on` is drawn today only in workstream and loose rows, not in the In work section, and `kind` and `waits_for` are not in the document at all. Bumping `vendor/task-board` brings them.

Importance is left open. `priority` is drawn where it is not `normal`, but it says how urgent a task is, not whether it is required or only desirable, and in the repositories read nearly every entry is `normal`. Showing required against desirable needs a value no entry carries, so a decision on the backlog's convention, and the operator was not sure of wanting it.

- **Kind**: it owes a delta to `board-pages`, and a bump of the carried tool.
- **Recorded by**: seen in use after `say-what-a-read-missed`, and outside that change's scope.
