import type { ProjectState, Reads } from "./reads.js";
import type { Workspace } from "./settings.js";

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
};

type Step = { name: string; description?: string | null };

type Stream = {
	name: string;
	summary?: string | null;
	goal?: string | null;
	done_when?: string | null;
	active: boolean;
	steps: Step[];
};

type BoardDocument = {
	project?: string;
	written_at?: string;
	forge?: string;
	workstreams?: Stream[];
	tasks?: Task[];
};

const STYLE = `
:root { color-scheme: light dark; --line: #8884; --muted: #777; }
body { font: 15px/1.5 system-ui, sans-serif; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; }
h1 { font-size: 1.4rem; } h2 { font-size: 1.05rem; margin-top: 2rem; }
ul { list-style: none; padding: 0; } li { padding: .35rem 0; border-top: 1px solid var(--line); }
details { border-top: 1px solid var(--line); padding: .35rem 0; } summary { cursor: pointer; }
.meta, .status { color: var(--muted); font-size: .9em; } .notice { color: #b35900; }
pre { white-space: pre-wrap; }
`;

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

function layout(title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function forgeNotice(document: BoardDocument): string {
	return document.forge === "full"
		? ""
		: `<span class="notice">The forge read was ${escapeHtml(document.forge)}: statuses may be wrong.</span>`;
}

function details(summary: string, body: string): string {
	return `<details><summary>${summary}</summary>${body}</details>`;
}

function taskLine(task: Task, words: string[] = []): string {
	const shown = [
		task.status,
		task.stage,
		task.priority,
		task.closed_workstream && `from ${task.closed_workstream}`,
		task.merge_unchecked && "merge unchecked",
		task.last_commit &&
			new Date(task.last_commit * 1000).toISOString().slice(0, 10),
		...words,
	].filter(Boolean);
	const line = `${escapeHtml(task.name)} <span class="status">${escapeHtml(shown.join(" · "))}</span>`;
	const summary = task.summary ? ` ${escapeHtml(task.summary)}` : "";
	return task.body
		? details(line + summary, `<pre>${escapeHtml(task.body)}</pre>`)
		: line + summary;
}

function list(items: string[]): string {
	return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderStream(stream: Stream, tasks: Task[]): string {
	const steps = stream.steps.map((step) => {
		const task = tasks.find((entry) => entry.name === step.name);
		const line = task ? taskLine(task) : escapeHtml(step.name);
		return step.description
			? `${line} <span class="meta">${escapeHtml(step.description)}</span>`
			: line;
	});
	const stepNames = new Set(stream.steps.map((step) => step.name));
	const unplaced = tasks
		.filter(
			(task) =>
				!stepNames.has(task.name) && task.workstreams?.includes(stream.name),
		)
		.map((task) => taskLine(task, ["unplaced"]));
	const about = [stream.summary, stream.goal, stream.done_when]
		.filter(Boolean)
		.map((text) => `<p class="meta">${escapeHtml(text)}</p>`)
		.join("");
	return details(
		escapeHtml(stream.name),
		about + list([...steps, ...unplaced]),
	);
}

function section(title: string, body: string): string {
	return `<section><h2>${title}</h2>${body}</section>`;
}

function renderDocument(document: BoardDocument): string {
	const tasks = document.tasks ?? [];
	const streams = document.workstreams ?? [];
	const inStream = new Set(streams.map((stream) => stream.name));
	const inWork = tasks.filter((task) => task.status === "in_flight");
	const loose = tasks.filter(
		(task) =>
			task.status !== "in_flight" &&
			!task.workstreams?.some((name) => inStream.has(name)),
	);
	const active = streams.filter((stream) => stream.active);
	const other = streams.filter((stream) => !stream.active);
	return [
		inWork.length > 0
			? section(
					`In work (${inWork.length})`,
					list(inWork.map((task) => taskLine(task))),
				)
			: "",
		active.length > 0
			? section(
					`Active workstreams (${active.length})`,
					active.map((stream) => renderStream(stream, tasks)).join(""),
				)
			: "",
		other.length > 0
			? section(
					`Other workstreams (${other.length})`,
					other.map((stream) => renderStream(stream, tasks)).join(""),
				)
			: "",
		loose.length > 0
			? section(
					`Not in a workstream (${loose.length})`,
					list(loose.map((task) => taskLine(task))),
				)
			: "",
	].join("\n");
}

function overviewRow(state: ProjectState | undefined): string {
	if (state === undefined || state.state === "reading") {
		return "being read";
	}
	if (state.state === "failed") {
		return `failed: ${escapeHtml(state.reason)}`;
	}
	const document = state.document as BoardDocument;
	const tasks = document.tasks ?? [];
	const inWork = tasks.filter((task) => task.status === "in_flight").length;
	return `${inWork} in flight, ${tasks.length} tasks ${forgeNotice(document)}`;
}

export function renderIndex(workspaces: Workspace[]): string {
	const rows = workspaces.map(
		({ name }) => `<a href="${href(name)}">${escapeHtml(name)}</a>`,
	);
	return layout("dev-task-board", `<h1>Workspaces</h1>${list(rows)}`);
}

export function renderOverview(
	workspace: Workspace,
	reads: Pick<Reads, "get">,
): string {
	const rows = workspace.projects.map(
		({ name }) =>
			`<a href="${href(workspace.name, name)}">${escapeHtml(name)}</a> <span class="status">${overviewRow(reads.get(workspace.name, name))}</span>`,
	);
	return layout(
		workspace.name,
		`<h1>${escapeHtml(workspace.name)}</h1>${list(rows)}`,
	);
}

export function renderProject(
	workspaceName: string,
	projectName: string,
	state: ProjectState | undefined,
): string {
	const heading = `<p class="meta"><a href="${href(workspaceName)}">${escapeHtml(workspaceName)}</a></p><h1>${escapeHtml(projectName)}</h1>`;
	if (state === undefined || state.state === "reading") {
		return layout(projectName, `${heading}<p>This project is being read.</p>`);
	}
	if (state.state === "failed") {
		return layout(
			projectName,
			`${heading}<p>The read failed: ${escapeHtml(state.reason)}</p>`,
		);
	}
	const document = state.document as BoardDocument;
	return layout(
		projectName,
		`${heading}<p class="meta">Written ${escapeHtml(document.written_at)}</p><p>${forgeNotice(document)}</p>${renderDocument(document)}`,
	);
}

export function renderNotFound(): string {
	return layout("Not found", "<h1>Not found</h1>");
}
