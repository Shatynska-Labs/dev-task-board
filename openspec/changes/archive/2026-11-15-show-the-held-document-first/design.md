# Design

## Context

See `proposal.md` for why. `projectPage` in `src/server.ts` writes `projectPageStart`, whose one part says "This project is being read.", starts the full and quick reads, writes `quickPart` where the quick read ends first, and ends with `projectPageEnd` from what the reads hold. The style hides every `phase` followed by another. A `POST` that sets a star answers `303` to the project's page at the workstream. `reads.get` gives `{ state: "reading" }` until a project's first read settles, then a held document or a failure.

## Goals / Non-Goals

**Goals**: the project's page is never empty while it is read, where the board has read the project before; a star shows at once in what is held.

**Non-Goals**:

- A star without a reload. That would need a script, which decision 1 of `see-my-projects-live` and `README.md` rule out; it can be revisited if this is still too abrupt.
- The overview, which already answers from what is held.

## Decisions

**1. The state is taken before the reads start.** `projectPage` calls `reads.get` before `refresh`, so the first part shows what was held when the request came, never a state the reads have begun to change.

**2. What the held part shows.** Where the state is a held document, the part shows a line `Shown as read <time>; being read again.`, the same notices of what is kept or missed that the last part would show for it, and the document rendered with the project's stars and without workstream ids. Where the state is reading, failed or absent, the part is today's `This project is being read.` A failure shows in the last part, as today, once the reads have settled.

**3. No ids in the held part.** "Only the last part carries workstream ids", added by `star-workstreams`, already requires it: the held part is never the last. The browser therefore scrolls to the starred workstream when the last part arrives, not at once; ids in the held part would be duplicated by the later parts, and the first of duplicates wins, pointing into a hidden part.

**4. Order of parts.** Held, then quick where it ends first, then full. The quick part has fresher tasks but possibly wrong statuses, as today; it replaces the held part rather than being skipped, so the page's behaviour after its first part is unchanged.

**5. Where it lives in code.** `projectPageStart` takes the held state and the starred set. It already writes the one `stars` form after the heading and before the first part, so the held part's star buttons work while the page is still being sent. The held part's body reuses what `projectState` renders for a held document, with ids off and the being-read-again line in place of the stamp.

## Risks / Trade-offs

- The held document may be old, a board having started days ago; its line says when it was read, and the reads replace it within seconds.
- A held document that the full read then replaces with a failure shows briefly, then the failure, as the last part has always shown it.
