## Context

`src/server.ts` awaits `reads.refresh` for an overview and for a project, then sends one rendered page. `src/reads.ts` runs the carried tool once per read, keeps one read per project, and settles each outcome into what the project holds. `environmentWithNoLogin` already builds an environment in which `gh` cannot log in, for a workspace with no token. See proposal.md for why, and the workstream `see-my-projects-live` for the decisions this revises.

Measured on `commerce-ops`, 2026-11-03: the tool takes 9.7 to 15.5 seconds, 4 to 5 with `gh` unable to log in, and `gh pr list` alone 5.6. Run together, the quick run ended at about 4 seconds and the full one at about 9, both with `trunk.state` `fetched`. Run one after the other, the full one ended at about 14.

## Goals / Non-Goals

**Goals:** an overview that answers without waiting for any read; a project's page that shows something at once, what `git` gives in seconds, and the full result when it comes, in one response.

**Non-Goals:** showing a held document before the reads; page script; changing the carried tool or what it reports; reading less on a full read.

## Decisions

**An overview reads nothing.** It is used to move between projects, and what the board holds is in memory, so drawing it costs nothing. The pass at start and each project's page keep what it holds current. The alternative, a page of names alone, would be as fast and show less.

**A held document is not shown first.** The operator chose this on 2026-11-03 over showing the last document at once: after a refresh, the page would show what it showed before, and nothing would say that something new is coming, so the old data reads as current.

**The two reads run together.** One after the other, the full result comes later than today, at about 14 seconds against 9. Together, both fetches succeeded in the measurement. Where one fails to fetch because the other holds a lock, the tool reports `fetch_failed`, which the existing rules already handle.

**The quick read is the tool with `gh` unable to log in.** It is the same run, in the environment `environmentWithNoLogin` gives, with no token lookup, so it reports `forge` `none` by the tool's own rule and nothing here restates what the tool decides. Making the tool skip the forge on request would be a change to `ai-toolkit` and a bump of the carried copy, for no measured gain.

**The quick read is never held.** It has no forge, so by the rule of `say-what-a-read-missed` it could replace only a document that is not full. Showing it only in the response that asked for it keeps that rule and the overview untouched. A quick read is shared like a full one: a request during one waits for it, and a full read that ends first stops it. A request that joins a full read already running, as one made just after the board starts does, still starts a quick read, so the most common first opening is not the slowest.

**A quick read that fails shows nothing.** The full read's result says why a project cannot be read, and two reasons on one page would say it twice.

**The page arrives in parts, with no script.** The server sends the head, the tabs and the heading, then a part saying the project is being read, and after that a part for each read that ends: the quick one, if it ends first, and the full one, which ends the response. Each part is a `<section class="phase">`, and the rule `.phase:has(~ .phase) { display: none }` hides every part but the last. A browser draws an HTML response as it arrives, so no script and no second request is needed. Chrome, Edge and Safari support `:has`, as Firefox has since version 121. The alternatives, a page script polling an `/api/` address or a refresh of the page, overturn the decision that pages carry no script, or show the same data twice.

**The status is sent before the reads.** A project that does not exist is answered 404 before anything is sent, as now. Every later outcome is a `200` page that says what happened, as a failed read already is.

**A reader who leaves does not stop the reads.** The full read settles what the project holds for whoever asks next, and another request may be waiting for it.

## Risks / Trade-offs

- [Each opening runs the tool twice] → About 4 seconds of local work, measured, against 6 to 10 of waiting saved.
- [Two fetches at once can make one report `fetch_failed`] → It is reported as any failed fetch is, and the next read fetches again.
- [A browser without `:has` shows every part, one below another] → Each part is complete and marked, so the page reads in order of arrival; every current browser supports it.
- [A quick document can show a merged change as in flight] → It is marked as read from `git` alone and that statuses may be wrong, and is replaced when the full read ends.
- [An overview's counts can be minutes old] → Each row shows the time of its read.

## Migration Plan

Nothing is stored. The version rise publishes it.
