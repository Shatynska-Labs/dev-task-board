# Test plan: replace-a-running-board

Derived from the delta specs committed at `fd2668f` (`specs/board-pages/spec.md`, `specs/package/spec.md`, `specs/settings/spec.md`), not from implementation code. This file is not an OpenSpec schema artifact: `openspec instructions apply` does not list it, so read it on purpose before implementing.

Tests are selected with `npx vitest run <file> -t "<test name>"`, the name being the `it` title (Vitest matches it as a pattern against the full name). New test files:

- `tests/port-settings.test.ts`: `parseSettings`'s `{ workspaces, port }` (unit).
- `tests/port.test.ts`: `bindPort` with fakes, for the scenarios answered in a terminal (unit; design.md decision 6).
- `tests/replace-board.test.ts`: the built command `dist/cli.js` against real processes, every command started without a terminal (integration).

## Baseline

Full suite, `npm test`, before any test was written: 30 files, 566 passed, 1 skipped (`tests/board.test.ts` "starts on 8766 with no arguments", which skips while 8766 is held; on this machine 8766 was held by a running process). No failures.

After writing: 33 files, 572 passed, 12 failed, 2 skipped. Every existing test still passes; the 12 failures and the import failure of `tests/port.test.ts` are the new tests, described below.

## Scenarios

19 scenarios in the delta specs; 19 accounted for below.

### board-pages (MODIFIED) "The server is local and refuses other hosts"

1. **An unexpected host**: unchanged by the delta (text identical to `openspec/specs/board-pages/spec.md`). Covered by existing tests: `tests/server.test.ts -t "An unexpected host"` (the `it.each` cases and "answers 403 before an address would be 404"). No new test.
2. **The expected hosts**: unchanged by the delta. Covered by existing `tests/server.test.ts -t "The expected hosts"`. No new test.
3. **A port in use** (revised: the holder is not a board, no terminal): `tests/replace-board.test.ts -t "exits non-zero, naming the port, where a program that is not a board holds it"`. Also still satisfied by existing `tests/board.test.ts -t "exits non-zero, naming the port"` (its holder is the Vitest worker, not a board).

### board-pages (ADDED) "A running board is replaced"

4. **A board already on the port**: `tests/replace-board.test.ts -t "the first exits, and the second prints that it replaced the board"`.
5. **A board reached through a link**: `tests/replace-board.test.ts -t "the first, run through a link to dist/cli.js, exits and the second listens"`.

Supporting (derived, see classification): `tests/replace-board.test.ts -t "takes the port once a board that stops slowly frees it"`; `tests/port.test.ts -t "in a terminal too, sends the board SIGTERM and takes the port without asking"`.

### board-pages (ADDED) "A board that does not let go refuses the start"

6. **A board that does not let go**: `tests/replace-board.test.ts -t "exits non-zero naming the port and the holder's process id, and the holder is sent nothing else"` (about 10 s; its own timeout is 45 s).

### board-pages (ADDED) "Another program's port is not taken"

7. **Another program, no terminal**: `tests/replace-board.test.ts -t "exits non-zero, writing nothing to standard output, naming the port and port =, and the holder still runs"`; supporting: `-t "advises --port with the nearest free port above"`; `tests/port.test.ts -t "refuses, without a terminal, a holder that cannot be found"`.
8. **A look-alike**: `tests/replace-board.test.ts -t "refuses the start where the holder's dist/cli.js is in a package named otherwise, and the holder still runs"`; supporting: `-t "refuses the start where the holder's script is not an absolute path"`.

### board-pages (ADDED) "The offered port"

9. **No port to offer**: `tests/replace-board.test.ts -t "where every port up to 100 above is unbindable"` and `-t "where the port held is 65535"`; in a terminal: `tests/port.test.ts -t "asks nothing in a terminal where no port up to 100 above binds"` and `-t "asks nothing in a terminal where the port held is 65535"`. Supporting: `tests/port.test.ts -t "offers the nearest port above that binds"`.

### board-pages (ADDED) "In a terminal, another port is offered"

10. **Another program, answered yes**: `tests/port.test.ts -t "listens on n\+1, prints the settings file and port = <n\+1>"`, `-t "asks naming the port, the port offered"`, `-t "takes .* as yes"`.
11. **Another program, answered no**: `tests/port.test.ts -t "refuses the start on .*, binding nothing once answered"`; supporting: `-t "still asks, naming the port, and signals nothing"`.

### package (MODIFIED) "The command reports its version or starts the board"

12. **Asked for its version**: unchanged by the delta. Covered by existing `tests/board.test.ts -t "prints the version in package.json and exits zero"` and `tests/cli.test.ts -t "prints the version in package.json and exits zero"`. No new test.
13. **Starting**: unchanged by the delta. Covered by existing `tests/board.test.ts -t "prints its address, and the address answers"`. No new test.
14. **The port from the settings**: `tests/replace-board.test.ts -t "prints its address on the settings' port with no arguments"`. Skips where 8766 is already held (see unresolved questions); it skipped on this machine.
15. **The flag over the settings**: `tests/replace-board.test.ts -t "listens on the port --port gave"`.
16. **An unknown argument**: unchanged by the delta. Covered by existing `tests/board.test.ts -t "refuses .*, with valid settings present"`. No new test.

### settings (ADDED) "Settings may name a port"

17. **With a port**: `tests/port-settings.test.ts -t "holds port 8800"`.
18. **Without a port**: `tests/port-settings.test.ts -t "holds no port"`.
19. **A bad port**: `tests/replace-board.test.ts -t "exits non-zero for port = .*, naming the settings file and port on standard error"` (four cases: `80`, `70000`, `8800.5`, `"8800"`).

Uncovered scenarios: none. No delta is `REMOVED` or `RENAMED`.

## State of each new test before implementation

- **Target absent (state 2)**: every test in `tests/port.test.ts`: the file fails to import `../src/port.js`. Its assertions have not executed.
- **Wrong value (state 1)**: `holds port 8800`, `holds no port` (the result is still an array); "A board already on the port", "through a link", "stops slowly" (the second board refuses `port <n> is in use`); "does not let go" (no process id in the refusal); "Another program, no terminal" and "advises --port" (no `port =` or `--port` advice); the four "A bad port" cases (the setting is ignored and a board starts; each waits 20 s before failing).
- **Passed on first run (state 4), investigated**: the behaviour already exists, since today every port in use is refused. These are guards that fail if the implementation over-reaches by signalling a holder it must leave alone or by advising a port where it must not: "A port in use" (scenario 3), both look-alike tests, both "No port to offer" tests, and "listens on the port --port gave" (today the setting is ignored, so `--port` wins trivially). They are not evidence that the new behaviour exists.
- **Skipped here**: "prints its address on the settings' port with no arguments" (8766 held on this machine). On a machine where 8766 is free it holds 8766 itself and fails today (the board ignores the setting and is refused on 8766).

## Assertion classification

Specified (traces to a delta requirement or scenario):

- Scenarios 3 to 11, 14, 15, 17 to 19 as listed, for exit status non-zero, nothing on standard output for refusals, the port named on standard error, `port =` in the no-terminal refusal, the holder still running and sent no signal, the first board exiting, the replaced board's process id printed before the address, the address answering 200, no `--port` advised where nothing binds, the bad-port refusal naming the settings file and `port`.
- From requirement text beyond the scenarios: `--port <m>` advised with `m` the nearest bindable port above ("Another program's port is not taken", "The offered port"); the holder whose script is not an absolute path refused ("A running board is replaced": "is an absolute path"); a holder that cannot be found signalled nothing and refused ("Another program's port is not taken"); `yes`, `Y`, `  YES `, ` y\t` taken as yes and `n`, `no` as no ("ignoring case and surrounding space", "answered otherwise"); the question naming port `n`, port `m`, the holder's command and pid; no question where no port binds ("with no port offered"); a board replaced without asking in a terminal (the replacement requirement has no terminal condition); `SIGTERM` and nothing else sent to a board that does not let go ("SHALL NOT be sent any other signal"; observed as the holder's recorded catchable signals being exactly `SIGTERM` and the holder still running, which excludes `SIGKILL`).

Derived (no requirement states it; review these):

- `/replaced/i` in the second board's output: the scenario says it "prints that it replaced"; the word is taken from design.md decision 3's message.
- "takes the port once a board that stops slowly frees it": a dev-task-board holder freeing the port 3 s after `SIGTERM` is replaced, derived from "retry the bind for up to 10 seconds" meaning the retry actually waits.
- "listens on the port --port gave": that standard output does not name the settings' port.
- "A bad port": run with `--port <free port>` present, so a command that wrongly starts cannot bind 8766; the requirement refuses a bad `port` unconditionally. "Starts no server" is observed as the `--port` port still free after exit and nothing on standard output.
- "No port to offer": no `port =` in the refusal (read from "no port offered or advised").
- "answered no": "binds nothing" is read at the `bindPort` level as no successful `bind` call after the answer, and `bindPort` not resolving a port. Probing before the question is left to the implementation (see unresolved questions).
- `tests/port.test.ts`: the port numbers 40000 and the holder `python3 -m http.server` (pid 4242) are arbitrary.

Deliberately untested:

- **An interrupted input in a terminal** (requirement "In a terminal, another port is offered"): how `ask` reports an interruption is not stated (resolve to undefined, reject, or a signal to the process), and a real terminal is not driven here. Ended input is tested.
- **A holder of another user** (decision 1): a test cannot start a listening process as another user without privileges.
- **macOS lookup, and an install path holding a space** (decision 2): covered only where CI runs the suite on macOS; nothing here simulates `lsof` or `ps`.
- **`holderOf` directly against real processes** (decision 6): its decisions are exercised through the built command in `tests/replace-board.test.ts`; no module-level test was added.
- **The board printing its replacement through `bindPort`'s `log`**: tasks.md 2.2 places that print in `src/board.ts`, so the `bindPort` test of a replacement asserts the signal and the port, not the message.

## Obsolete tests

Candidates for human confirmation, not conclusions. Search was bounded to `tests/**/*.test.ts` (no earlier `test-plan.md` was supplied), by grepping for `in use`, `EADDRINUSE`, `occupy(`, `8766` and `parseSettings`.

Superseded by a MODIFIED delta:

- `tests/board.test.ts -t "exits non-zero, naming the port"` (The server is local and refuses other hosts > A port in use). Superseding delta: board-pages MODIFIED "The server is local and refuses other hosts", scenario "A port in use", whose GIVEN narrowed from "the port is taken" to "taken by a program that is not a board" without a terminal. Evidence: same requirement and scenario name; it asserts a refusal for any holder. Its holder is the Vitest worker (`occupy` in the test process), which is not a board, and its command runs without a terminal, so it is still consistent with the revised scenario. Recommendation: keep. Candidate for human confirmation.
- `tests/board.test.ts -t "starts on 8766 with no arguments"`. Superseding delta: package MODIFIED "The command reports its version or starts the board" (8766 only where neither `--port` nor the settings' `port` is given). Evidence: asserts 8766 as the default; its settings carry no `port`, so it is still consistent. It skips where 8766 is held; under this change a held 8766 that is a board would be replaced, so the skip guard is what keeps it from stopping a real board. Recommendation: keep. Candidate for human confirmation.

No other test asserting that a port held by a board is refused was found by this search.

Affected by the design's return shape (not superseded by a delta; design.md decision 6, `parseSettings` returning `{ workspaces, port }`). These treat the result as the workspaces array and will fail or stop type-checking once the shape changes. They are not edited here. Candidates for human confirmation, recorded so the implementation step adapts them or reports them:

- `tests/settings.test.ts -t "holds projects by base name, with ~/ expanded"`, `-t "takes the base name after normalising the path"`, `-t "keeps several workspaces, which may share a base name"`. Evidence: `expect(settings).toEqual([...])` and `settings.map(...)`.
- `tests/account-settings.test.ts -t "holds that account"`, `-t "reads it as given"`, `-t "keeps each workspace's account apart from another's"`, `-t "does not ask gh whether it holds the account"`, `-t "holds no account"`. Evidence: `const [read] = parseSettings(...)` destructuring as an array.
- `tests/account-reads.test.ts`, every test reaching its local `settings()` helper directly or through `board()` (all of "A read uses its workspace's GitHub account" and "A page names an account it could not use"; select with `npx vitest run tests/account-reads.test.ts`). Evidence: `settings()` returns `parseSettings(...)` and passes it to `createReads`, which takes the workspaces array.

## Unresolved project questions

1. **The `bindPort` option contract** (design.md decision 6 names the options, not their types). Assumed: `bind(port)` resolves the bound port or rejects with an error whose `code` is `"EADDRINUSE"`; `holderOf(port)` resolves a `Holder` or undefined; `signal(pid, name)`; `ask(question)` resolves the answered line or undefined where the input ended, and is **absent where standard input and output are not both a terminal**; `settingsFile` a path string; `log(...)` writes a line to standard output; `bindPort` resolves the port bound and refuses by rejecting with an `Error` whose message is the refusal. Tests depending on it: every test in `tests/port.test.ts`. Where the implementation chooses otherwise, adapt only how the fakes are arranged, never what is asserted.
2. **How `bindPort` finds `m` with only `bind`.** Probing with a `bind` that returns a bound port would leave a port bound before the question is answered; "binds nothing" on a no is therefore read as no bind after the answer. Tests depending on it: `tests/port.test.ts -t "refuses the start on .*, binding nothing once answered"`, `-t "offers the nearest port above that binds"`.
3. **Testing against 8766.** "The port from the settings" holds 8766 itself so a command that wrongly falls back to 8766 is refused rather than replacing a board the developer runs there, and skips where 8766 is already held. Tests depending on it: `tests/replace-board.test.ts -t "prints its address on the settings' port with no arguments"`. It runs on CI; it skipped on this machine.
4. **No stack skill.** The library carries no Vitest or TypeScript testing skill; tests follow the floor (`testing`) and the idiom of the existing `tests/board.test.ts`.

## Missing shared arrangement

The dispatch named `tests/support/` as the shared arrangement, and the tests take `isolatedEnvironment`, `buildFixtureRepository`, `temporaryDirectory` and `removeTemporaryDirectories` from it. Everything below is declared locally in `tests/replace-board.test.ts` unless stated, and used by every test in that file unless stated. Proposed home for the process and port helpers: a new module such as `tests/support/board.ts` (none exists; the promotion decision is the implementation step's).

- `settingsFile`, `writeSettings`, `validEnvironment(top)`: the settings file of an isolated environment and a valid one with one fixture project, `validEnvironment` taking extra top-level lines (for `port = ...`). Near-miss: none in `tests/support/`. Found in test module `tests/board.test.ts` (`validEnvironment` there takes no top-level lines, so it would not serve the `port` scenarios). Proposed home: `tests/support/fixture.ts`.
- `spawnTracked`, `start(args, env, script)`, `Process`: spawning the built command, or any node script, without a terminal, capturing output and tracking it for cleanup. `start` takes the script path so a board can be run through a link. Found in `tests/board.test.ts` (`start`, `Board`, without the script parameter). Proposed home: `tests/support/board.ts`.
- `waitUntil`, `listening`, `within`: polling, waiting for the address on standard output, and bounding a wait. `waitUntil`, `listening` found in `tests/board.test.ts`; `within` is new. Proposed home: `tests/support/board.ts`.
- `occupy`, `close`, `freePort`, `isFree`, `freeRun(count)`: holding ports in the test process and finding free ones (`freeRun` finds a run of free ports for the offered-port tests). `occupy`, `close`, `freePort`, `isFree` found in `tests/board.test.ts`; `freeRun` is new. Proposed home: `tests/support/board.ts`.
- `get`: an HTTP GET with the expected `Host`. Found in `tests/board.test.ts` (that one also returns the body). Proposed home: `tests/support/board.ts`.
- `isRunning`: whether a pid is a live, non-zombie process. Found in `tests/board.test.ts`. Proposed home: `tests/support/board.ts`.
- `HOLDER_SOURCE`, `holderPackage`, `startHolder`, `Holder`: a program listening on a port that records the catchable signals it is sent, placed at `<dir>/dist/cli.js` beside a `package.json` of a chosen name, so it stands in for a stuck or slow dev-task-board, a look-alike, or another program. Used by: "A port in use", "stops slowly", "does not let go", "Another program, no terminal" (both), both look-alike tests. Near-miss: none. New. Proposed home: `tests/support/board.ts`.
- `expectRefused`: a refused start (non-zero, nothing on standard output, the port on standard error). Found in `tests/board.test.ts` (a version over `spawnSync` results without the port). Proposed home: `tests/support/board.ts`.
- In `tests/port.test.ts`: `arrange`, `outcome`, `inUse`, `range`, `Holder`, `otherProgram`, `SETTINGS_FILE`: fakes for `bindPort`'s `bind`, `holderOf`, `signal`, `ask`, `settingsFile` and `log`, recording events, signals, questions and lines. Used by every test in `tests/port.test.ts`. Near-miss: none. New. Proposed home: none proposed; they mirror an interface that does not exist yet, so keeping them local until it does is reasonable.
- In `tests/port-settings.test.ts`: `everyPathADirectory`, `workspace`. Stands in for `parseSettings`'s directory check. Found in `tests/settings.test.ts` and `tests/account-settings.test.ts` (same shape). Proposed home: none needed; two lines.
