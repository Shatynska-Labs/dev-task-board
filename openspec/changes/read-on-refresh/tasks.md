## 1. Workstream

- [x] 1.1 Replace step 3 in `docs/workstreams/see-my-projects-live.md` with `read-on-refresh`, and revise its Goal and Done when to a refresh showing the current state, recording the operator's decision of 2026-11-02, and verify no other step depends on a timer. This commit goes with the plan

## 2. Reads

- [ ] 2.1 Add `refresh` and the map of running reads to `src/reads.ts`, and verify the derived tests of `project-reads` pass, including that a stopped board starts no read

## 3. Pages

- [ ] 3.1 Add the read time to the overview and project page in `src/render.ts`, and verify the derived tests of the page's requirements pass
- [ ] 3.2 Make `pageFor` async in `src/server.ts`, await `refresh`, send `Cache-Control: no-store`, refuse a `Sec-Fetch-Site` of `cross-site` or `same-site`, add `refresh` to the `reads` stub in `tests/server.test.ts` with a read state for the percent-encoded name's test, change `tests/board.test.ts`'s test of a request during a read to the new behaviour and raise `get`'s 5 second timeout for the tests now waiting on a real read, retitle the being-read tests in `tests/render.test.ts` as defensive rendering, rename the `describe` titles naming the old requirement in `tests/reads.test.ts` and `tests/board.test.ts`, and verify the derived tests that refused, unknown and list requests read nothing, and that `/api/` still answers 404

## 4. Finishing

- [ ] 4.1 Raise the version to `0.3.0` in `package.json` and `package-lock.json`, revise `README.md`'s Scope, Technology, the Collector, Server and Failure bullets and Status, and verify `npm run check:package`
- [ ] 4.2 Run `npm test`, `npm run typecheck`, `npx biome ci .`, `npm run build` and `npm audit --audit-level=high`, and verify all pass
- [ ] 4.3 Run the built board against the operator's real workspace, and verify in a named browser that a state changed on the forge shows on a refresh, and that no process runs a read while no page is requested. Check whether going back shows fresh data, recording a miss here rather than holding this step. Record the wait for a project page and for the overview in `tasks.md`
