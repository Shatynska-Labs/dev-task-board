// Tests derived from the delta spec of `show-the-held-document-first`
// (openspec/changes/show-the-held-document-first/specs/board-pages/spec.md):
// a project's first part shows the document the board holds. Run through the
// server, with a stub of the `reads` port where the reads must not end, and
// otherwise with `createReads` over a stub tool, as
// tests/open-pages-at-once.test.ts reads. Each assertion's classification is
// in that change's test-plan.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type ClientRequest, request as httpRequest } from "node:http";
import { join } from "node:path";
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

const documentRead = "2026-11-01T22:18:05.000Z";
const documentReadShown = "2026-11-01 22:18:05 UTC";
const latestRead = "2026-11-01T22:48:10.000Z";

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

// The `reads` port holding `state` for every project, whose reads never end.
function heldReads(state: unknown) {
	const never = () => new Promise<never>(() => {});
	return {
		get: () => state,
		quick: never,
		refresh: never,
	};
}

function alphaDocument(taskName: string, forge: "full" | "none" = "full") {
	return fullDocument({
		forge,
		workstreams: [workstream("alpha", [taskName])],
		tasks: [step(taskName, "alpha")],
	});
}

const heldAlpha = {
	state: "read",
	document: alphaDocument("held-task"),
	readAt: documentRead,
};

const twoWorkspaces = [
	{ name: "a", projects: [{ name: "one", path: "/srv/one" }] },
	{ name: "b", projects: [{ name: "other", path: "/srv/other" }] },
];

const oneWorkspace = [
	{ name: "work", projects: [{ name: "one", path: "/srv/one" }] },
];

async function serveHeld(
	state: unknown,
	starred: string[] = [],
	workspaces: unknown = oneWorkspace,
) {
	return startServer(
		{
			workspaces,
			reads: heldReads(state),
			stars: stubStars({ "/srv/one": starred }),
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
}

const outgoing: ClientRequest[] = [];

type Opened = {
	received(): string;
	ended(): boolean;
	end: Promise<string>;
};

// Opens a page and reads its body as it arrives.
function open(port: number, path: string): Opened {
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

const phaseTag =
	/<section\b[^>]*\bclass=["'](?:[^"']*\s)?phase(?:\s[^"']*)?["'][^>]*>/g;

function phaseStarts(html: string): number[] {
	return [...html.matchAll(phaseTag)].map((match) => match.index ?? 0);
}

function phases(html: string): string[] {
	const starts = phaseStarts(html);
	return starts.map((start, i) => html.slice(start, starts[i + 1]));
}

function beforePhases(html: string): string {
	const first = html.search(phaseTag);
	return first === -1 ? html : html.slice(0, first);
}

// What a reader sees, with no space left before punctuation that markup
// around a time may have put there.
function shown(html: string): string {
	return textOf(html).replace(/\s+([;.,])/g, "$1");
}

function addresses(html: string): (string | undefined)[] {
	return [...html.matchAll(/<a\b[^>]*>/g)].map(
		([tag]) => /\bhref=["']([^"']*)["']/.exec(tag)?.[1],
	);
}

function tagsWithId(html: string, id: string): number[] {
	return [...html.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)]
		.filter((match) => attribute(match[1] ?? "", "id") === id)
		.map((match) => match.index ?? 0);
}

function starButtons(html: string): string[] {
	return [...html.matchAll(/<button\b([^>]*)>/gi)]
		.map((match) => match[1] ?? "")
		.filter((attributes) =>
			["star", "unstar"].includes(attribute(attributes, "name") ?? ""),
		);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function waitUntil(condition: () => boolean, ms = 8000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error("timed out waiting");
		}
		await delay(20);
	}
}

// The page of a project whose reads never end, as far as it has arrived: its
// first part, and a moment more for anything still on its way.
async function firstPartOf(port: number, path = "/work/one") {
	const opened = open(port, path);
	await waitUntil(() => phases(opened.received()).length >= 1);
	await delay(300);
	const received = opened.received();
	return { opened, received, first: phases(received)[0] ?? "" };
}

type Reads = ReturnType<typeof createReads>;

const running: Reads[] = [];
const roots: string[] = [];

// A machine whose gh can use a login unless GH_CONFIG_DIR names a directory
// that cannot be made, so that a quick read and a full read can be told
// apart, as in tests/open-pages-at-once.test.ts; and a tool that prints
// <kind>.json, logs each start, holds a run while hold-<kind> exists until
// release-<kind> or release-all does, and fails a run while fail-<kind>
// exists. Bounded, so nothing outlives a test.
function machine() {
	const root = temporaryDirectory();
	roots.push(root);
	const env = isolatedEnvironment(root);
	for (const name of ["HOME", "XDG_CONFIG_HOME", "XDG_STATE_HOME", "PATH"]) {
		vi.stubEnv(name, env[name]);
	}
	for (const name of Object.keys(process.env)) {
		if (name.startsWith("GIT_")) {
			vi.stubEnv(name, undefined);
		}
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
	const toolPath = join(root, "stub-tool");
	writeFileSync(
		toolPath,
		[
			`root='${root}'`,
			"if gh pr list >/dev/null 2>&1; then kind=full; else kind=quick; fi",
			'echo "start $kind" >> "$root/tool.log"',
			'if [ -e "$root/hold-$kind" ]; then',
			"  i=0",
			'  until [ -e "$root/release-$kind" ] || [ -e "$root/release-all" ] || [ "$i" -ge 1500 ]; do sleep 0.02; i=$((i + 1)); done',
			"fi",
			'echo "end $kind" >> "$root/tool.log"',
			'if [ -e "$root/fail-$kind" ]; then echo "Reason: $kind-refused" >&2; exit 2; fi',
			'cat "$root/$kind.json"',
			"",
		].join("\n"),
		{ mode: 0o644 },
	);
	const project = join(root, "projects", "one");
	mkdirSync(project, { recursive: true });
	const touch = (name: string) => writeFileSync(join(root, name), "");
	return {
		toolPath,
		project,
		prints(kind: "full" | "quick", document: unknown) {
			writeFileSync(join(root, `${kind}.json`), JSON.stringify(document));
		},
		hold: (kind: "full" | "quick") => touch(`hold-${kind}`),
		release: (kind: "full" | "quick") => touch(`release-${kind}`),
		fail: (kind: "full" | "quick") => touch(`fail-${kind}`),
		log(): string[] {
			const path = join(root, "tool.log");
			return existsSync(path)
				? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
				: [];
		},
	};
}

type Machine = ReturnType<typeof machine>;

// A board over the machine that has read the project once, holding a
// document whose one task is held-task; then the next full read prints
// full-task and the next quick read quick-task, each held until released.
async function boardHolding() {
	const m = machine();
	m.prints("full", alphaDocument("held-task"));
	const settings = [
		{ name: "work", projects: [{ name: "one", path: m.project }] },
	];
	const reads = createReads(
		settings as unknown as Parameters<typeof createReads>[0],
		{ toolPath: m.toolPath, limitMs: 10_000, graceMs: 200 },
	);
	running.push(reads);
	const port = await startServer(
		{
			workspaces: settings,
			reads,
			stars: stubStars(),
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
	await reads.start();
	const held = reads.get("work", "one") as { state: string; readAt: string };
	expect(held.state).toBe("read");
	m.prints("full", alphaDocument("full-task"));
	m.prints("quick", alphaDocument("quick-task", "none"));
	m.hold("full");
	m.hold("quick");
	return { m, port, readAt: held.readAt };
}

function startsOf(m: Machine): number {
	return m.log().filter((line) => line.startsWith("start ")).length;
}

function utc(at: string): string {
	return `${new Date(at).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

afterEach(async () => {
	for (const sent of outgoing.splice(0)) {
		sent.destroy();
	}
	for (const m of roots.splice(0)) {
		writeFileSync(join(m, "release-all"), "");
	}
	await Promise.all(running.splice(0).map((reads) => reads.stop()));
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("The first part shows what is held", () => {
	describe("A held document", () => {
		it("sends, before the reads end, a first part holding the document's tasks, alpha starred, the line of when it was read, and no id alpha, after the stars form", async () => {
			const port = await serveHeld(heldAlpha, ["alpha"]);

			const { opened, received, first } = await firstPartOf(port);

			expect(opened.ended()).toBe(false);
			expect(phases(received)).toHaveLength(1);
			expect(textOf(first)).toContain("held-task");
			expect(shown(first)).toContain(
				`Shown as read ${documentReadShown}; being read again.`,
			);
			const alpha = starButtons(first).filter(
				(button) => attribute(button, "value") === "alpha",
			);
			expect(alpha).toHaveLength(1);
			expect(attribute(alpha[0] ?? "", "name")).toBe("unstar");
			expect(attribute(alpha[0] ?? "", "form")).toBe("stars");
			expect(tagsWithId(first, "alpha")).toEqual([]);
			const form = tagsWithId(received, "stars");
			expect(form).toHaveLength(1);
			expect(form[0]).toBeLessThan(phaseStarts(received)[0] ?? -1);
		});

		it("does not say only that the project is being read", async () => {
			const port = await serveHeld(heldAlpha);

			const { first } = await firstPartOf(port);

			expect(shown(first)).not.toContain("This project is being read.");
		});
	});

	describe("A kept document held", () => {
		it("shows in the first part the kept document's tasks, how long it was kept and the failed read's reason", async () => {
			const port = await serveHeld({
				state: "read",
				document: fullDocument({
					tasks: [task("kept-task", { status: "in_flight" })],
				}),
				readAt: documentRead,
				latest: { at: latestRead, reason: "<b>no" },
			});

			const { opened, first } = await firstPartOf(port);

			expect(opened.ended()).toBe(false);
			expect(textOf(first)).toContain("kept-task");
			expect(textOf(first)).toMatch(/\b30 min\b/);
			expect(textOf(first)).toContain("<b>no");
			expect(first).toContain("&lt;b&gt;no");
			expect(first).not.toContain("<b>no");
		});
	});

	describe("Nothing held", () => {
		it.each([
			["still on its first read", { state: "reading" }],
			[
				"whose reads have only failed",
				{ state: "failed", reason: "the-tool-refused" },
			],
		])(
			"says in the first part, for a project %s, that it is being read, and shows no document",
			async (_name, state) => {
				const port = await serveHeld(state);

				const { opened, first } = await firstPartOf(port);

				expect(opened.ended()).toBe(false);
				expect(shown(first)).toMatch(/being read/i);
				expect(shown(first)).not.toMatch(/Shown as read/i);
				expect(shown(first)).not.toMatch(/being read again/i);
				expect(first).not.toMatch(/<li\b/i);
				expect(first).not.toContain("the-tool-refused");
			},
		);
	});

	describe("Held, then the reads", () => {
		it("holds the held part, then the quick part, then the full document, in that order", async () => {
			const { m, port, readAt } = await boardHolding();

			const opened = open(port, "/work/one");
			await waitUntil(() => startsOf(m) === 3);
			m.release("quick");
			await waitUntil(() => opened.received().includes("quick-task"));
			expect(opened.ended()).toBe(false);
			m.release("full");
			const body = await opened.end;

			const parts = phases(body);
			expect(parts).toHaveLength(3);
			const [held, quick, full] = parts.map(shown);
			expect(held).toContain("held-task");
			expect(held).toContain(`Shown as read ${utc(readAt)}; being read again.`);
			expect(held).not.toContain("quick-task");
			expect(held).not.toContain("full-task");
			expect(quick).toContain("quick-task");
			expect(quick).toMatch(/git alone/i);
			expect(full).toContain("full-task");
			expect(full).not.toContain("held-task");
			expect(full).not.toContain("quick-task");
		});
	});
});

describe("A project's page shows each read as it arrives", () => {
	describe("The first part comes at once", () => {
		it("sends the tabs, the heading and a first part showing what is held before the reads end", async () => {
			const port = await serveHeld(heldAlpha, [], twoWorkspaces);

			const { opened, received, first } = await firstPartOf(port, "/a/one");

			expect(opened.ended()).toBe(false);
			expect(phases(received)).toHaveLength(1);
			const head = beforePhases(received);
			expect(addresses(head)).toEqual(expect.arrayContaining(["/a", "/b"]));
			expect(textOf(head)).toContain("one");
			expect(textOf(first)).toContain("held-task");
		});
	});

	describe("Quick, then full", () => {
		it("holds the first part, then the quick document marked as from git alone, then the full document", async () => {
			const { m, port } = await boardHolding();

			const opened = open(port, "/work/one");
			await waitUntil(() => startsOf(m) === 3);
			m.release("quick");
			await waitUntil(() => opened.received().includes("quick-task"));
			m.release("full");
			const body = await opened.end;

			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(3);
			expect(parts[0]).toContain("held-task");
			expect(parts[1]).toContain("quick-task");
			expect(parts[1]).toMatch(/git alone/i);
			expect(parts[1]).toMatch(/GitHub/);
			expect(parts[1]).toMatch(/statuses may be wrong/i);
			expect(parts[2]).toContain("full-task");
		});
	});

	describe("Full first", () => {
		it("holds the first part and then the full document, and no quick part", async () => {
			const { m, port } = await boardHolding();

			const opened = open(port, "/work/one");
			await waitUntil(() => startsOf(m) === 3);
			m.release("full");
			const body = await opened.end;
			m.release("quick");

			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(2);
			expect(parts[0]).toContain("held-task");
			expect(parts[1]).toContain("full-task");
			expect(body).not.toContain("quick-task");
			expect(shown(body)).not.toMatch(/git alone/i);
		});
	});

	describe("A quick read that fails", () => {
		it("adds no part saying the quick read failed", async () => {
			const { m, port } = await boardHolding();
			m.fail("quick");
			m.release("quick");

			const opened = open(port, "/work/one");
			await waitUntil(() => m.log().some((line) => line === "end quick"));
			await delay(200);
			m.release("full");
			const body = await opened.end;

			expect(body).not.toContain("quick-refused");
			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(2);
			expect(parts[0]).toContain("held-task");
			expect(parts[1]).toContain("full-task");
		});
	});

	describe("Only the latest is seen", () => {
		it("styles a page with a held part to hide every phase followed by another", async () => {
			const { m, port } = await boardHolding();
			m.release("quick");
			m.release("full");

			const body = await open(port, "/work/one").end;

			expect(phases(body).length).toBeGreaterThan(1);
			const styles = [...body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
				.map(([, css]) => css)
				.join("\n");
			expect(styles).toMatch(
				/\.phase:has\(\s*~\s*\.phase\s*\)\s*\{[^}]*display\s*:\s*none/,
			);
		});
	});
});
