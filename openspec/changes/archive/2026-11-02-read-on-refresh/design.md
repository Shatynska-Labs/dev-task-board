## Context

`README.md`'s Architecture planned a timer, a page script and `/api/...` documents, and `src/reads.ts` runs one pass per workspace at `start()`. The operator chose a refresh instead, on 2026-11-02. See `proposal.md`.

## Goals / Non-Goals

**Goals:** a refresh shows the projects as they stand, and nothing runs while nobody asks.

**Non-Goals:** a page that updates itself, and what a failed read leaves on the page. Until `say-what-a-read-missed`, a failed read replaces the project's document with the reason, and a read with `forge` other than `full` replaces it with its notice.

## Decisions

**The request waits for its reads.** The operator accepted the wait, about 4.5 seconds for a read of `ai-toolkit` or of this project. Answering from what is held and reading behind it was rejected, since a refresh would then show the read before, and a second refresh would be needed.

**`refresh` on `Reads`.** `Reads` gains `refresh(workspace, project?)`, returning a promise that settles when those projects have been read and never rejecting. `src/server.ts` calls it and renders afterwards, so `pageFor` becomes async, and it calls it only once a workspace and page are real, so a refused `Host`, a 404 or the list of workspaces costs no read. After `stop()` it reads nothing and settles at once.

**One read per project.** A map from project to its running read's promise. Every read, the pass at start included, goes through it, so a request during any read joins it. Such a read may have begun before the change the reader wants, by at most its own length, and a refresh after it shows the change. This also keeps repeated refreshes from piling up reads.

**The overview reads in parallel.** One at a time would make a refresh of ten projects cost some 45 seconds. They are separate repositories, so nothing is shared but `gh`'s rate. No cap on concurrency: projects are named by hand, so there are few. The pass at start stays one at a time per workspace, joining any read a request began, so a request can overlap it.

**The pass at start stays.** It is not needed for freshness, but removing it changes `start()` and its callers throughout `tests/reads.test.ts` for no behaviour wanted. It costs one pass a start.

**`reading` stays a state.** A request waits for its reads, so a page cannot show it, and the words leave the pages' requirements. `reads.get` still holds it until a first read ends, and `src/render.ts` keeps its branch as defensive rendering, since `ProjectState` still types it, and a project the pass never reached can reach it after `stop()`, as the board exits.

**`/api/` stays unbuilt.** Nothing asks for it now, so the README's Server bullet is revised and the address stays reserved, 404, by the existing requirement.

**The read time.** `Read 2026-11-01 22:18:05 UTC`, on the project page beside `Written` and in each overview row. UTC, as `Written` is.

**`no-store`.** A reload always asks the server. Going back may not, and the header asks the browser to ask again, though a back/forward cache may still restore the page. Task 4.3 looks, and a miss there is recorded, since a refresh still gives fresh data.

**Another site cannot start reads.** A GET was free of side effects and now spawns processes and spends `gh` requests, and the `Host` check stops only DNS rebinding: an `<img>` on any site arrives with the right `Host`. So `Sec-Fetch-Site` `cross-site` or `same-site` is answered 403, beside the `Host` check. Answering from what is held instead was rejected, as a page that looks fresh and is not. A link to the board from another site is refused too, and entering or bookmarking the address is not. A browser sending no such header passes, as `curl` does, since the guard is against pages in a browser and all current browsers send it.

**Version `0.3.0`.** A user-visible change, so there is a release to confirm.

## Risks / Trade-offs

- [Every step between pages waits, following a link included] → Accepted by the operator. Nothing shows while it waits but the browser's own loading state.
- [A hung read holds its request up to the limit and grace, 65 seconds] → Bounded, and the page then gives the reason.
- [A reader leaving mid-wait leaves the read running] → It finishes and is held; the next request reads again.
- [A failed read replaces a good document, and opened rows close on any refresh, since the page is new] → The first is `say-what-a-read-missed`. The second comes with choosing a plain reload, and is left until it is missed.

## Migration Plan

None: settings and addresses are unchanged. Rollback is a revert.
