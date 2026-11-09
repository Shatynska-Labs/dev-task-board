# Tasks

## 1. Numbers

- [x] 1.1 In `src/render.ts`, pass each step's position from `renderStream` to its row — `taskRow` for a step with a task, and the bare row for a step without — and render it as `<span class="num">N.</span>` before the name; give unplaced, in-work and loose rows none; verify with the derived tests for "A workstream's steps are numbered".
- [x] 1.2 In `src/style.ts`, style `.num` as muted and tabular, aligned before the name; verify by rendering a fixture page at desktop and phone width.

## 2. Release

- [x] 2.1 Raise the version to `0.9.0` in `package.json` and `package-lock.json`; verify with `npm run check`, `npm run typecheck`, `npm test`, `npm run build` and `npm run check:package`.
