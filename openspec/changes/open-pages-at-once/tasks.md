## 1. Reads

- [ ] 1.1 Add the quick read to `src/reads.ts`, shared per project, never settled, stopped when the full read beside it ends first, with no quick read at start, and stop the overview's read in `src/server.ts`; revise the existing tests that assert an overview reads its projects, which this change replaces, and verify the derived tests of `project-reads` pass

## 2. Pages

- [ ] 2.1 Send a project's page in parts from `src/server.ts`, with the parts drawn in `src/render.ts` and the rule in `src/style.ts`, and the overview drawn from what is held; revise the existing tests that assert a project's page answers only after its read in one piece, and verify the derived tests of `board-pages` pass
- [ ] 2.2 Run the built board on `commerce-ops` and record, as a one-off manual check, when each part arrives, and that in a browser the being-read, quick and full parts each become visible in turn, with only the latest shown

## 3. Finishing

- [ ] 3.1 Revise `README.md`'s Scope, its Architecture's Collector and Server, and its Status, add this step to `docs/workstreams/see-my-projects-live.md` before `write-the-settings` and revise its decision 1, raise the version to `0.6.0` in `package.json` and `package-lock.json`, and verify `npm run check:package`
- [ ] 3.2 Run `npm test`, `npm run typecheck`, `npx biome ci .`, `npm run build` and `npm audit --audit-level=high`, and verify all pass
