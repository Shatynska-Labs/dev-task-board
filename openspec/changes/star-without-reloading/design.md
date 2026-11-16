# Design

## Context

See `proposal.md` for why. A project's page is sent in parts (`section.phase`), the style hiding every part followed by another. Every star button names the page's one form, `#stars`, which posts `star=<name>` or `unstar=<name>` to the project's address and is answered `303` to `/<workspace>/<project>#<workstream>`. `projectPage` in `src/server.ts` takes the starred set once, when the request comes, and passes it to every part. Blocks are `details`: a workstream (`details.group` with `.name`), the group of other workstreams, the group of tasks in no workstream (rendered open where there are no workstreams) and each task (`details.task`).

## Goals / Non-Goals

**Goals**: a star changes only the star; a reload sorts and then returns to the blocks and position the operator left; the page still works with no script.

**Non-Goals**:

- A page that reads or refreshes itself. Decision 1 of `see-my-projects-live` stands: the script reads nothing and starts no read.
- The overview, which has no stars and no blocks.
- Moving a workstream to its sorted place at once after a star; the operator chose to sort only on a load.

## Decisions

**1. One inline script on project pages only.** `layoutStart` gains an option to put the script in the head; only a project's page uses it. It is inline because the server answers nothing but pages, and a script address would be a new route for no gain. It runs before the parts arrive, defining what each part calls, and holds no data from the document, so it needs no escaping.

**2. The script is written as TypeScript.** `src/page-script.ts` exports a function `pageScript(window)` holding the client code, type-checked with the rest. The page embeds `(${pageScript.toString()})(window)`; `tsc` emits plain JavaScript that runs as it is, since the function closes over nothing from its module. The target is `es2024`, so `async` is emitted as it is, with no module-scope helper. Tests run the script the page actually carries, taken from the rendered markup, in a `happy-dom` window holding that page, so a function that stopped being self-contained, or instrumentation rewriting it, would fail them.

**3. A star in the background.** A `click` handler on the document finds a `button.star`, prevents its default (which would submit the form and toggle the block its summary sits in) and sends `fetch(form.action, { method: "POST", body: new URLSearchParams([[button.name, button.value]]), redirect: "manual" })`. The browser adds `Origin` and `Sec-Fetch-Site: same-origin`, so the existing checks pass unchanged. With `redirect: "manual"` a `303` arrives as an opaque redirect and is not followed, so no page is requested and no read starts. On it every star button of that workstream, in every part, is set to the state the request named — not toggled — : name, mark, `on` class, `aria-pressed` and accessible name; setting them all covers a part drawn while the request was on its way, which drew the old state. While a workstream's request is pending, presses on its buttons are ignored, so two quick presses cannot leave a button showing the opposite of what is kept. On a network error or any other answer, the form is submitted with that button (`requestSubmit(button)`), which shows the error page as without the script; that submission is the page's own form, not a request of the script's.

**4. Each block's key.** Each `details` on a project's page gets a `data-key`: `workstream:<name>` for a workstream, `other` for the group of other workstreams, `loose` for the group of tasks in no workstream, and `task:<workstream>:<task>` for a task's row, with an empty workstream for a task in no workstream. Text is escaped as an attribute. The same task under two workstreams thus has two keys. Keying on what a block shows rather than its position is what lets a block reopen after the sort has moved it.

**5. Where the view is remembered.** In `sessionStorage`, under `dev-task-board:view:<path>`, as `{"open": {"<key>": true|false, …}, "y": <number>}`, written on `pagehide`; what it holds is decision 6's. `sessionStorage` is per tab and lasts the tab's life, which is the operator's "a reload returns to what was open"; nothing reaches the server. A read or write that throws is ignored, leaving the page as rendered.

**6. A running view, applied to each part.** The script holds the view in memory: `remembered`, the map from key to open and the position read from storage, or none; `changed`, a map from key to open, filled by the operator's `click` on a keyed block's `summary` (not on a star button), which the script's own setting of `open` never fires; and whether the operator has scrolled, set by any `scroll` event whose `scrollY` differs from the position the script last set, which catches a wheel, keys, a dragged scrollbar and find-in-page alike. After each part the page carries `<script>dtbRestore()</script>`, which sets each keyed block in the part just arrived: open as `changed` says where it names the key, else as `remembered` says where it names the key; a block neither names is left as rendered. Remembering open and closed keys alike, rather than an open set, keeps a block rendered open that was never closed open, and a block closed closed. Unless the operator has scrolled, it then scrolls to the remembered position, so a first part too short to reach it does not lose it. Nothing is read from the hidden part, which may hold fewer blocks than the one replacing it — a first part saying the project is being read holds none. On `pagehide` what is saved is each keyed block of the shown part with whether it is open, together with the remembered keys whose blocks the shown part does not hold, as `changed` or else `remembered` says; and the current position where the operator has scrolled, else the remembered one, so a quick second reload before the page reached it does not lose it. `history.scrollRestoration` is set to `manual`, since the browser's own restoring runs against the first part's height and fights the parts that follow.

**7. Stars per part.** `projectPage` takes a function giving the starred set and calls it as each part is drawn, so a star set by the script while the page arrives shows in the parts after it.

**8. Tests run the script in `happy-dom`.** This adds a dev dependency and a level the testing strategy did not name: the script's behaviour, run against markup the board renders, with `fetch` and `sessionStorage` under the test's control. `AGENTS.md`'s testing strategy gains that line. The server's side is already covered by `workstream-stars`' tests.

## Risks / Trade-offs

- A script on the page is new to the board; it is small, inline, reads no document data and changes only the star, the open blocks and the scroll. With scripts off the page is as before.
- The star in a part still arriving is turned over, but a later part draws from the stars at that time; decision 7 makes that agree.
- A key from a task's name collides where one workstream lists the same task twice; both rows then open together, which is harmless.
- A remembered position past the end of a shorter page scrolls to its end; each later part tries again until the operator scrolls.

## After the merge (2026-11-16)

Trying 0.15.0, the operator found the risk named above: a reload landed right at first, jumped up while the quick part showed, and came back once the last part arrived. The cause was the quick part's mark, a block above the document that the other parts lack, so the same position showed rows further up. The fix, in a pull request of its own, puts the mark in the stamp beside the name and gives every stamp one fixed two-line block. In the same report the operator asked that the read time sit beside the name again, from which it had dropped a line since `star-workstreams` added the page's empty stars form, which took a row of the page's grid; that form is hidden, in a commit of its own, at the operator's request rather than as folded-in work. Seeing the fix, the operator asked that an in-work row's `pull requests not checked` mark, which wrapped the stage column to a further line, read `not checked`; the full wording stays as its title.
