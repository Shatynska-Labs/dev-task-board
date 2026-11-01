<!-- ai-toolkit:backlog 1.0.0 sha256:4320396a1c4cf064d9830b21f605a4a090f20eb9319e104061a9376ef789995a -->
<!-- Generated. Do not edit inside this block — it is replaced on update.
     Project-specific conventions belong outside the markers. -->

# Backlog

Changes this project has identified and not yet archived, one file per entry beside this file. Each entry is a change recorded here instead of being folded into the change that found it, or opened on a branch of its own.

An entry's file is `<name>.md`, the change's kebab-case name: the name its branch and change directory are expected to take, though the session that opens the change may revise it if the work turns out different. The file's name is the entry's only identifier, and the file carries no heading repeating it. Refer to an entry only by that name. A fix takes the name as its branch's only. `readme`, `agents` and `claude`, in any case, are not an entry name: their files would collide with `README.md`, `AGENTS.md` and `CLAUDE.md` where the filesystem ignores case.

Entries carry no order. What an entry waits on, how urgent it is, and which entries share a design with it, it states in its own fields.

Keep an entry short: what is needed and why, naming files, specifications and changes as pointers. Leave out line numbers, census tables and step-by-step plans; they go stale first, and the session that takes the entry up redoes them.

Delete an entry's file when its change is archived, when the operator takes it as a fix rather than a change, when a change makes it obsolete, or when the operator decides the change will not be made. When a change is archived, also update the entries it unblocked, unparked or made stale, and set their `re_checked` date. Keep this file when there are no entries.

An entry's values are frontmatter, its keys in this order, one per line:

- `priority`: `high`, `normal` or `parked`. `high` needs evidence of harm happening now, an incident, a measurement or an observation, stated in the body. `parked` needs a condition that can be checked, under which the entry becomes worth taking, in `parked_until`; a parked entry is not folded into another change before its condition holds. When a parked entry's condition holds it becomes `normal`, or `high` with evidence; when a `high` entry's evidence no longer holds it becomes `normal`. An entry without `priority` is `normal`.
- `parked_until`: present only on a parked entry, the condition that can be checked.
- `kind`: `fix` or `change`. A fix owes no specification delta, needs no decision from the operator, and fits one review sitting; otherwise it is a change, and the body says which delta it owes, which decision it needs, or that it is too large.
- `waits_on`: the names of entries or changes that must be archived first, and nothing but names. An entry without `waits_on` waits on the empty list.
- `waits_for`: present only where the entry waits on something that is not a name, the condition that can be checked, such as a person's answer, an access grant or an event; a wait that is not a name goes in `waits_for`, never in `waits_on`. An entry may carry both.
- `design_with`: the names of the entries that share a design with this one. An entry without `design_with` designs with the empty list.
- `workstream`: the workstream the entry is a step of or serves, by name, or `none`. An entry recorded by a change in a workstream takes that workstream unless it serves another goal. An entry without `workstream` is `none`.
- `recorded_by`: the change that identified it, by name, or a double-quoted text where no change did.
- `re_checked`: the date the entry was last verified against the repository, as `YYYY-MM-DD`.

The frontmatter is flat. A name, a value from a stated set or a date is written bare. Free text is double-quoted, with `"` and `\` escaped by a backslash. A list is written inline as `[a, b]`, and empty as `[]`. Nothing is nested, and no value spans more than one line.

The body says what the change is and why, written for a session that has not seen the work that found it, followed by one list giving the reasons the values need: **Kind**, why it is a fix or a change; **Priority**, on a `high` or parked entry only, the evidence or why it is parked; **Recorded by**, why it was not done there. Further items a project's own rules add to that list are kept as written.

An entry file takes this shape:

```
---
priority: normal
kind: change
waits_on: [other-change]
waits_for: "the operator's answer on the naming"
design_with: []
workstream: none
recorded_by: some-change
re_checked: 2026-01-01
---

What the change is and why it is needed, written for a session that has not seen the work that found it.

- **Kind**: which delta it owes, which decision it needs, or that it is too large.
- **Priority**: on a `high` or parked entry only, the evidence or why it is parked.
- **Recorded by**: why it was not done there.
```
<!-- /ai-toolkit:backlog -->
