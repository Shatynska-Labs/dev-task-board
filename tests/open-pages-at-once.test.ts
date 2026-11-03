import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReads } from "../src/reads.js";
import { startServer } from "../src/server.js";
import { isolatedEnvironment } from "./support/fixture.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

// Derived from open-pages-at-once's delta specs; see that change's test-plan.md.

vi.setConfig({ testTimeout: 30_000 });

const unset = "<unset>";

type Reads = ReturnType<typeof createReads>;

const running: Reads[] = [];
const roots: string[] = [];

function task(name: string, fields: Record<string, unknown> = {}) {
	return {
		name,
		status: "recorded",
		stage: null,
		workstreams: [],
		unplaced: false,
		closed_workstream: null,
		parts: ["entry"],
		last_commit: 1793540012,
		summary: null,
		priority: null,
		waits_on: [],
		body: null,
		merge_unchecked: false,
		warnings: [],
		...fields,
	};
}

function documentOf(forge: "full" | "none", tasks: unknown[]) {
	return {
		schema_version: 1,
		project: "stub",
		written_at: "2026-11-01T22:17:44Z",
		trunk: {
			ref: "origin/main",
			branch: "main",
			commit: "2cc5bd8",
			state: "fetched",
		},
		remote_branches_read: true,
		forge,
		forge_limit: 5000,
		warnings: 0,
		workstreams: [],
		tasks,
	};
}

// A machine as the board meets it: the process environment isolated, and a
// gh that answers `auth token` from the tokens it holds, and otherwise can
// use a login unless GH_CONFIG_DIR names a directory that cannot be made, as
// in the environment `environmentWithNoLogin` gives (tests/account-reads).
function machine() {
	const root = temporaryDirectory();
	roots.push(root);
	const env = isolatedEnvironment(root);
	for (const name of ["HOME", "XDG_CONFIG_HOME", "PATH"]) {
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
	const tokens = join(root, "tokens");
	mkdirSync(tokens);
	const asked = join(root, "gh.log");
	writeFileSync(
		join(root, "stubs", "gh"),
		[
			"#!/bin/sh",
			`echo "$*" >> '${asked}'`,
			'if [ "$1 $2" = "auth token" ]; then',
			`  if [ -e '${tokens}'/"$4" ]; then cat '${tokens}'/"$4"; exit 0; fi`,
			"  echo 'no oauth token found' >&2",
			"  exit 1",
			"fi",
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
		join(root, "default-full.json"),
		JSON.stringify(documentOf("full", [task("full-task")])),
	);
	writeFileSync(
		join(root, "default-quick.json"),
		JSON.stringify(documentOf("none", [task("quick-task")])),
	);
	const toolPath = join(root, "stub-tool");
	// Run through bash with --json and a path. A run is quick where gh cannot
	// use a login, and full where it can. Each run logs its start, with its pid
	// and the tokens it saw, and its end; a run is held while
	// hold-<kind>-<project> exists, until release-<kind>-<project> or
	// release-all does. Bounded, so that nothing outlives a test.
	writeFileSync(
		toolPath,
		[
			`root='${root}'`,
			`project="\${2##*/}"`,
			"if gh pr list >/dev/null 2>&1; then kind=full; else kind=quick; fi",
			`printf 'start %s %s %s %s %s\\n' "$kind" "$project" "$$" "\${GH_TOKEN-${unset}}" "\${GITHUB_TOKEN-${unset}}" >> "$root/tool.log"`,
			'if [ -e "$root/hold-$kind-$project" ]; then',
			"  i=0",
			'  until [ -e "$root/release-$kind-$project" ] || [ -e "$root/release-all" ] || [ "$i" -ge 1500 ]; do sleep 0.02; i=$((i + 1)); done',
			"fi",
			`printf 'end %s %s %s\\n' "$kind" "$project" "$$" >> "$root/tool.log"`,
			'if [ -e "$root/fail-$kind-$project" ]; then echo "Reason: $kind-refused" >&2; exit 2; fi',
			'if [ -e "$root/doc-$kind-$project.json" ]; then cat "$root/doc-$kind-$project.json"; else cat "$root/default-$kind.json"; fi',
			"",
		].join("\n"),
		{ mode: 0o644 },
	);
	return {
		root,
		asked,
		toolPath,
		holds(account: string, token = `token-of-${account}`) {
			writeFileSync(join(tokens, account), `${token}\n`);
		},
		hold(kind: "full" | "quick", project = "one") {
			writeFileSync(join(root, `hold-${kind}-${project}`), "");
		},
		release(kind: "full" | "quick", project = "one") {
			writeFileSync(join(root, `release-${kind}-${project}`), "");
		},
		fail(kind: "full" | "quick", project = "one") {
			writeFileSync(join(root, `fail-${kind}-${project}`), "");
		},
		prints(kind: "full" | "quick", document: unknown, project = "one") {
			writeFileSync(
				join(root, `doc-${kind}-${project}.json`),
				JSON.stringify(document),
			);
		},
		runs() {
			return toolRuns(root);
		},
	};
}

type Machine = ReturnType<typeof machine>;

type Run = {
	event: "start" | "end";
	kind: "full" | "quick";
	project: string;
	pid: number;
	ghToken?: string;
	githubToken?: string;
};

function toolRuns(root: string): Run[] {
	return lines(join(root, "tool.log")).map((line) => {
		const [event, kind, project, pid, ghToken, githubToken] = line.split(" ");
		return {
			event: event as Run["event"],
			kind: kind as Run["kind"],
			project: String(project),
			pid: Number(pid),
			ghToken,
			githubToken,
		};
	});
}

function started(m: Machine, kind?: Run["kind"]): Run[] {
	return m
		.runs()
		.filter((run) => run.event === "start")
		.filter((run) => kind === undefined || run.kind === kind);
}

function ended(m: Machine, kind?: Run["kind"]): Run[] {
	return m
		.runs()
		.filter((run) => run.event === "end")
		.filter((run) => kind === undefined || run.kind === kind);
}

type Workspace = {
	name: string;
	projects: string[];
	githubAccount?: string;
};

async function board(
	m: Machine,
	workspaces: Workspace[],
	limits = { limitMs: 10_000, graceMs: 200 },
) {
	const settings = workspaces.map(({ name, projects, githubAccount }) => ({
		name,
		projects: projects.map((project) => {
			const path = join(m.root, "projects", project);
			mkdirSync(path, { recursive: true });
			return { name: project, path };
		}),
		...(githubAccount === undefined ? {} : { githubAccount }),
	}));
	const reads = createReads(
		settings as unknown as Parameters<typeof createReads>[0],
		{ toolPath: m.toolPath, ...limits },
	);
	running.push(reads);
	const port = await startServer(
		{ workspaces: settings, reads } as unknown as Parameters<
			typeof startServer
		>[0],
		0,
	);
	return { reads, port };
}

const oneWorkspace: Workspace[] = [{ name: "work", projects: ["one"] }];

type Opened = {
	status: Promise<number>;
	headers: Promise<IncomingHttpHeaders>;
	received(): string;
	ended(): boolean;
	end: Promise<string>;
};

// Opens a page and reads its body as it arrives.
function open(
	port: number,
	path: string,
	headers: Record<string, string> = {},
): Opened {
	let text = "";
	let done = false;
	let answer: (value: IncomingHttpHeaders & { status: number }) => void =
		() => {};
	const answered = new Promise<IncomingHttpHeaders & { status: number }>(
		(resolve) => {
			answer = resolve;
		},
	);
	const end = new Promise<string>((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}`, ...headers },
				agent: false,
				timeout: 25_000,
			},
			(response) => {
				answer(
					Object.assign({}, response.headers, {
						status: response.statusCode ?? 0,
					}),
				);
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
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no end for ${path}`));
		});
		outgoing.on("error", reject);
		outgoing.end();
	});
	end.catch(() => {});
	return {
		status: answered.then(({ status }) => status),
		headers: answered,
		received: () => text,
		ended: () => done,
		end,
	};
}

async function page(
	port: number,
	path: string,
	headers: Record<string, string> = {},
): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
	const opened = open(port, path, headers);
	const body = await opened.end;
	return { status: await opened.status, headers: await opened.headers, body };
}

const phaseTag =
	/<section\b[^>]*\bclass=["'](?:[^"']*\s)?phase(?:\s[^"']*)?["'][^>]*>/g;

// Each part of a page: from one phase's opening tag to the next one's.
function phases(html: string): string[] {
	const starts = [...html.matchAll(phaseTag)].map((match) => match.index ?? 0);
	return starts.map((start, i) => html.slice(start, starts[i + 1]));
}

function beforePhases(html: string): string {
	const first = html.search(phaseTag);
	return first === -1 ? html : html.slice(0, first);
}

function textOf(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}

function links(html: string): string[] {
	return [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
}

function address(tag: string): string | undefined {
	return /\bhref=["']([^"']*)["']/.exec(tag)?.[1];
}

function addresses(html: string): (string | undefined)[] {
	return links(html).map(address);
}

function marked(html: string): (string | undefined)[] {
	return links(html)
		.filter((tag) => /\baria-current=["']page["']/.test(tag))
		.map(address);
}

function lines(path: string): string[] {
	return existsSync(path)
		? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
		: [];
}

function tokenRequests(path: string): string[] {
	return lines(path).filter((line) => line.startsWith("auth "));
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

// A zombie answers kill(pid, 0), so ask ps what state the process is in.
function isRunning(pid: number): boolean {
	const { stdout } = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], {
		encoding: "utf8",
	});
	const state = stdout.trim();
	return state !== "" && !state.startsWith("Z");
}

afterEach(async () => {
	for (const root of roots.splice(0)) {
		writeFileSync(join(root, "release-all"), "");
	}
	await Promise.all(running.splice(0).map((reads) => reads.stop()));
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("Each project is read at start and when requested", () => {
	describe("The server answers during a read", () => {
		it("ends another project's page and the list of workspaces while one project's reads are held", async () => {
			const m = machine();
			m.hold("full", "one");
			m.hold("quick", "one");
			const { port } = await board(m, [
				{ name: "work", projects: ["one", "two"] },
				{ name: "other", projects: ["three"] },
			]);
			const held = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);

			const other = await page(port, "/work/two");
			const list = await page(port, "/");

			expect(other.status).toBe(200);
			expect(textOf(phases(other.body).at(-1) ?? "")).toContain("full-task");
			expect(list.status).toBe(200);
			expect(held.ended()).toBe(false);
		});
	});

	describe("A changed project is requested", () => {
		it("holds the new document and a later time of the read once its page has ended", async () => {
			const m = machine();
			const { reads, port } = await board(m, oneWorkspace);
			await reads.start();
			const before = reads.get("work", "one") as { readAt: string };

			await delay(5);
			m.prints("full", documentOf("full", [task("changed-task")]));
			await page(port, "/work/one");

			const after = reads.get("work", "one") as {
				state: string;
				document: { tasks: { name: string }[] };
				readAt: string;
			};
			expect(after.state).toBe("read");
			expect(after.document.tasks.map(({ name }) => name)).toEqual([
				"changed-task",
			]);
			expect(new Date(after.readAt).getTime()).toBeGreaterThan(
				new Date(before.readAt).getTime(),
			);
		});
	});

	describe("Two requests during one read", () => {
		it("starts no second full read, and both pages end when the read finishes", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, oneWorkspace);

			const first = open(port, "/work/one");
			await waitUntil(() => started(m, "full").length === 1);
			const second = open(port, "/work/one");
			await delay(300);

			expect(started(m, "full")).toHaveLength(1);
			expect(first.ended()).toBe(false);
			expect(second.ended()).toBe(false);

			m.release("full");
			for (const body of await Promise.all([first.end, second.end])) {
				expect(textOf(phases(body).at(-1) ?? "")).toContain("full-task");
			}
			expect(started(m, "full")).toHaveLength(1);
		});
	});

	describe("Nobody is asking", () => {
		it("starts no read after a page has ended", async () => {
			const m = machine();
			const { reads, port } = await board(m, oneWorkspace);
			await reads.start();
			await page(port, "/work/one");
			const after = started(m).length;

			await delay(500);

			expect(started(m)).toHaveLength(after);
		});
	});

	describe("An overview reads every project", () => {
		it("starts no read for a workspace of two projects", async () => {
			const m = machine();
			const { port } = await board(m, [
				{ name: "work", projects: ["one", "two"] },
			]);

			const { status } = await page(port, "/work");
			await delay(300);

			expect(status).toBe(200);
			expect(started(m)).toEqual([]);
		});

		it("ends without waiting for a read in progress", async () => {
			const m = machine();
			m.hold("full", "one");
			const { reads, port } = await board(m, [
				{ name: "work", projects: ["one", "two"] },
			]);
			const pass = reads.start();
			await waitUntil(() => started(m, "full").length === 1);

			const { status } = await page(port, "/work");

			expect(status).toBe(200);
			expect(ended(m)).toEqual([]);
			expect(started(m)).toHaveLength(1);
			m.release("full", "one");
			await pass;
		});
	});

	describe("A request that names no project to read", () => {
		it.each([
			[
				"a refused request",
				"/work/one",
				{ "Sec-Fetch-Site": "cross-site" },
				403,
			],
			["a 404", "/work/nothing", {}, 404],
		])("starts no read for %s", async (_name, path, headers, status) => {
			const m = machine();
			const { port } = await board(m, oneWorkspace);

			expect((await page(port, path, headers)).status).toBe(status);
			await delay(300);

			expect(started(m)).toEqual([]);
		});

		it("starts no read for the list of workspaces", async () => {
			const m = machine();
			const { port } = await board(m, [
				{ name: "a", projects: ["one"] },
				{ name: "b", projects: ["two"] },
			]);

			expect((await page(port, "/")).status).toBe(200);
			await delay(300);

			expect(started(m)).toEqual([]);
		});
	});
});

describe("A read uses its workspace's GitHub account", () => {
	describe("Two workspaces, two accounts", () => {
		it("gives each full read the token of its own workspace's account", async () => {
			const m = machine();
			m.holds("first");
			m.holds("second");
			const { port } = await board(m, [
				{ name: "a", projects: ["one"], githubAccount: "first" },
				{ name: "b", projects: ["one"], githubAccount: "second" },
			]);

			await page(port, "/a/one");
			await page(port, "/b/one");

			expect(started(m, "full").map((run) => run.ghToken)).toEqual([
				"token-of-first",
				"token-of-second",
			]);
		});
	});
});

describe("A project's page starts a quick read beside the full one", () => {
	describe("Both reads start", () => {
		it("runs the tool twice, overlapping, once with gh unable to log in", async () => {
			const m = machine();
			vi.stubEnv("GH_TOKEN", "the-boards-own");
			vi.stubEnv("GITHUB_TOKEN", "also-the-boards-own");
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, oneWorkspace);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);

			expect(ended(m)).toEqual([]);
			expect(started(m, "full")).toHaveLength(1);
			expect(started(m, "quick")).toHaveLength(1);
			expect(started(m, "full")[0]).toMatchObject({
				ghToken: "the-boards-own",
				githubToken: "also-the-boards-own",
			});
			expect(started(m, "quick")[0]).toMatchObject({
				ghToken: unset,
				githubToken: unset,
			});
			m.release("full");
			m.release("quick");
			await opened.end;
		});
	});

	describe("A quick read is not held", () => {
		it("holds what it held before the request after the quick read ends", async () => {
			const m = machine();
			const { reads, port } = await board(m, oneWorkspace);
			await reads.start();
			const before = reads.get("work", "one");
			m.hold("full");
			m.hold("quick");

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 3);
			m.release("quick");
			await waitUntil(() => opened.received().includes("quick-task"));

			expect(reads.get("work", "one")).toEqual(before);
			m.release("full");
			await opened.end;
		});
	});

	describe("The full read ends first", () => {
		it("stops the quick read", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, oneWorkspace);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);
			const quick = started(m, "quick")[0]?.pid ?? 0;
			expect(quick).toBeGreaterThan(1);
			m.release("full");
			await opened.end;

			await waitUntil(() => !isRunning(quick), 5000);
			expect(ended(m, "quick")).toEqual([]);
		});
	});

	describe("No account is used", () => {
		it("asks gh for a token once, by the full read", async () => {
			const m = machine();
			m.holds("someone");
			const { port } = await board(m, [
				{ name: "work", projects: ["one"], githubAccount: "someone" },
			]);

			await page(port, "/work/one");
			await delay(300);

			expect(tokenRequests(m.asked)).toEqual(["auth token --user someone"]);
			expect(started(m, "full").map((run) => run.ghToken)).toEqual([
				"token-of-someone",
			]);
			expect(started(m, "quick")).toHaveLength(1);
			expect(started(m, "quick")[0]?.ghToken).toBe(unset);
		});
	});

	describe("Joining a read at start", () => {
		it("starts no second full read, and starts a quick read", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { reads, port } = await board(m, oneWorkspace);
			const pass = reads.start();
			await waitUntil(() => started(m, "full").length === 1);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m, "quick").length === 1);
			await delay(300);

			expect(started(m, "full")).toHaveLength(1);
			expect(started(m, "quick")).toHaveLength(1);
			m.release("full");
			await pass;
			await opened.end;
		});
	});

	describe("Two requests during one quick read", () => {
		it("starts no second quick read", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, oneWorkspace);

			const first = open(port, "/work/one");
			await waitUntil(() => started(m, "quick").length === 1);
			const second = open(port, "/work/one");
			await delay(300);

			expect(started(m, "quick")).toHaveLength(1);
			m.release("quick");
			m.release("full");
			await Promise.all([first.end, second.end]);
			expect(started(m, "quick")).toHaveLength(1);
		});
	});

	describe("Nothing quick at start", () => {
		it("runs only full reads in the pass at start", async () => {
			const m = machine();
			const { reads } = await board(m, [
				{ name: "work", projects: ["one", "two"] },
			]);

			await reads.start();
			await delay(300);

			expect(started(m).map((run) => run.kind)).toEqual(["full", "full"]);
		});
	});
});

describe("The overview shows each project's state", () => {
	describe("Mixed states", () => {
		it("shows what the board holds: counts and the time of the read for one, the reason for the other", async () => {
			const m = machine();
			m.prints(
				"full",
				documentOf("full", [
					task("w1", { status: "in_flight", stage: "plan:drafting" }),
					task("w2", { status: "in_flight", stage: "plan:drafting" }),
					task("w3", { status: "in_flight", stage: null }),
					task("r1"),
					task("r2", { status: "done" }),
					task("r3", { status: "planned" }),
					task("r4"),
				]),
				"alpha",
			);
			m.fail("full", "beta");
			const { reads, port } = await board(m, [
				{ name: "work", projects: ["alpha", "beta"] },
			]);
			await reads.start();
			const before = started(m).length;

			const { status, body } = await page(port, "/work");

			expect(status).toBe(200);
			const text = textOf(body);
			const first = text.slice(text.indexOf("alpha"), text.indexOf("beta"));
			const second = text.slice(text.indexOf("beta"));
			expect(first).toMatch(/\b3\b/);
			expect(first).toMatch(/\b7\b/);
			expect(first).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/);
			expect(second).toContain("full-refused");
			expect(started(m)).toHaveLength(before);
		});
	});

	describe("An overview while a project is read", () => {
		it("ends before that read ends, saying the project is being read", async () => {
			const m = machine();
			m.hold("full", "one");
			const { reads, port } = await board(m, oneWorkspace);
			const pass = reads.start();
			await waitUntil(() => started(m, "full").length === 1);

			const { status, body } = await page(port, "/work");

			expect(status).toBe(200);
			expect(ended(m)).toEqual([]);
			expect(textOf(body)).toMatch(/being read/i);
			m.release("full", "one");
			await pass;
		});
	});
});

describe("A page shows what was read for it", () => {
	describe("A refresh shows a change", () => {
		it("shows the change in the page's last part", async () => {
			const m = machine();
			const { port } = await board(m, oneWorkspace);
			const first = await page(port, "/work/one");
			expect(textOf(phases(first.body).at(-1) ?? "")).toContain("full-task");

			m.prints("full", documentOf("full", [task("changed-task")]));
			const second = await page(port, "/work/one");

			const last = textOf(phases(second.body).at(-1) ?? "");
			expect(last).toContain("changed-task");
			expect(last).not.toContain("full-task");
		});
	});

	describe("A read past its limit", () => {
		it("ends the page, with that reason", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, oneWorkspace, {
				limitMs: 400,
				graceMs: 100,
			});

			const started_ = Date.now();
			const { status, body } = await page(port, "/work/one");

			expect(status).toBe(200);
			expect(Date.now() - started_).toBeLessThan(5000);
			expect(textOf(phases(body).at(-1) ?? "")).toMatch(/limit|timed? ?out/i);
		});
	});

	describe("A request from another site", () => {
		describe.each(["cross-site", "same-site"])("%s", (site) => {
			it.each(["/work/one", "/work"])(
				"answers %s with 403, and starts no read",
				async (path) => {
					const m = machine();
					const { port } = await board(m, oneWorkspace);

					const { status, body } = await page(port, path, {
						"Sec-Fetch-Site": site,
					});
					await delay(300);

					expect(status).toBe(403);
					expect(body).not.toContain("full-task");
					expect(started(m)).toEqual([]);
				},
			);
		});
	});

	describe("A request from the reader", () => {
		it.each([
			["none", { "Sec-Fetch-Site": "none" }],
			["same-origin", { "Sec-Fetch-Site": "same-origin" }],
			["no such header", {}],
		])("answers a project's page normally given %s", async (_name, headers) => {
			const m = machine();
			const { port } = await board(m, oneWorkspace);

			const { status, body } = await page(port, "/work/one", headers);

			expect(status).toBe(200);
			expect(textOf(phases(body).at(-1) ?? "")).toContain("full-task");
		});
	});

	describe("Not cached", () => {
		it.each(["/work/one", "/work"])(
			"sends %s with Cache-Control: no-store",
			async (path) => {
				const m = machine();
				const { port } = await board(m, oneWorkspace);

				const { status, headers } = await page(port, path);

				expect(status).toBe(200);
				expect(headers["cache-control"]).toBe("no-store");
			},
		);
	});
});

describe("A project's page shows each read as it arrives", () => {
	describe("The first part comes at once", () => {
		it("sends the tabs, the heading and a part saying it is being read before the reads end", async () => {
			const m = machine();
			m.hold("full", "one");
			m.hold("quick", "one");
			const { port } = await board(m, [
				{ name: "a", projects: ["one"] },
				{ name: "b", projects: ["other"] },
			]);

			const opened = open(port, "/a/one");
			expect(await opened.status).toBe(200);
			await waitUntil(() => phases(opened.received()).length >= 1);

			const received = opened.received();
			expect(ended(m)).toEqual([]);
			expect(opened.ended()).toBe(false);
			expect(phases(received)).toHaveLength(1);
			expect(textOf(phases(received)[0] ?? "")).toMatch(/being read/i);
			const head = beforePhases(received);
			expect(addresses(head)).toEqual(expect.arrayContaining(["/a", "/b"]));
			expect(textOf(head)).toContain("one");
		});
	});

	describe("Quick, then full", () => {
		it("holds the being-read part, the quick document marked as from git alone, then the full document", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, oneWorkspace);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);
			m.release("quick");
			await waitUntil(() => opened.received().includes("quick-task"));
			expect(opened.ended()).toBe(false);
			m.release("full");
			const body = await opened.end;

			const parts = phases(body).map(textOf);
			expect(parts).toHaveLength(3);
			expect(parts[0]).toMatch(/being read/i);
			expect(parts[0]).not.toContain("quick-task");
			expect(parts[1]).toContain("quick-task");
			expect(parts[1]).toMatch(/git alone/i);
			expect(parts[1]).toMatch(/GitHub/);
			expect(parts[1]).toMatch(/statuses may be wrong/i);
			expect(parts[2]).toContain("full-task");
			expect(parts[2]).not.toContain("quick-task");
		});
	});

	describe("Full first", () => {
		it("holds the being-read part and then the full document, and no quick part", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, oneWorkspace);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);
			m.release("full");
			const body = await opened.end;
			m.release("quick");
			await delay(200);

			const parts = phases(body).map(textOf);
			expect(parts).toHaveLength(2);
			expect(parts[0]).toMatch(/being read/i);
			expect(parts[1]).toContain("full-task");
			expect(body).not.toContain("quick-task");
			expect(textOf(body)).not.toMatch(/git alone/i);
		});
	});

	describe("A quick read that fails", () => {
		it("adds no part saying the quick read failed", async () => {
			const m = machine();
			m.hold("full");
			m.fail("quick");
			const { port } = await board(m, oneWorkspace);

			const opened = open(port, "/work/one");
			await waitUntil(() => ended(m, "quick").length === 1);
			await delay(200);
			m.release("full");
			const body = await opened.end;

			expect(body).not.toContain("quick-refused");
			const parts = phases(body).map(textOf);
			expect(parts).toHaveLength(2);
			expect(parts[1]).toContain("full-task");
		});
	});

	describe("Only the latest is seen", () => {
		it.each(["/work/one", "/work"])(
			"styles %s to hide every phase followed by another, with no script",
			async (path) => {
				const m = machine();
				const { port } = await board(m, oneWorkspace);

				const { body } = await page(port, path);

				const styles = [...body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
					.map(([, css]) => css)
					.join("\n");
				expect(styles).toMatch(
					/\.phase:has\(\s*~\s*\.phase\s*\)\s*\{[^}]*display\s*:\s*none/,
				);
				expect(body).not.toMatch(/<script\b/i);
			},
		);
	});
});

describe("Several workspaces show as tabs", () => {
	describe("Several workspaces", () => {
		it("links an overview to each, and marks only its own", async () => {
			const m = machine();
			const { port } = await board(m, [
				{ name: "a", projects: ["one"] },
				{ name: "b", projects: ["one"] },
			]);

			const { body } = await page(port, "/b");

			expect(addresses(body)).toEqual(expect.arrayContaining(["/a", "/b"]));
			expect(marked(body)).toEqual(["/b"]);
		});
	});

	describe("On a project's page", () => {
		it("links to each overview once, across all its parts, and marks only its workspace", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m, [
				{ name: "a", projects: ["one"] },
				{ name: "b", projects: ["one"] },
			]);

			const opened = open(port, "/b/one");
			await waitUntil(() => started(m).length === 2);
			m.release("quick");
			await waitUntil(() => opened.received().includes("quick-task"));
			m.release("full");
			const body = await opened.end;

			expect(addresses(body).filter((link) => link === "/a")).toEqual(["/a"]);
			expect(addresses(body).filter((link) => link === "/b")).toEqual(["/b"]);
			expect(marked(body)).toEqual(["/b"]);
		});
	});

	describe("One workspace", () => {
		it("shows no tabs, and the project's page links to /work", async () => {
			const m = machine();
			const { port } = await board(m, oneWorkspace);

			const overview = await page(port, "/work");
			const project = await page(port, "/work/one");

			expect(marked(overview.body)).toEqual([]);
			expect(marked(project.body)).toEqual([]);
			expect(addresses(beforePhases(project.body))).toContain("/work");
		});
	});

	describe("A name needing care", () => {
		it("encodes the address and escapes the text", async () => {
			const m = machine();
			const { port } = await board(m, [
				{ name: "a b", projects: ["one"] },
				{ name: "<c>", projects: ["one"] },
			]);

			const { body } = await page(port, "/a%20b");

			expect(addresses(body)).toEqual(
				expect.arrayContaining(["/a%20b", "/%3Cc%3E"]),
			);
			expect(body).toContain("&lt;c&gt;");
			expect(body).not.toContain("<c>");
		});
	});

	describe("Another workspace is not read", () => {
		it("starts no read, of either workspace, when an overview is followed", async () => {
			const m = machine();
			const { port } = await board(m, [
				{ name: "a", projects: ["one"] },
				{ name: "b", projects: ["two"] },
			]);

			expect((await page(port, "/a")).status).toBe(200);
			await delay(300);

			expect(started(m)).toEqual([]);
		});
	});
});
