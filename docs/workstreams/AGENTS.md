<!-- ai-toolkit:workstreams 2.0.0 sha256:c69af4471cffd76f0da67e8a2af39d68d6ea54f37301adbe73e9bca1f78a6005 -->
<!-- Generated. Do not edit inside this block — it is replaced on update.
     Project-specific conventions belong outside the markers. -->

# Workstreams

A workstream is a goal that takes more than one change. Each open workstream is one file in this directory, named for the workstream in kebab-case: `<name>.md`. A name is unique among workstreams, open and archived, and is not also a change's name. Refer to a workstream only by that name. `readme`, `agents` and `claude`, in any case, are not a workstream name: their files would collide with `README.md`, `AGENTS.md` and `CLAUDE.md` where the filesystem ignores case.

A workstream file holds the plan and never its progress. It does not say which steps are done or in flight. That is read from the repository by a step's name, and the first of these that holds wins: a step is done when the freshly fetched trunk holds an archived change of that name, or when it holds no change of that name, open or archived, and a pull request from a branch of that name has merged, which is how a step taken as a fix is done; in flight when it holds an open change of that name, or a local or remote branch or an open pull request of that name exists; recorded when its `docs/backlog/` holds an entry of that name; and planned otherwise. Where the forge cannot be reached, say so rather than reading as planned a step that a merged pull request could make done. Edit the file only when the plan or what it holds changes: a step added, removed, reordered or renamed, the Done when or what is out of scope revised, an open question added or answered, context or a decision added or revised, or the workstream archived.

The order of the steps is the intended order of work, and it gates nothing. A step that cannot start before another says so in its backlog entry's `waits_on`.

A change is a step of one workstream only. Where another workstream's goal also needs it, that workstream does not list it among its steps: its step that cannot start before the change names the change in its backlog entry's `waits_on`, and where that step has no entry yet, one is recorded for it.

Open a workstream when the operator decides a goal needs more than one change. Commit it with the plan of the first change that advances it, or as work too small to be a change.

A change or a backlog entry may name the workstream it serves before any step names it. Place each such change or entry among the steps, or detach it, at the next edit of the workstream, and at the latest at the archive of a change in it.

What finishes a workstream is an effect of its Goal that someone can observe: what to look at in the repository, the forge or production, what provokes it where something must, and what result means the Goal holds. "Every step is done" shows only that the step list was worked through, and a list missing a step meets it all the same. It may stand beside the effect where every step is wanted whatever the effect shows, never in its place.

When a workstream's Done when holds, move its file to `archive/<YYYY-MM-DD>-<name>.md`, dated the day it is archived, in the commit that carries the record of the change that completed it. Before moving it, remove from the steps each step not done, other than the change whose record that commit carries. Where a removed step is still wanted, it is first recorded as a backlog entry naming no workstream if it is not yet in flight, and it continues as its own change if it is. Then re-point or clear every backlog entry still naming it.

The operator may abandon a workstream whose goal will not be met. Add an `- **Abandoned**: <date>, <reason>` item after Opened, deal with its steps and entries as above, and move it to `archive/` the same way, as work too small to be a change.

Besides its plan, a workstream holds what its steps share. Under `## Context` go the research, findings and options considered that the goal was planned from, with why one option was chosen. Under `## Decisions` go the decisions that shape more than one step, or were taken before any step's proposal existed, each with who took it, when and why; a decision already recorded in a change's design may be pointed to rather than copied. A decision that shapes one step only belongs in that step's design, which points to the workstream for what it shares rather than copying it.

Context and Decisions say what is known and decided about the goal, never how far the work has come. A finding states what is true of the problem, not that a step found or did it, and neither section names a step as done, in flight or merged.

Context and Decisions state what is held now. Where a change in the workstream overturns something they hold, revise it in place and name that change, in its plan commit or at the latest at its archive. The file's history keeps what was held before.

Keep this file when there is no workstream.

A workstream takes this shape:

```
# `workstream-name`

**Goal**: what is true when the workstream is finished, and why it is wanted.

**Done when**: an effect of the Goal that can be observed in the repository, the forge or production, and what result means it holds; add "every step is done" beside it where that is wanted.

**Steps**:

1. `change-name` — what the step does.

- **Not in scope**: what the workstream deliberately leaves out, or leaves to another workstream by name, or `none`.
- **Open questions**: questions whose answers shape the steps, each deleted once answered, the answer recorded under Decisions, or `none`.
- **Opened**: the date, and the change or the operator that opened it.

## Context

Research, findings and the options considered that the steps share; omit the section where there are none.

## Decisions

**1. A decision.** Who took it and when, what was decided and why, or the change's design that records it; omit the section where there are none.
```
<!-- /ai-toolkit:workstreams -->
