## Context

`src/render.ts` draws a `div.stamp` with `Read <time>` and `<ref> <commit> · written <time>` as the first thing in a project's last part, and `src/style.ts` places it absolutely in `main`'s top corner on a wide page, level with the tabs. The tabs are a `nav` with a bottom border, so the stamp sits across that line. See proposal.md for why.

## Decisions

**The time of the read stays, as `Read <time>`.** It is what says how fresh the page is, and `written_at` says the same within the run. The operator offered a bare time or one with `Read`; `Read` matches the overview's rows and the wording existing tests pin, so nothing they assert about the read time changes.

**It sits on the name's line by a negative margin, not by absolute position.** The stamp is the first item of the part that follows the header, so a top margin of minus `main`'s gap and the heading's line height puts it level with the heading, and a bottom margin of minus the part's own gap keeps what follows where it is now, right-aligned, however many lines the tabs take. An absolute top, as now, can only be measured from `main`, which is what put it across the tabs. The room moves from `header.project`, where it also narrowed the tabs, to its `h1`, at 200 pixels, so a long name does not run under the time and the tabs take the full width. On a page narrower than 640 pixels it stays in the flow, under the name.

## Risks / Trade-offs

- [A name long enough to wrap puts the time level with its last line] → The heading's right padding keeps them apart.
- [The margins depend on `main`'s gap, the part's gap and the heading's line height] → All are set in `src/style.ts`, the line height through `body`.
