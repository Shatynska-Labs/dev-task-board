// The accepted page of scripts/task-board, with the rows an overview adds.
export const STYLE = `
:root {
  --bg: #f5f7f8; --panel: #ffffff; --fg: #18242b; --muted: #5c6c75; --line: #d9e0e4;
  --done: #2f7d5b; --work: #1f63c4; --work-soft: #e2ecfa; --warn: #a3620c; --warn-soft: #f8ecd8;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) { :root {
  --bg: #12191e; --panel: #1a242a; --fg: #e4ebee; --muted: #93a3ac; --line: #2e3c44;
  --done: #5bb78f; --work: #7fb0f5; --work-soft: #1f3250; --warn: #e3a955; --warn-soft: #3c2e17; color-scheme: dark } }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--sans); font-size: 15px; line-height: 1.5 }
main { max-width: 1180px; margin: 0 auto; padding: 28px 16px 56px; display: grid; gap: 32px }
.stamp { color: var(--muted); font-size: 12px; margin: 0; overflow-wrap: anywhere }
/* Level with the name: up by main's gap (32px) and the heading's line (36px),
   measured from the top of the part, so the tabs above never move it. */
@media (min-width: 640px) {
  header.project h1 { padding-right: 200px }
  .phase { position: relative }
  .stamp { position: absolute; right: 0; top: -68px; line-height: 36px }
}
header { display: grid; gap: 4px }
h1 { font-size: 24px; margin: 0 }
.phase { display: grid; gap: 32px }
.phase:has(~ .phase) { display: none }
.tabs { display: flex; flex-wrap: wrap; gap: 4px 16px; border-bottom: 1px solid var(--line); margin-bottom: 12px }
.tabs a { padding: 6px 2px; color: var(--muted); text-decoration: none; overflow-wrap: anywhere; min-width: 0; border-bottom: 2px solid transparent; margin-bottom: -1px }
.tabs a[aria-current="page"] { color: var(--fg); font-weight: 600; border-bottom-color: var(--work) }
h2 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; font-weight: 600 }
.meta { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; margin: 0 }
.notice { color: var(--warn); background: var(--warn-soft); padding: 8px 12px; border-radius: 6px; font-size: 13px; display: grid; gap: 2px }
.warning { color: var(--warn); font-size: 12px; margin: 0 }
.name { font-family: var(--mono); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; min-width: 0 }
.list { background: var(--panel); border: 1px solid var(--line); border-radius: 8px }
.work { display: grid; grid-template-columns: minmax(0, 1fr) 170px 76px minmax(0, 220px); gap: 6px 16px; align-items: center; padding: 12px 14px }
.work + .work { border-top: 1px solid var(--line) }
.workhead { padding-block: 8px; font-size: 12px; color: var(--muted) }
.pipe { display: flex; gap: 3px; margin-bottom: 3px }
.pipe i { flex: 1; height: 6px; background: var(--line); border-radius: 2px }
.pipe i.on { background: var(--work) }
.pipe i.past { background: var(--done) }
.stage { font-family: var(--mono); font-size: 13px }
.ws { font-size: 13px; overflow-wrap: anywhere; min-width: 0; display: grid }
.ws a { color: var(--work); font-family: var(--mono) }
.ws.none { color: var(--muted) }
.tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px }
.tag { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 3px; padding: 0 5px; margin-left: 6px }
.tags .tag { margin-left: 0 }
.mark { color: var(--warn); font-size: 12px; margin-left: 6px }
.groups { display: grid; gap: 8px }
details.group { background: var(--panel); border: 1px solid var(--line); border-radius: 8px }
details.group > summary { list-style: none; cursor: pointer; padding: 12px 14px; display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; gap: 10px; align-items: center }
summary::-webkit-details-marker { display: none }
summary:focus-visible, a:focus-visible { outline: 2px solid var(--work); outline-offset: 2px }
.chev { color: var(--muted); font-size: 11px }
details[open] > summary .chev { transform: rotate(90deg) }
.sub { color: var(--muted); font-size: 13px; margin-top: 2px }
/* 150px holds 21 steps at 7px each; a longer workstream widens its own bar. */
.progress { display: grid; gap: 3px; font-size: 12px; color: var(--muted); text-align: right; width: max(150px, calc(var(--steps, 0) * 7px - 3px)) }
.bar { display: flex; gap: 3px }
/* A recorded step is a thin solid line and a planned one dashed in the same
   colour, so the less certain one reads lighter. */
.bar u { flex: 1; min-width: 0; height: 8px; border-radius: 2px; border: 1px solid var(--line) }
.bar u.done { background: var(--done); border-color: var(--done) }
.bar u.flight { background: var(--work); border-color: var(--work) }
.bar u.planned { border-style: dashed }
.body { border-top: 1px solid var(--line); padding: 12px 14px 14px; display: grid; gap: 12px; min-width: 0 }
.def { margin: 0; font-size: 14px; max-width: 70ch }
.def strong { color: var(--muted); font-weight: 600 }
ol.steps, ul.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px }
.rowgrid, details.task > summary { display: grid; grid-template-columns: 96px minmax(0, 1fr) 58px 58px 210px 76px 56px; gap: 10px; align-items: start }
details.task > summary { list-style: none; cursor: pointer }
.rowhead { font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--line); padding-bottom: 6px }
.st { font-size: 12px; display: inline-flex; align-items: center; gap: 6px; height: 21px; color: var(--muted) }
.st::before { content: ""; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--muted); box-sizing: border-box; flex: none }
.st.done { color: var(--done) } .st.done::before { background: var(--done); border-color: var(--done) }
.st.flight { color: var(--work) } .st.flight::before { border-color: var(--work); background: linear-gradient(90deg, var(--work) 50%, transparent 50%) }
.st.planned::before { border-style: dotted }
.desc { font-size: 13.5px; color: var(--muted); margin: 1px 0 0; max-width: 72ch }
.stage-inline { font-family: var(--mono); font-size: 12px; color: var(--work); background: var(--work-soft); padding: 0 5px; border-radius: 3px; margin-left: 6px; white-space: nowrap }
.ago { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; min-height: 21px }
.more { font-size: 12px; color: var(--work); text-decoration: underline; height: 21px; display: inline-flex; align-items: center }
.more::before { content: "details" }
details[open].task .more::before { content: "hide" }
.full { font-size: 13.5px; color: var(--muted); margin: 6px 0 0 106px; max-width: 72ch; overflow-wrap: anywhere }
.full code, .def code, .desc code { font-family: var(--mono); font-size: .93em }
.legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px }
@media (max-width: 640px) {
  .work { grid-template-columns: 1fr }
  .workhead, .rowhead { display: none }
  details.group > summary { grid-template-columns: 14px minmax(0, 1fr) }
  .progress { grid-column: 2; text-align: left; width: auto }
  .rowgrid, details.task > summary { grid-template-columns: auto auto minmax(0, 1fr); gap: 4px 10px }
  .st { grid-column: 1 / -1 }
  .rowgrid > div, details.task > summary > div { grid-column: 1 / -1 }
  .full { margin-left: 0 }
}
a { color: var(--work) }
/* A task's kind, need and wait, as the operator accepted them on 2026-11-05. */
.kind, .need { font-size: 11px; font-family: var(--mono); border-radius: 3px; padding: 1px 6px; height: 19px; display: inline-flex; align-items: center; justify-self: start; margin-top: 1px; color: var(--muted); border: 1px solid var(--line) }
.kind.fix { color: var(--done); border-color: var(--done) }
.kind.change { color: var(--work); background: var(--work-soft); border-color: transparent }
.need.must { color: var(--fg); font-weight: 700; border-color: var(--fg) }
.need.could { border-style: dashed }
li.could .name, li.could .desc { opacity: .55 }
.waits .ready { font-size: 12px; color: var(--done); font-weight: 600 }
.waits { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; min-width: 0 }
.wnote { font-size: 11.5px; color: var(--muted); width: 100%; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.wchip { font-size: 11px; border-radius: 10px; padding: 0 7px; line-height: 18px; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; color: var(--muted); border: 1px solid var(--line) }
.wchip.name { font-family: var(--mono); background: var(--work-soft); color: var(--work); border-color: transparent }
.wchip.name.stale { text-decoration: line-through; background: none; border-color: var(--line); color: var(--muted) }
.wchip.decision { background: #d5eff1; color: #0b6e78; font-weight: 600; border-color: transparent }
.wchip.answer { background: var(--warn-soft); color: var(--warn); border-color: transparent }
.wchip.access { background: #e3e8ec; color: #45555f; border-color: transparent }
.wchip.release, .wchip.event { background: #dff1ea; color: var(--done); border-color: transparent }
.wchip.parked { border: 1px dashed var(--muted) }
.counts-line { display: flex; flex-wrap: wrap; gap: 2px 14px; align-items: baseline }
.cnt { font-size: 12px; line-height: 18px; white-space: nowrap }
.cnt b { font-weight: 600 }
.cnt.must { color: var(--fg) } .cnt.ready { color: var(--done) } .cnt.blocked { color: var(--work) }
.cnt.decision { color: #0b7d88 } .cnt.waiting { color: var(--warn) } .cnt.parked { color: var(--muted) }
@media (prefers-color-scheme: dark) {
  .wchip.decision { background: #12393d; color: #8fdde4 }
  .wchip.access { background: #2a343b; color: #b4c2cb }
  .wchip.release, .wchip.event { background: #183a2c }
  .cnt.decision { color: #8fdde4 }
}
.notice a { color: inherit }
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; padding: 12px 14px }
.row + .row { border-top: 1px solid var(--line) }
.counts { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; text-align: right }
.failed { color: var(--warn) }
`;
