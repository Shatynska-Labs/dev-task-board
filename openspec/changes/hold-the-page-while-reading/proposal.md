# Proposal

## Why

A project's page opens on what it last read, then shows what `git` gives, then the full read. The operator reported on 2026-11-16, on `0.15.x`, that a reload still jumps: the part read from `git` alone lists noticeably more tasks in work than the full read that follows, since without GitHub no merged pull request closes them, so the list grows and then shrinks while the page is read, and a position restored at the start lands elsewhere until the last part arrives. They asked that a page which already shows something keep showing it until the final result is in, that a page with nothing to show still show what `git` gives, and that the page say plainly that it is being read: the heading held at the top while the page scrolls, fading into it, with an update mark at the right before `Read`, and the read time level with the project's name, below the tabs. A prototype of this was shown and confirmed by the operator on 2026-11-16, with the read time moved below the tabs' line at their request.

- **Workstream**: `see-my-projects-live`, as a new step after `star-without-reloading` and before `write-the-settings`. Its decision 1 stands; its account of a project's page, which shows what `git` gives while it waits, is revised to show it only where nothing was held.
- **Depends on**: `star-without-reloading`, not yet archived, which modifies "A project's page shows each read as it arrives". This change's delta of that requirement is written against `star-without-reloading`'s, so it archives after that change.

## What Changes

- Where a project holds a document when its page is requested, the page shows it until the full read has settled, and starts no quick read; the quick part is drawn only where nothing was held.
- While a project's page is being read, its read time carries an update mark, `↻`, turning, still where the browser asks for reduced motion, named for what is being read. The held part shows `↻ Read <time>`, in place of `Shown as read <time>; being read again.`; the quick part `↻ Read from git alone; statuses may be wrong.`; a part with nothing held `↻ Being read`. The last part shows `Read <time>` with no mark.
- A project's heading — the tabs or the workspace's link, the name and the read time — stays at the top of the window while the page scrolls, over a fade into the page below it. The read time sits at the right, level with the name, below the tabs' line, on a narrow page too.
- `README.md` and the workstream say so; the version rises from `0.15.2` to `0.16.0`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `board-pages`: "A project's page shows its document" places the read time at the right of the name and holds the heading at the top; "A project's page shows each read as it arrives" draws the quick part only where nothing was held; "The first part shows what is held" carries the update mark in place of its line. Added "A page being read says so".
- `project-reads`: "A project's page starts a quick read beside the full one" starts it only where the project holds no document.

## Impact

- Changed: `src/server.ts`, `src/render.ts`, `src/style.ts`, their tests, `README.md`, `docs/workstreams/see-my-projects-live.md`, `package.json`, `package-lock.json`.
- `src/reads.ts` is unchanged: whether to start a quick read is the page's decision, taken from what was held when it was requested.
- The page's script is unchanged; the heading held at the top moves no block, so a restored position shows the same rows.
