import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReads } from "../src/reads.js";
import {
	buildFixtureRepository,
	isolatedEnvironment,
} from "./support/fixture.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 30_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const carriedTool = join(repositoryRoot, "vendor", "task-board");

const realSetTimeout = globalThis.setTimeout;

type ProjectState =
	| { state: "reading" }
	| { state: "read"; document: unknown; readAt: unknown }
	| { state: "failed"; reason: string };

const minimalDocument = {
	schema_version: 1,
	project: "stub",
	written_at: "2026-11-01T22:17:44Z",
	trunk: { ref: "HEAD", branch: "main", commit: "3fd0ad2", state: "no_origin" },
	remote_branches_read: false,
	forge: "none",
	forge_limit: 5000,
	warnings: 0,
	workstreams: [],
	tasks: [],
};

const printed = JSON.stringify(minimalDocument);

type Reads = ReturnType<typeof createReads>;

const running: Reads[] = [];
const spawnedPids: number[] = [];

function stubTool(directory: string, body: string): string {
	const path = join(directory, "stub-tool");
	writeFileSync(path, `${body}\n`, { mode: 0o644 });
	return path;
}

function projects(directory: string, ...names: string[]) {
	return names.map((name) => {
		const path = join(directory, name);
		mkdirSync(path);
		return { name, path };
	});
}

function board(
	root: string,
	names: string[],
	toolPath: string,
	limitMs = 8000,
) {
	const reads = createReads(
		[{ name: "work", projects: projects(root, ...names) }],
		{ toolPath, limitMs, graceMs: 200 },
	);
	running.push(reads);
	return reads;
}

function get(reads: Reads, project = "one"): ProjectState {
	return reads.get("work", project) as ProjectState;
}

function lines(path: string): string[] {
	return existsSync(path)
		? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
		: [];
}

async function waitUntil(condition: () => boolean, ms = 5000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error("timed out waiting");
		}
		await delay(20);
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		realSetTimeout(resolve, ms);
	});
}

function tracked(promise: Promise<unknown>): { settled(): boolean } {
	let done = false;
	const mark = () => {
		done = true;
	};
	promise.then(mark, mark);
	return { settled: () => done };
}

// A zombie answers kill(pid, 0), so ask ps what state the process is in.
function isRunning(pid: number): boolean {
	const { stdout } = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], {
		encoding: "utf8",
	});
	const state = stdout.trim();
	return state !== "" && !state.startsWith("Z");
}

function useIsolatedProcessEnvironment(root: string): NodeJS.ProcessEnv {
	const env = isolatedEnvironment(root);
	for (const name of ["HOME", "XDG_CONFIG_HOME", "PATH"]) {
		vi.stubEnv(name, env[name]);
	}
	for (const name of Object.keys(process.env)) {
		if (name.startsWith("GIT_")) {
			vi.stubEnv(name, undefined);
		}
	}
	return env;
}

afterEach(async () => {
	vi.useRealTimers();
	await Promise.all(running.splice(0).map((reads) => reads.stop()));
	for (const pid of spawnedPids.splice(0)) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// Already gone, as a passing test leaves it.
		}
	}
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("Each project is read at start and when requested", () => {
	describe("A readable project", () => {
		it("holds the document and the time of the read, when a request read it", async () => {
			const root = temporaryDirectory();
			const env = useIsolatedProcessEnvironment(root);
			const project = join(root, "one");
			buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
			const reads = createReads(
				[{ name: "work", projects: [{ name: "one", path: project }] }],
				{ toolPath: carriedTool, limitMs: 20_000, graceMs: 500 },
			);
			running.push(reads);

			const before = Date.now();
			await reads.refresh("work", "one");
			const after = Date.now();

			const state = get(reads);
			if (state.state !== "read") {
				throw new Error(`expected a read, got ${JSON.stringify(state)}`);
			}
			expect(state.document).toMatchObject({
				schema_version: 1,
				project: "one",
			});
			const readAt = new Date(state.readAt as string).getTime();
			expect(readAt).toBeGreaterThanOrEqual(before - 1000);
			expect(readAt).toBeLessThanOrEqual(after + 1000);
		});
	});

	describe("The server answers during a read", () => {
		it("reads another project while one has not finished", async () => {
			const root = temporaryDirectory();
			const release = join(root, "release");
			const reads = board(
				root,
				["one", "two"],
				stubTool(
					root,
					`case "$2" in\n*/one) until [ -e '${release}' ]; do sleep 0.02; done ;;\nesac\necho '${printed}'`,
				),
			);
			const pass = reads.start();

			await reads.refresh("work", "two");

			expect(get(reads, "one").state).toBe("reading");
			expect(get(reads, "two").state).toBe("read");
			writeFileSync(release, "");
			await pass;
		});
	});

	describe("A changed project is requested", () => {
		function changing(root: string, hold = join(root, "no-such-file")) {
			const log = join(root, "read.log");
			const path = join(root, "document.json");
			const release = join(root, "release");
			writeFileSync(path, printed);
			const toolPath = stubTool(
				root,
				[
					`echo "$2" >> '${log}'`,
					`if [ -e '${hold}' ]; then until [ -e '${release}' ]; do sleep 0.02; done; fi`,
					`cat '${path}'`,
				].join("\n"),
			);
			const change = (project: string) => {
				writeFileSync(path, JSON.stringify({ ...minimalDocument, project }));
			};
			return { log, release, toolPath, change };
		}

		it("holds the new document and a later time of the read", async () => {
			const root = temporaryDirectory();
			const { log, toolPath, change } = changing(root);
			const reads = board(root, ["one"], toolPath);
			await reads.start();
			const first = get(reads) as { readAt: string };

			await delay(5);
			change("changed");
			await reads.refresh("work", "one");

			const state = get(reads) as { document: unknown; readAt: string };
			expect(lines(log)).toHaveLength(2);
			expect(state.document).toMatchObject({ project: "changed" });
			expect(new Date(state.readAt).getTime()).toBeGreaterThan(
				new Date(first.readAt).getTime(),
			);
		});

		it("keeps the state it held until the next read finishes", async () => {
			const root = temporaryDirectory();
			const hold = join(root, "hold");
			const { log, release, toolPath, change } = changing(root, hold);
			const reads = board(root, ["one"], toolPath);
			await reads.start();
			const held = get(reads);

			writeFileSync(hold, "");
			change("changed");
			const refreshed = reads.refresh("work", "one");
			await waitUntil(() => lines(log).length === 2);

			expect(get(reads)).toEqual(held);

			writeFileSync(release, "");
			await refreshed;
			expect(get(reads)).toMatchObject({
				state: "read",
				document: { project: "changed" },
			});
		});

		it("settles, with the reason in place of the document, when the read fails", async () => {
			const root = temporaryDirectory();
			const failing = join(root, "failing");
			const reads = board(
				root,
				["one"],
				stubTool(
					root,
					`if [ -e '${failing}' ]; then echo 'Reason: refused' >&2; exit 2; fi\necho '${printed}'`,
				),
			);
			await reads.start();

			writeFileSync(failing, "");
			await expect(reads.refresh("work", "one")).resolves.toBeUndefined();

			const state = get(reads);
			expect(state).toMatchObject({ state: "failed" });
			expect((state as { reason: string }).reason).toContain("refused");
		});
	});

	describe("Two requests during one read", () => {
		function held(root: string) {
			const log = join(root, "read.log");
			return {
				log,
				toolPath: stubTool(
					root,
					[
						`echo "$2" >> '${log}'`,
						`until [ -e '${root}/release-\${2##*/}' ]; do sleep 0.02; done`,
						`echo '${printed}'`,
					].join("\n"),
				),
				release: (name: string) => {
					writeFileSync(join(root, `release-${name}`), "");
				},
			};
		}

		it("starts no second read, and both settle when the read finishes", async () => {
			const root = temporaryDirectory();
			const { log, toolPath, release } = held(root);
			const reads = board(root, ["one"], toolPath);

			const first = tracked(reads.refresh("work", "one"));
			await waitUntil(() => lines(log).length === 1);
			const second = tracked(reads.refresh("work", "one"));
			await delay(300);

			expect(lines(log)).toHaveLength(1);
			expect(first.settled()).toBe(false);
			expect(second.settled()).toBe(false);

			release("one");
			await waitUntil(() => first.settled() && second.settled());
			expect(lines(log)).toHaveLength(1);
			expect(get(reads).state).toBe("read");
		});

		it("joins the read the pass at start is running", async () => {
			const root = temporaryDirectory();
			const { log, toolPath, release } = held(root);
			const reads = board(root, ["one"], toolPath);

			const pass = reads.start();
			await waitUntil(() => lines(log).length === 1);
			const request = tracked(reads.refresh("work", "one"));
			await delay(300);

			expect(lines(log)).toHaveLength(1);
			expect(request.settled()).toBe(false);

			release("one");
			await pass;
			await waitUntil(() => request.settled());
			expect(lines(log)).toHaveLength(1);
		});

		it("has the pass at start join a read a request began", async () => {
			const root = temporaryDirectory();
			const { log, toolPath, release } = held(root);
			const reads = board(root, ["one", "two"], toolPath);

			const pass = reads.start();
			await waitUntil(() => lines(log).length === 1);
			const request = reads.refresh("work", "two");
			await waitUntil(() => lines(log).length === 2);

			release("one");
			await delay(300);
			release("two");
			await Promise.all([pass, request]);

			expect(lines(log).map((path) => path.split("/").pop())).toEqual([
				"one",
				"two",
			]);
		});
	});

	describe("Nobody is asking", () => {
		const everyTimer = {
			toFake: [
				"setTimeout",
				"clearTimeout",
				"setInterval",
				"clearInterval",
			] as const,
			shouldAdvanceTime: true,
		};

		function logging(root: string) {
			const log = join(root, "read.log");
			return {
				log,
				toolPath: stubTool(root, `echo "$2" >> '${log}'\necho '${printed}'`),
			};
		}

		it("starts no read after the pass at start, however long passes", async () => {
			const root = temporaryDirectory();
			const { log, toolPath } = logging(root);
			vi.useFakeTimers({ ...everyTimer, toFake: [...everyTimer.toFake] });
			const reads = board(root, ["one"], toolPath);

			await reads.start();
			expect(lines(log)).toHaveLength(1);
			await vi.advanceTimersByTimeAsync(10 * 60_000);
			await delay(300);

			expect(lines(log)).toHaveLength(1);
		});

		it("starts no read after a request's read, however long passes", async () => {
			const root = temporaryDirectory();
			const { log, toolPath } = logging(root);
			vi.useFakeTimers({ ...everyTimer, toFake: [...everyTimer.toFake] });
			const reads = board(root, ["one"], toolPath);

			await reads.start();
			await reads.refresh("work", "one");
			expect(lines(log)).toHaveLength(2);
			await vi.advanceTimersByTimeAsync(10 * 60_000);
			await delay(300);

			expect(lines(log)).toHaveLength(2);
		});
	});

	describe("An overview reads every project", () => {
		it("overlaps their reads, and settles when both have finished", async () => {
			const root = temporaryDirectory();
			const log = join(root, "read.log");
			const release = join(root, "release");
			// Each read waits for the other to have begun, so reads one at a time
			// leave the first to its limit, and a reason other than its refusal.
			const reads = board(
				root,
				["bad", "good"],
				stubTool(
					root,
					[
						`echo "$2" >> '${log}'`,
						`until [ "$(wc -l < '${log}')" -ge 2 ]; do sleep 0.02; done`,
						`case "$2" in\n*/bad) echo 'Reason: refused' >&2; exit 2 ;;\nesac`,
						`until [ -e '${release}' ]; do sleep 0.02; done`,
						`echo '${printed}'`,
					].join("\n"),
				),
				1500,
			);

			const overview = tracked(reads.refresh("work"));
			await waitUntil(() => get(reads, "bad").state === "failed");

			expect((get(reads, "bad") as { reason: string }).reason).toContain(
				"refused",
			);
			expect(lines(log)).toHaveLength(2);
			expect(overview.settled()).toBe(false);

			writeFileSync(release, "");
			await waitUntil(() => overview.settled());
			expect(get(reads, "good").state).toBe("read");
		});
	});
});

describe("A request's read and stopping", () => {
	it("reads nothing after stop(), and settles at once", async () => {
		const root = temporaryDirectory();
		const log = join(root, "read.log");
		const reads = createReads(
			[{ name: "work", projects: projects(root, "one") }],
			{
				toolPath: stubTool(root, `echo "$2" >> '${log}'\necho '${printed}'`),
				limitMs: 8000,
				graceMs: 200,
			},
		);
		await reads.start();
		await reads.stop();

		await reads.refresh("work", "one");
		await reads.refresh("work");
		await delay(200);

		expect(lines(log)).toHaveLength(1);
	});

	it("stops a read a request began, and the request settles", async () => {
		const root = temporaryDirectory();
		const pidFile = join(root, "tool.pid");
		const reads = createReads(
			[{ name: "work", projects: projects(root, "one") }],
			{
				toolPath: stubTool(root, `echo $$ > '${pidFile}'\nexec sleep 60`),
				limitMs: 20_000,
				graceMs: 200,
			},
		);

		const request = reads.refresh("work", "one");
		await waitUntil(() => lines(pidFile).length === 1);
		const pid = Number(lines(pidFile)[0]);
		spawnedPids.push(pid);
		await reads.stop();
		await request;

		await waitUntil(() => !isRunning(pid));
	});
});
