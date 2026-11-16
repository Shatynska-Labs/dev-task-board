// Tests derived from the delta spec of `star-without-reloading`
// (openspec/changes/star-without-reloading/specs/board-pages/spec.md): what a
// served page carries, read from its markup — its blocks' keys, its scripts,
// its style and its stars as each part is drawn. Run through the server, with
// stubs of the `reads` and `Stars` ports, and with `createReads` over a stub
// tool where a quick part is needed, as tests/stars-parts.test.ts does. Each
// assertion's classification is in that change's test-plan.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { type ClientRequest, request as httpRequest } from "node:http";
import { join } from "node:path";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReads } from "../src/reads.js";
import { startServer } from "../src/server.js";
import { fullDocument, step, task, workstream } from "./support/document.js";
import { isolatedEnvironment } from "./support/fixture.js";
import { attribute, textOf } from "./support/page.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 30_000 });

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".

// The `Stars` port as star-workstreams' design.md D10 gives it, in memory.
function stubStars(initial: Record<string, string[]> = {}) {
	const held = new Map<string, Set<string>>(
		Object.entries(initial).map(([path, names]) => [path, new Set(names)]),
	);
	return {
		starred: (projectPath: string) => new Set(held.get(projectPath) ?? []),
		set: async (projectPath: string, name: string, on: boolean) => {
			const names = held.get(projectPath) ?? new Set<string>();
			if (on) names.add(name);
			else names.delete(name);
			held.set(projectPath, names);
		},
	};
}

// The `reads` port holding `document` for every project; its refresh ends at
// once, or only once `release` is called where `held` is set.
function stubReads(document: unknown, held = false) {
	const stub = {
		release: () => {},
		refreshes: 0,
		get: () => ({ state: "read", document, readAt: "2026-11-01T22:18:00Z" }),
		quick: async () => undefined,
		refresh: () => {
			stub.refreshes += 1;
			if (!held) return Promise.resolve();
			return new Promise<void>((resolve) => {
				stub.release = resolve;
			});
		},
	};
	return stub;
}

const oneWorkspace = [
	{ name: "work", projects: [{ name: "one", path: "/srv/one" }] },
];

function inactive(name: string, steps: string[]) {
	return { ...workstream(name, steps), active: false };
}

// Every kind of block: an active and an inactive workstream, so the group of
// other workstreams, a task in each, and a task in no workstream.
// Each task has a body, so that its row is a block that opens to it.
const everyBlock = fullDocument({
	workstreams: [workstream("alpha", ["t1"]), inactive("beta", ["t3"])],
	tasks: [
		step("t1", "alpha", { body: "the body of t1" }),
		step("t3", "beta", { body: "the body of t3" }),
		task("t2", { body: "the body of t2" }),
	],
});

async function serve(
	document: unknown,
	options: { held?: boolean; starred?: string[] } = {},
) {
	const reads = stubReads(document, options.held);
	const stars = stubStars({ "/srv/one": options.starred ?? [] });
	const port = await startServer(
		{ workspaces: oneWorkspace, reads, stars } as unknown as Parameters<
			typeof startServer
		>[0],
		0,
	);
	return { port, reads, stars };
}

type Answer = { status: number; location: string | undefined; body: string };

// fetch cannot set Host. A header given as undefined is not sent.
function send(
	port: number,
	method: string,
	path: string,
	headers: Record<string, string> = {},
	body?: string,
): Promise<Answer> {
	const sent: Record<string, string> = {
		Host: `127.0.0.1:${port}`,
		...headers,
	};
	if (body !== undefined) {
		sent["Content-Length"] = String(Buffer.byteLength(body));
	}
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				method,
				path,
				headers: sent,
				agent: false,
				timeout: 25_000,
			},
			(response) => {
				let text = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					resolve({
						status: response.statusCode ?? 0,
						location: response.headers.location,
						body: text,
					});
				});
			},
		);
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no answer for ${method} ${path}`));
		});
		outgoing.on("error", reject);
		outgoing.end(body);
	});
}

async function pageOf(port: number, path: string): Promise<string> {
	const answer = await send(port, "GET", path);
	expect(answer.status).toBe(200);
	return answer.body;
}

function star(port: number, body: string): Promise<Answer> {
	return send(
		port,
		"POST",
		"/work/one",
		{
			Origin: `http://127.0.0.1:${port}`,
			"Sec-Fetch-Site": "same-origin",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body,
	);
}

const outgoing: ClientRequest[] = [];

// Opens a page and reads its body as it arrives, as
// tests/held-document-first.test.ts does.
function open(port: number, path: string) {
	let text = "";
	let done = false;
	const end = new Promise<string>((resolve, reject) => {
		const sent = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}` },
				agent: false,
				timeout: 25_000,
			},
			(response) => {
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					done = true;
					resolve(text);
				});
			},
		);
		sent.on("timeout", () => {
			sent.destroy(new Error(`no end for ${path}`));
		});
		sent.on("error", reject);
		sent.end();
		outgoing.push(sent);
	});
	end.catch(() => {});
	return { received: () => text, ended: () => done, end };
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function waitUntil(condition: () => boolean, ms = 8000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error("timed out waiting");
		await delay(20);
	}
}

const phaseTag =
	/<section\b[^>]*\bclass=["'](?:[^"']*\s)?phase(?:\s[^"']*)?["'][^>]*>/g;

function phaseStarts(html: string): number[] {
	return [...html.matchAll(phaseTag)].map((match) => match.index ?? 0);
}

function phases(html: string): string[] {
	const starts = phaseStarts(html);
	return starts.map((start, i) => html.slice(start, starts[i + 1]));
}

function starButtons(html: string): string[] {
	return [...html.matchAll(/<button\b([^>]*)>/gi)]
		.map((match) => match[1] ?? "")
		.filter((attributes) =>
			["star", "unstar"].includes(attribute(attributes, "name") ?? ""),
		);
}

function starButtonOf(html: string, stream: string): string {
	const found = starButtons(html).filter(
		(attributes) => attribute(attributes, "value") === stream,
	);
	expect(found).toHaveLength(1);
	return found[0] ?? "";
}

function scripts(html: string): string[] {
	return [...html.matchAll(/<script\b([^>]*)>/gi)].map(
		(match) => match[1] ?? "",
	);
}

const windows: Window[] = [];

// The page's document, with no script run.
function parsed(html: string) {
	const window = new Window({ url: "http://127.0.0.1:1/work/one" });
	windows.push(window);
	window.document.write(html);
	return window.document;
}

// A machine and a board whose page is sent in a quick part and a full part,
// as tests/stars-parts.test.ts arranges it: gh can use a login unless
// GH_CONFIG_DIR names a directory that cannot be made, and the tool's full
// read waits until the quick one has printed its document.
type Reads = ReturnType<typeof createReads>;
const running: Reads[] = [];

function documentOf(forge: "full" | "none", taskName: string) {
	return fullDocument({
		forge,
		workstreams: [workstream("alpha", [taskName])],
		tasks: [step(taskName, "alpha")],
	});
}

async function quickThenFullBoard(): Promise<number> {
	const root = temporaryDirectory();
	const env = isolatedEnvironment(root);
	for (const name of ["HOME", "XDG_CONFIG_HOME", "PATH"]) {
		vi.stubEnv(name, env[name]);
	}
	vi.stubEnv("XDG_STATE_HOME", join(root, "state"));
	for (const name of Object.keys(process.env)) {
		if (name.startsWith("GIT_")) vi.stubEnv(name, undefined);
	}
	for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR"]) {
		vi.stubEnv(name, undefined);
	}
	writeFileSync(
		join(root, "stubs", "gh"),
		[
			"#!/bin/sh",
			'if [ -n "$GH_CONFIG_DIR" ] && ! mkdir -p "$GH_CONFIG_DIR" 2>/dev/null; then',
			"  echo 'failed to read configuration' >&2",
			"  exit 1",
			"fi",
			"exit 0",
			"",
		].join("\n"),
		{ mode: 0o755 },
	);
	writeFileSync(
		join(root, "quick.json"),
		JSON.stringify(documentOf("none", "quick-task")),
	);
	writeFileSync(
		join(root, "full.json"),
		JSON.stringify(documentOf("full", "full-task")),
	);
	const toolPath = join(root, "stub-tool");
	writeFileSync(
		toolPath,
		[
			`root='${root}'`,
			"if gh pr list >/dev/null 2>&1; then kind=full; else kind=quick; fi",
			'if [ "$kind" = full ]; then',
			"  i=0",
			'  until [ -e "$root/quick-done" ] || [ "$i" -ge 500 ]; do sleep 0.02; i=$((i + 1)); done',
			"  sleep 0.5",
			"fi",
			'cat "$root/$kind.json"',
			'if [ "$kind" = quick ]; then : > "$root/quick-done"; fi',
			"",
		].join("\n"),
		{ mode: 0o644 },
	);
	const project = join(root, "projects", "one");
	mkdirSync(project, { recursive: true });
	const settings = [
		{ name: "work", projects: [{ name: "one", path: project }] },
	];
	const reads = createReads(
		settings as unknown as Parameters<typeof createReads>[0],
		{ toolPath, limitMs: 10_000, graceMs: 200 },
	);
	running.push(reads);
	return startServer(
		{
			workspaces: settings,
			reads,
			stars: stubStars(),
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
}

afterEach(async () => {
	for (const sent of outgoing.splice(0)) sent.destroy();
	await Promise.all(running.splice(0).map((reads) => reads.stop()));
	await Promise.all(windows.splice(0).map((window) => window.happyDOM.close()));
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("A project's page reopens what was open", () => {
	describe("A task's key", () => {
		it("keys t1's row under alpha task:alpha:t1, and t2's in no workstream task::t2", async () => {
			const { port } = await serve(everyBlock);
			const document = parsed(await pageOf(port, "/work/one"));
			const shown = [...document.querySelectorAll("section.phase")].at(-1);
			expect(shown).toBeDefined();

			for (const [key, name] of [
				["task:alpha:t1", "t1"],
				["task::t2", "t2"],
			] as const) {
				const rows = [
					...(shown?.querySelectorAll("details[data-key]") ?? []),
				].filter((each) => each.getAttribute("data-key") === key);
				expect(rows).toHaveLength(1);
				const summary = rows[0]?.querySelector(":scope > summary");
				expect(textOf(summary?.innerHTML ?? "")).toContain(name);
			}
		});
	});

	describe("Each block's key", () => {
		it("keys each workstream, the group of other workstreams and the group of tasks in no workstream by what it shows", async () => {
			const { port } = await serve(everyBlock);
			const document = parsed(await pageOf(port, "/work/one"));
			const shown = [...document.querySelectorAll("section.phase")].at(-1);

			const keys = [...(shown?.querySelectorAll("details") ?? [])].map((each) =>
				each.getAttribute("data-key"),
			);

			expect(keys).not.toContain(null);
			expect(keys).toEqual(
				expect.arrayContaining([
					"workstream:alpha",
					"workstream:beta",
					"other",
					"loose",
					"task:alpha:t1",
					"task:beta:t3",
					"task::t2",
				]),
			);
			const alpha = shown?.querySelector(
				'details[data-key="workstream:alpha"]',
			);
			const button = alpha?.querySelector(":scope > summary button[value]");
			expect(button?.getAttribute("value")).toBe("alpha");
			const beta = shown?.querySelector('details[data-key="workstream:beta"]');
			const other = shown?.querySelector('details[data-key="other"]');
			expect(beta).toBeTruthy();
			expect(beta ? other?.contains(beta) : false).toBe(true);
		});

		it("escapes a workstream's name in its key", async () => {
			const name = 'a"b<c>&d';
			const { port } = await serve(
				fullDocument({
					workstreams: [workstream(name, ["t1"])],
					tasks: [step("t1", name, { body: "the body of t1" })],
				}),
			);
			const html = await pageOf(port, "/work/one");
			const document = parsed(html);
			const shown = [...document.querySelectorAll("section.phase")].at(-1);

			const keys = [
				...(shown?.querySelectorAll("details[data-key]") ?? []),
			].map((each) => each.getAttribute("data-key"));

			expect(keys).toEqual(
				expect.arrayContaining([`workstream:${name}`, `task:${name}:t1`]),
			);
			expect(html).not.toContain(`data-key="workstream:${name}"`);
		});
	});
});

describe("A page shows what was read for it", () => {
	describe("Only a project's page has a script", () => {
		it("sends the overview with no <script>, and the project's page with only inline scripts and no handler attributes", async () => {
			const { port } = await serve(everyBlock);

			const overview = await pageOf(port, "/work");
			const project = await pageOf(port, "/work/one");

			expect(overview).not.toMatch(/<script\b/i);
			expect(scripts(project).length).toBeGreaterThan(0);
			for (const attributes of scripts(project)) {
				expect(attribute(attributes, "src")).toBeNull();
			}
			expect(project).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
		});
	});
});

describe("A project's page shows each read as it arrives", () => {
	describe("Only the latest is seen", () => {
		it.each(["/work/one", "/work"])(
			"styles %s to hide every phase followed by another",
			async (path) => {
				const { port } = await serve(everyBlock);

				const body = await pageOf(port, path);

				const styles = [...body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
					.map(([, css]) => css)
					.join("\n");
				expect(styles).toMatch(
					/\.phase:has\(\s*~\s*\.phase\s*\)\s*\{[^}]*display\s*:\s*none/,
				);
			},
		);
	});
});

describe("A workstream shows its star", () => {
	describe("One form for every part", () => {
		it("holds exactly one form with id stars, and every star button in either part names it", async () => {
			const port = await quickThenFullBoard();

			const html = await pageOf(port, "/work/one");

			const parts = phases(html);
			expect(parts).toHaveLength(3);
			expect(textOf(parts[1] ?? "")).toContain("quick-task");
			expect(textOf(parts[2] ?? "")).toContain("full-task");
			const forms = [...html.matchAll(/<form\b([^>]*)>/gi)].filter(
				(match) => attribute(match[1] ?? "", "id") === "stars",
			);
			expect(forms).toHaveLength(1);
			const ids = [...html.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)].filter(
				(match) => attribute(match[1] ?? "", "id") === "stars",
			);
			expect(ids).toHaveLength(1);
			expect(starButtons(parts[1] ?? "").length).toBeGreaterThan(0);
			expect(starButtons(parts[2] ?? "").length).toBeGreaterThan(0);
			for (const button of starButtons(html)) {
				expect(attribute(button, "form")).toBe("stars");
			}
		});
	});

	describe("A star set while the page arrives", () => {
		it("shows alpha starred in the part sent after the star", async () => {
			const { port, reads } = await serve(
				fullDocument({
					workstreams: [workstream("alpha", ["s-1"])],
					tasks: [step("s-1", "alpha")],
				}),
				{ held: true },
			);
			const opened = open(port, "/work/one");
			await waitUntil(
				() =>
					reads.refreshes > 0 &&
					phases(opened.received()).length === 1 &&
					starButtons(opened.received()).length > 0,
			);
			await delay(100);
			expect(opened.ended()).toBe(false);
			const first = phases(opened.received());
			expect(first).toHaveLength(1);
			expect(attribute(starButtonOf(first[0] ?? "", "alpha"), "name")).toBe(
				"star",
			);

			expect((await star(port, "star=alpha")).status).toBe(303);
			reads.release();
			const body = await opened.end;

			const parts = phases(body);
			expect(parts.length).toBeGreaterThan(1);
			for (const part of parts.slice(1)) {
				expect(attribute(starButtonOf(part, "alpha"), "name")).toBe("unstar");
			}
		});
	});
});
