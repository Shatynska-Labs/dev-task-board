## Context

`src/reads.ts` holds one `ProjectState` per project and overwrites it with each read's outcome. `src/render.ts` draws it, with one notice for a `forge` other than `full`. See proposal.md for why. `README.md`'s Architecture, Failure and Degraded reads, are the rules this implements. The tool's document carries `forge` (`full`, `partly`, `none`), `trunk.state` (`fetched`, `fetch_failed`, `no_origin`) and `remote_branches_read`.

## Goals / Non-Goals

**Goals:** one rule deciding what a read does to what a project holds, tested without a process, and pages that say what they are showing.

**Non-Goals:** keeping documents across a restart; a page's own clock; changing what the carried tool reports; any retry of a failed read.

## Decisions

**A full document is one whose `forge` is `full`, and nothing else.** That is Architecture's rule: a failed fetch alone replaces the old document, since the forge can still see merges. A missing `forge` counts as not full, as `isPartial` already reads it.

**The rule is one pure function.** `src/reads.ts` gains `settle(previous, outcome, at)`, called where `readOnce` now sets the state, returning the next `ProjectState`. The alternative, branching in `readOnce`, could be tested only through a stub tool.

**The state gains an optional field, not a new kind.** A read state becomes `{ state: "read", document, readAt, latest? }`, with `latest` either `{ at, reason }` or `{ at, missed }`. A kept document is drawn by everything that draws a document, so a fourth state would only make each of those name two cases. `failed` now means no document is held.

**What was missed is derived from a document by one function.** `whatMissed(document)` returns one line per thing missed, in `src/reads.ts`, and `latest.missed` is its result for the read not shown. The page uses it for the document shown too, and drops a line both already give. It holds the forge line that `forgeNotice` holds now, whose wording stays, and the tool's own wording for the others. For a project with no remote it says that and that remote branches were not read, as the tool does: the document says so, and nothing here restates what the tool decided.

**Age is measured to the latest read, not to the clock.** Every page reads before it renders, so the two differ by the wait, and rendering stays a pure function of state, which is why no clock reaches `render.ts`. `2026-11-01 22:18:05 UTC, 30 min old` then needs no fixed clock in a test. An existing `age` measures a task's last commit in the same units but floors at `1 min`, which the spec's `under a minute` does not, so the kept age is a function of its own.

**A kept document shows its `Read` time, not `Written`'s.** The heading already shows both, and the notice sits between the heading and the sections.

## Risks / Trade-offs

- [`gh` logged out for good leaves the last full document on the page, older every day] → The age and the reason are on the page, and `gh` logged in again replaces it. Architecture chose this.
- [A project passing `forge_limit` pull requests reads `partly` from then on, so the last full document stays and no login brings it back] → A restart forgets it, and the degraded document is shown with its notice. Rare, and Architecture's rule.
- [A project with no remote or no `gh` is degraded on every read] → Its notice is permanent, and each read replaces the last, since no full document exists.
- [A kept document's own `missed` lines repeat the latest read's] → Dropped where equal, so an outage lists each thing once.

## Migration Plan

Nothing is stored, so nothing migrates. The version rise publishes it.
