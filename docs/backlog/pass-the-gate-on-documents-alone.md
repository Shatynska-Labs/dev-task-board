---
priority: normal
kind: change
waits_on: []
design_with: []
workstream: none
recorded_by: "the operator, 2026-11-03, after record pull requests waited on macOS runners"
re_checked: 2026-11-03
---

A pull request that changes only documentation, such as a change's record under `openspec/` and `docs/`, runs the whole gate on Ubuntu and macOS. None of what the gate checks reads those files, and twice on 2026-11-03 a macOS job was never picked up by a runner and had to be rerun, holding up a record for nothing. Have the gate find which paths a pull request changes and, where every one is documentation, report success without running its steps. It must still report success rather than be skipped, because branch protection requires `gate (ubuntu-latest)` and `gate (macos-latest)`, and a required check that never reports blocks the merge. Which paths count as documentation is part of the design: `openspec/**` and `docs/**` at least, and `README.md` only if nothing reads it.

- **Kind**: it revises a decision of `AGENTS.md`'s Development Tooling, that continuous integration "is the authority and fails rather than skips", which needs the operator's word, and changes `.github/workflows/gate.yml`.
- **Recorded by**: asked by the operator after `show-only-the-read-time`'s record waited on a macOS runner; no change was in progress that it belongs to.
