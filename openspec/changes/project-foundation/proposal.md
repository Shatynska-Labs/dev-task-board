## Why

This project has been initialized and holds no decisions yet: what it is, what it leaves out, and how it is built and verified. They come first because every later change's test author needs the test command, glob and shared arrangement this change settles. The reasoning behind the project is in `ai-toolkit`'s `docs/workstreams/see-a-projects-tasks.md`, decision 9.

This change advances no workstream in this repository. It serves `see-a-projects-tasks` in `ai-toolkit`. The application needs several changes, so a workstream here is proposed to the operator, to be opened with the plan of the first change that advances it.

## What Changes

- `design.md` records the nine foundation decisions.
- `README.md` and `AGENTS.md` carry them outside this change's archive.
- `.gitignore` gains the stack's exclusions.
- `establish-quality-gate` is opened to build the tooling decided here.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change decides and specifies no behaviour, so it sets `skip_specs`.

## Impact

Documentation and `.gitignore` only. No code, and no forge setting changes.
