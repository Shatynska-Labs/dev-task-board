import {
	isFull,
	type LatestRead,
	type ProjectDocument,
	type ProjectState,
	type Reads,
	whatMissed,
} from "./reads.js";
import type { Workspace } from "./settings.js";
import { STYLE } from "./style.js";

type Task = {
	name: string;
	status: string;
	stage?: string | null;
	workstreams?: string[];
	unplaced?: boolean;
	closed_workstream?: string | null;
	last_commit?: number | null;
	summary?: string | null;
	priority?: string | null;
	body?: string | null;
	merge_unchecked?: boolean;
	parts?: string[];
	waits_on?: string[];
	warnings?: string[];
};

type Step = { name: string; description?: string | null };

type Stream = {
	name: string;
	summary?: string | null;
	goal?: string | null;
	done_when?: string | null;
	active: boolean;
	steps: Step[];
	warnings?: string[];
};

type BoardDocument = {
	project?: string;
	written_at?: string;
	forge?: string;
	trunk?: { ref: string; commit: string };
	workstreams?: Stream[];
	tasks?: Task[];
};

function escapeHtml(text: unknown): string {
	return String(text)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function href(...names: string[]): string {
	return escapeHtml(`/${names.map(encodeURIComponent).join("/")}`);
}

const STAGES = ["plan", "build", "ship"];

function layout(title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body><main>
${body}
</main></body>
</html>
`;
}

function inline(text: unknown): string {
	return escapeHtml(text)
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function timeOf(stamp: string | undefined): number {
	return stamp === undefined ? Number.NaN : Date.parse(stamp) / 1000;
}

function age(task: Task, now: number): string {
	if (!task.last_commit || Number.isNaN(now)) {
		return "";
	}
	const seconds = now - task.last_commit;
	if (seconds < 3600) {
		return `${Math.max(Math.floor(seconds / 60), 1)} min`;
	}
	return seconds < 86400
		? `${Math.floor(seconds / 3600)} h`
		: `${Math.floor(seconds / 86400)} d`;
}

function statusClass(status: string): string {
	if (status === "in_flight") {
		return "flight";
	}
	return status === "done" || status === "planned" ? status : "";
}

function statusLabel(status: string): string {
	return status === "in_flight" ? "in flight" : status;
}

function statusMark(status: string): string {
	return `<span class="st ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>`;
}

function warnings(texts: string[] | undefined): string {
	return (texts ?? [])
		.map((text) => `<p class="warning">Warning: ${escapeHtml(text)}</p>`)
		.join("");
}

function taskNotes(task: Task, description?: string | null): string {
	return [
		description,
		task.summary,
		task.waits_on?.length ? `Waits on ${task.waits_on.join(", ")}` : null,
		task.closed_workstream
			? `Names ${task.closed_workstream}, which is not open`
			: null,
	]
		.filter(Boolean)
		.map((text) => `<p class="desc">${inline(text)}</p>`)
		.join("");
}

function taskBody(body: string): string {
	return body
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => `<p class="full">${inline(line.replace(/^- /, ""))}</p>`)
		.join("\n");
}

function taskRow(
	task: Task,
	now: number,
	options: { description?: string | null; unplaced?: boolean } = {},
): string {
	const marks = [
		task.stage && `<span class="stage-inline">${escapeHtml(task.stage)}</span>`,
		task.priority &&
			task.priority !== "normal" &&
			`<span class="tag">${escapeHtml(task.priority)}</span>`,
		options.unplaced && '<span class="tag">unplaced</span>',
		task.merge_unchecked && '<span class="mark">merge not checked</span>',
	]
		.filter(Boolean)
		.join("");
	const line = `${statusMark(task.status)}<div><span class="name">${escapeHtml(task.name)}</span>${marks}${taskNotes(task, options.description)}${warnings(task.warnings)}</div><span class="ago">${age(task, now)}</span>`;
	return task.body
		? `<li class="step"><details class="task"><summary>${line}<span class="more"></span></summary>\n${taskBody(task.body)}</details></li>\n`
		: `<li class="step rowgrid">${line}<span></span></li>\n`;
}

const ROW_HEAD =
	'<li class="rowgrid rowhead"><span>Status</span><span>Task</span><span>Last commit</span><span>Details</span></li>\n';

function chevron(): string {
	return '<span class="chev" aria-hidden="true">▶</span>';
}

function progress(steps: Task[], unplaced: Task[]): string {
	const done = steps.filter((task) => task.status === "done").length;
	const flying = [...steps, ...unplaced].filter(
		(task) => task.status === "in_flight",
	).length;
	const bar = steps
		.map((task) => `<u class="${statusClass(task.status)}"></u>`)
		.join("");
	const words = `${done} of ${steps.length} done${flying > 0 ? `, ${flying} in work` : ""}`;
	return `<div class="progress"><div class="bar">${bar}</div><span>${words}</span></div>`;
}

function renderStream(stream: Stream, tasks: Task[], now: number): string {
	const stepNames = new Set(stream.steps.map((step) => step.name));
	const rows = stream.steps.map((step) => {
		const task = tasks.find((entry) => entry.name === step.name);
		return task
			? taskRow(task, now, { description: step.description })
			: `<li class="step"><span class="name">${escapeHtml(step.name)}</span></li>\n`;
	});
	const unplaced = tasks.filter(
		(task) =>
			!stepNames.has(task.name) && task.workstreams?.includes(stream.name),
	);
	const stepTasks = stream.steps.flatMap((step) =>
		tasks.filter((task) => task.name === step.name),
	);
	const about = [
		["Goal", stream.goal],
		["Done when", stream.done_when],
	]
		.filter(([, text]) => text)
		.map(
			([title, text]) =>
				`<p class="def"><strong>${title}:</strong> ${inline(text)}</p>`,
		)
		.join("\n");
	const summary = stream.summary
		? `<div class="sub">${inline(stream.summary)}</div>`
		: "";
	return `<details class="group" id="${escapeHtml(stream.name)}"><summary>${chevron()}<div><div class="name">${escapeHtml(stream.name)}</div>${summary}</div>${progress(stepTasks, unplaced)}</summary>
<div class="body">
${about}${warnings(stream.warnings)}<ol class="steps">
${ROW_HEAD}${[...rows, ...unplaced.map((task) => taskRow(task, now, { unplaced: true }))].join("")}</ol>
</div></details>
`;
}

function pipe(stage: string | null | undefined): string {
	const at = STAGES.indexOf((stage ?? "").split(":")[0] ?? "");
	return STAGES.map((_, index) => {
		if (at === -1 || index > at) {
			return "<i></i>";
		}
		return index === at ? '<i class="on"></i>' : '<i class="past"></i>';
	}).join("");
}

function workRow(task: Task, now: number, partial: boolean): string {
	const partTags = (task.parts ?? [])
		.map(
			(part) =>
				`<span class="tag">${escapeHtml(part.replace("_", " ").replace(" pr", " PR"))}</span>`,
		)
		.join("");
	const unplaced = task.unplaced ? '<span class="tag">unplaced</span>' : "";
	const tags = partTags + unplaced;
	const summary = task.summary
		? `<div class="sub">${inline(task.summary)}</div>`
		: "";
	const streams = task.workstreams ?? [];
	const stream =
		streams.length > 0
			? `<div class="ws">${streams.map((name) => `<a href="#${escapeHtml(encodeURIComponent(name))}">${escapeHtml(name)}</a>`).join("")}</div>`
			: '<div class="ws none">no workstream</div>';
	return `<div class="work"><div><div class="name">${escapeHtml(task.name)}</div>${summary}<div class="tags">${tags}</div></div><div><div class="pipe">${pipe(task.stage)}</div><span class="stage">${escapeHtml(task.stage ?? "")}</span>${partial ? '<span class="mark">pull requests not checked</span>' : ""}</div><div class="ago">${age(task, now)}</div>${stream}</div>
`;
}

function section(title: string, body: string): string {
	return `<section><h2>${title}</h2>\n${body}</section>`;
}

const LEGEND =
	'<div class="legend"><span class="st done">done</span><span class="st flight">in flight</span><span class="st">recorded</span><span class="st planned">planned</span></div>';

function looseRank(task: Task): number {
	if (task.status === "in_flight") {
		return 0;
	}
	return task.priority === "parked" ? 2 : 1;
}

// In flight first and parked last, as the accepted page orders them.
function looseOrder(a: Task, b: Task): number {
	return (
		looseRank(a) - looseRank(b) ||
		(b.last_commit ?? 0) - (a.last_commit ?? 0) ||
		a.name.localeCompare(b.name)
	);
}

function renderDocument(document: BoardDocument): string {
	const tasks = document.tasks ?? [];
	const streams = document.workstreams ?? [];
	const now = timeOf(document.written_at);
	const known = new Set(streams.map((stream) => stream.name));
	const inWork = tasks
		.filter((task) => task.status === "in_flight")
		.sort((a, b) => (b.last_commit ?? 0) - (a.last_commit ?? 0));
	const loose = tasks
		.filter((task) => !task.workstreams?.some((name) => known.has(name)))
		.sort(looseOrder);
	const active = streams.filter((stream) => stream.active);
	const other = streams.filter((stream) => !stream.active);
	const groups = (list: Stream[]) =>
		`<div class="groups">${list.map((stream) => renderStream(stream, tasks, now)).join("")}</div>`;
	const parts: string[] = [];
	const partial = !isFull(document as ProjectDocument);
	parts.push(
		section(
			`In work (${inWork.length})`,
			`${
				inWork.length > 0
					? `<div class="list"><div class="work workhead"><span>Task</span><span>Stage</span><span>Last commit</span><span>Workstream</span></div>\n${inWork.map((task) => workRow(task, now, partial)).join("")}</div>`
					: '<p class="meta">Nothing is in flight.</p>'
			}\n<p class="meta">A session's own status report is finer than these stages.</p>`,
		),
	);
	if (streams.length > 0) {
		parts.push(
			section(
				`Active workstreams (${active.length})`,
				`${active.length > 0 ? groups(active) : '<p class="meta">No workstream is active.</p>'}${LEGEND}`,
			),
		);
	}
	if (other.length > 0) {
		parts.push(
			section(
				`Other workstreams (${other.length})`,
				`<details class="group"><summary>${chevron()}<div><div class="name">${other.length} workstream${other.length === 1 ? "" : "s"}</div><div class="sub">Nothing in work right now</div></div><span></span></summary><div class="body">${groups(other)}</div></details>`,
			),
		);
	}
	if (loose.length > 0) {
		parts.push(
			section(
				"Not in a workstream",
				`<details class="group"${streams.length > 0 ? "" : " open"}><summary>${chevron()}<div><div class="name">${loose.length} task${loose.length === 1 ? "" : "s"}</div></div><span></span></summary><div class="body"><ul class="steps">\n${ROW_HEAD}${loose.map((task) => taskRow(task, now)).join("")}</ul></div></details>`,
			),
		);
	}
	return parts.join("\n");
}

function readTime(readAt: string): string {
	return `${escapeHtml(readAt.slice(0, 19).replace("T", " "))} UTC`;
}

function keptFor(readAt: string, at: string): string {
	const seconds = Math.floor((Date.parse(at) - Date.parse(readAt)) / 1000);
	if (seconds < 60) {
		return "under a minute";
	}
	if (seconds < 3600) {
		return `${Math.floor(seconds / 60)} min`;
	}
	return seconds < 86400
		? `${Math.floor(seconds / 3600)} h`
		: `${Math.floor(seconds / 86400)} d`;
}

// Each line once, since a kept document and the read past it can miss the same
// thing.
function noticeLines(
	document: ProjectDocument,
	readAt: string,
	latest: LatestRead | undefined,
): string[] {
	const missed = new Set([
		...whatMissed(document),
		...(latest !== undefined && "missed" in latest ? latest.missed : []),
	]);
	const lines = [...missed].map(escapeHtml);
	if (latest === undefined) {
		return lines;
	}
	const kept = `Kept from the read of ${readTime(readAt)}, ${keptFor(readAt, latest.at)} before the latest read, at ${readTime(latest.at)}.`;
	return "reason" in latest
		? [kept, `The latest read failed: ${escapeHtml(latest.reason)}`, ...lines]
		: [kept, ...lines];
}

function counts(state: ProjectState | undefined): string {
	if (state === undefined || state.state === "reading") {
		return '<div class="counts">being read</div>';
	}
	if (state.state === "failed") {
		return `<div class="counts failed">failed: ${escapeHtml(state.reason)}</div>`;
	}
	const document = state.document as BoardDocument;
	const tasks = document.tasks ?? [];
	const inWork = tasks.filter((task) => task.status === "in_flight").length;
	const notice = noticeLines(state.document, state.readAt, state.latest)
		.map((line) => `<div class="warning">${line}</div>`)
		.join("");
	return `<div class="counts">${inWork} in flight, ${tasks.length} tasks. Read ${readTime(state.readAt)}${notice}</div>`;
}

// Plain links, since each workspace has an address and pages carry no script.
function tabs(names: string[], current: string): string {
	if (names.length < 2) {
		return "";
	}
	const links = names.map(
		(name) =>
			`<a href="${href(name)}"${name === current ? ' aria-current="page"' : ""}>${escapeHtml(name)}</a>`,
	);
	return `<nav class="tabs" aria-label="Workspaces">${links.join("")}</nav>`;
}

function page(title: string, heading: string, body: string): string {
	return layout(title, `<header>${heading}</header>\n${body}`);
}

export function renderIndex(workspaces: Workspace[]): string {
	const rows = workspaces.map(
		({ name, projects }) =>
			`<div class="row"><a class="name" href="${href(name)}">${escapeHtml(name)}</a><div class="counts">${projects.length} project${projects.length === 1 ? "" : "s"}</div></div>`,
	);
	return page(
		"dev-task-board",
		"<h1>Workspaces</h1>",
		`<div class="list">${rows.join("\n")}</div>`,
	);
}

export function renderOverview(
	workspace: Workspace,
	reads: Pick<Reads, "get">,
	workspaceNames: string[] = [],
): string {
	const rows = workspace.projects.map(
		({ name }) =>
			`<div class="row"><a class="name" href="${href(workspace.name, name)}">${escapeHtml(name)}</a>${counts(reads.get(workspace.name, name))}</div>`,
	);
	return page(
		workspace.name,
		`${tabs(workspaceNames, workspace.name)}<h1>${escapeHtml(workspace.name)}</h1>`,
		`<div class="list">${rows.join("\n")}</div>`,
	);
}

function written(document: BoardDocument): string {
	const when = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(document.written_at ?? "")
		? `${document.written_at?.slice(0, 16).replace("T", " ")} UTC`
		: document.written_at;
	const trunk = document.trunk
		? `, from ${escapeHtml(document.trunk.ref)} ${escapeHtml(document.trunk.commit)}`
		: "";
	return `<p class="meta">Written ${escapeHtml(when)}${trunk}.</p>`;
}

export function renderProject(
	workspaceName: string,
	projectName: string,
	state: ProjectState | undefined,
	workspaceNames: string[] = [],
): string {
	const nav = tabs(workspaceNames, workspaceName);
	const way =
		nav ||
		`<p class="meta"><a href="${href(workspaceName)}">${escapeHtml(workspaceName)}</a></p>`;
	const heading = `${way}<h1>${escapeHtml(projectName)}</h1>`;
	if (state === undefined || state.state === "reading") {
		return page(
			projectName,
			heading,
			'<p class="meta">This project is being read.</p>',
		);
	}
	if (state.state === "failed") {
		return page(
			projectName,
			heading,
			`<div class="notice">The read failed: ${escapeHtml(state.reason)}</div>`,
		);
	}
	const document = state.document as BoardDocument;
	const lines = noticeLines(state.document, state.readAt, state.latest);
	const notice =
		lines.length > 0
			? `<div class="notice">${lines.map((line) => `<span>${line}</span>`).join("")}</div>\n`
			: "";
	return page(
		projectName,
		`${heading}<p class="meta">Read ${readTime(state.readAt)}.</p>${written(document)}`,
		notice + renderDocument(document),
	);
}

export function renderNotFound(): string {
	return page("Not found", "<h1>Not found</h1>", "");
}
