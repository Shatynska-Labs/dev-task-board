# Design

## Context

See `proposal.md` for why. `projectPage` in `src/server.ts` takes what the project holds (`held`) before starting its reads, writes the first part from it, starts the full read (`reads.refresh`) and the quick read (`reads.quick`), writes the quick part where the quick read ends first, and ends with the last part. `src/render.ts` draws each part as a `section.phase`; the style hides every part followed by another. Each part's read time is a `p.stamp`, placed by the style beside the name on a wide page, absolutely, up from its part; the quick part's stamp is `Read from git alone; GitHub still being read, so statuses may be wrong.`. The page's script, from `star-without-reloading`, returns to a remembered position after each part.

The prototype the operator confirmed on 2026-11-16 is this design.

## Goals / Non-Goals

**Goals**: a page that already shows a document changes once, when the full read has settled; the page says it is being read until then; the heading and the read time stay in view.

**Non-Goals**:

- Moving the read or the reads' order: the full read, its limit and what a read keeps are unchanged.
- The overview, which reads nothing; its heading is not held.
- A page that updates itself: decision 1 of `see-my-projects-live` stands.

## Decisions

**1. No quick read where a document is held.** `projectPage` starts the quick read only where `held` is not a read document — the project is on its first read, or its reads have only failed. A held document stands until the last part, so a quick part could only show a second, less complete picture of the same project before the third; and a quick read nobody draws costs a process for nothing. The decision is the page's, from `held`, so `reads.quick` keeps its own rules unchanged for the one caller that asks.

**2. The update mark.** A part drawn while the project is being read carries, as the first thing in its stamp, `<span class="spin" role="img" title="…" aria-label="…">↻</span>`, an image to assistive technology so its name is read,: on the held part and the part with nothing held named `Being read again` and `Being read`, and on the quick part `GitHub still being read`. The style turns it once every 1.2 seconds and stops it under `prefers-reduced-motion: reduce`. The last part's stamp has no mark, so when the read settles the mark goes and the time changes with it. The held part's stamp becomes `↻ Read <time>`, the time as before; `Shown as read …; being read again.` goes, since the mark says it. The quick part's becomes `↻ Read from git alone; statuses may be wrong.`. A part with nothing held gains the stamp `↻ Being read` above its line saying the project is being read. A failed read's last part keeps its notice and has no stamp, as now.

**3. A heading held at the top.** `header.project` becomes `position: sticky; top: 0` with the page's background and a stacking order above the parts, and a 28px gradient from that background to transparent hangs below it (`::after`, not taking pointer events), so the rows scroll under it and fade in. `main` loses its top padding to the heading, so the heading sits at the top of the window from the start and the read time can be placed against the window; the overview's and the list's headings take that padding back. Anything with an `id` gets a `scroll-margin-top` clearing the heading, so a link to a workstream does not land under it. Nothing in the document moves: the heading's height is the same as before, so the page's script returns to the same rows.

**4. The read time, level with the name.** The stamp is `position: fixed`, stacked above the heading (its `z-index` higher than the heading's, since a part sets no stacking context of its own), at the right edge of the page's column (`right: max(16px, (100vw − 1180px) / 2 + 16px)`), 36px high, as tall as the name's line, and as wide as `min(280px, 40%)`, right-aligned, its height at least 36px; a text longer than two lines at that width, as the quick part's on a window of about 340px or less, grows the stamp downward over the heading's fade, and moves nothing, being fixed; the name keeps `min(300px, 42%)` clear at its right. Its top is the name's: `43.5px` under a workspace's link, `72.5px` under the tabs (`body:has(.tabs)`), measured in the prototype. Fixed rather than inside the sticky heading because each part carries its own stamp and the parts come after the heading in the response; only the shown part's stamp is displayed. On a narrow page it stays at the right, beside the name, rather than under it as now, so no part's document starts lower than another's.

## Risks / Trade-offs

- **Tabs that wrap.** The stamp's top assumes one line of tabs, and the requirement says so. With so many workspaces that the tabs wrap on a narrow window, the stamp sits above the name. The operator's two workspaces cannot wrap; placing it from the tabs' height needs the script or CSS anchor positioning, which Firefox does not have yet, so it is left.
- **A held document shown longer.** Where the full read takes long, the page shows the held document, marked as being read, rather than what `git` gives. That is the operator's choice: the held document is the fuller picture, and it does not change twice.
- **The scrollbar's width.** `100vw` counts a classic scrollbar, so on such a system the stamp sits that much left of the column's edge on a wide window, within the column's padding.
