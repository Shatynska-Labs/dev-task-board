import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReads, whatMissed } from "../src/reads.js";
import { startServer } from "../src/server.js";
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

type Latest = { at: string; reason?: string; missed?: string[] };

type State =
	| { state: "reading" }
	| {
			state: "read";
			document: Record<string, unknown>;
			readAt: string;
			latest?: Latest;
	  }
	| { state: "failed"; reason: string };

type Reads = ReturnType<typeof createReads>;

const running: Reads[] = [];

const fullDocument = {
	schema_version: 1,
	project: "full-read",
	written_at: "2026-11-01T22:17:44Z",
	trunk: {
		ref: "origin/main",
		branch: "main",
		commit: "2cc5bd8",
		state: "fetched",
	},
	remote_branches_read: true,
	forge: "full",
	forge_limit: 5000,
	warnings: 0,
	workstreams: [],
	tasks: [],
};

const noForge = { ...fullDocument, project: "no-forge", forge: "none" };

const outage = {
	...fullDocument,
	project: "outage",
	forge: "none",
	trunk: { ...fullDocument.trunk, state: "fetch_failed" },
	remote_branches_read: false,
};

// A tool printing one file, refusing while `failing` exists, and holding a
// read while `hold` exists until `release` does. Each read is logged.
function scriptedBoard(root: string, names: string[] = ["one"]) {
	const log = join(root, "read.log");
	const printedFile = join(root, "document.json");
	const failing = join(root, "failing");
	const hold = join(root, "hold");
	const release = join(root, "release");
	const toolPath = join(root, "stub-tool");
	writeFileSync(
		toolPath,
		[
			`echo "$2" >> '${log}'`,
			`if [ -e '${hold}' ]; then until [ -e '${release}' ]; do sleep 0.02; done; fi`,
			`if [ -e '${failing}' ]; then echo 'Reason: refused' >&2; exit 2; fi`,
			`cat '${printedFile}'`,
		].join("\n"),
		{ mode: 0o644 },
	);
	const reads = board(root, names, toolPath);
	return {
		reads,
		log,
		prints(document: unknown) {
			writeFileSync(printedFile, JSON.stringify(document));
		},
		fails() {
			writeFileSync(failing, "");
		},
		recovers() {
			rmSync(failing);
		},
		holds() {
			writeFileSync(hold, "");
		},
		releases() {
			writeFileSync(release, "");
		},
	};
}

function board(root: string, names: string[], toolPath: string) {
	const projects = names.map((name) => {
		const path = join(root, name);
		mkdirSync(path);
		return { name, path };
	});
	const reads = createReads([{ name: "work", projects }], {
		toolPath,
		limitMs: 3000,
		graceMs: 200,
	});
	running.push(reads);
	return reads;
}

function get(reads: Reads, project = "one"): State {
	return reads.get("work", project) as unknown as State;
}

function held(reads: Reads, project = "one") {
	const state = get(reads, project);
	if (state.state !== "read") {
		throw new Error(`expected a document, got ${JSON.stringify(state)}`);
	}
	return state;
}

function lines(path: string): string[] {
	return existsSync(path)
		? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
		: [];
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		realSetTimeout(resolve, ms);
	});
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

function tracked(promise: Promise<unknown>): { settled(): boolean } {
	let done = false;
	const mark = () => {
		done = true;
	};
	promise.then(mark, mark);
	return { settled: () => done };
}

function time(value: string | undefined): number {
	return new Date(value as string).getTime();
}

function missedBy(document: unknown): string[] {
	return whatMissed(document as Parameters<typeof whatMissed>[0]);
}

// Read once, then let time pass so that a later read has a later time.
async function holding(
	scripted: ReturnType<typeof scriptedBoard>,
	document: unknown,
) {
	scripted.prints(document);
	await scripted.reads.refresh("work", "one");
	const state = held(scripted.reads);
	await delay(5);
	return state;
}

// The `reads` port as `tests/refresh-server.test.ts` stubs it, with a refresh
// that may be held for one project.
function stubReads(heldProject?: string) {
	const stub = {
		calls: [] as [string, string | undefined][],
		release: () => {},
		get: () => ({
			state: "read",
			document: fullDocument,
			readAt: "2026-11-01T22:18:00Z",
		}),
		quick: async () => undefined,
		refresh: (workspace: string, project?: string) => {
			stub.calls.push([workspace, project]);
			if (project !== undefined && project === heldProject) {
				return new Promise<void>((resolve) => {
					stub.release = resolve;
				});
			}
			return Promise.resolve();
		},
	};
	return stub;
}

function serve(reads: unknown, workspaces: unknown) {
	return startServer(
		{ workspaces, reads } as unknown as Parameters<typeof startServer>[0],
		0,
	);
}

function requestStatus(
	port: number,
	path: string,
	headers: Record<string, string> = {},
): Promise<number> {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}`, ...headers },
				agent: false,
			},
			(response) => {
				response.resume();
				response.on("end", () => {
					resolve(response.statusCode ?? 0);
				});
			},
		);
		outgoing.on("error", reject);
		outgoing.end();
	});
}

const oneWorkspace = [
	{
		name: "work",
		projects: [
			{ name: "one", path: "/srv/one" },
			{ name: "two", path: "/srv/two" },
		],
	},
];

const twoWorkspaces = [
	{ name: "a", projects: [{ name: "one", path: "/srv/one" }] },
	{ name: "b", projects: [{ name: "one", path: "/srv/one" }] },
];

afterEach(async () => {
	vi.useRealTimers();
	await Promise.all(running.splice(0).map((reads) => reads.stop()));
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("Each project is read at start and when requested", () => {
	describe("A readable project", () => {
		it("holds the document the tool printed, and the time of the read", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			for (const name of ["HOME", "XDG_CONFIG_HOME", "PATH"]) {
				vi.stubEnv(name, env[name]);
			}
			for (const name of Object.keys(process.env)) {
				if (name.startsWith("GIT_")) {
					vi.stubEnv(name, undefined);
				}
			}
			const project = join(root, "one");
			buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
			const reads = createReads(
				[{ name: "work", projects: [{ name: "one", path: project }] }],
				{ toolPath: carriedTool, limitMs: 20_000, graceMs: 500 },
			);
			running.push(reads);

			const before = Date.now();
			await reads.refresh("work", "one");

			const state = held(reads);
			expect(state.document).toMatchObject({
				schema_version: 1,
				project: "one",
			});
			expect(time(state.readAt)).toBeGreaterThanOrEqual(before - 1000);
			expect(state.latest).toBeUndefined();
		});
	});

	describe("The server answers during a read", () => {
		it("answers another project's page while one read has not finished", async () => {
			const reads = stubReads("one");
			const port = await serve(reads, oneWorkspace);

			const first = tracked(requestStatus(port, "/work/one"));
			await vi.waitFor(() => {
				expect(reads.calls).toEqual([["work", "one"]]);
			});

			expect(await requestStatus(port, "/work/two")).toBe(200);
			expect(first.settled()).toBe(false);
			reads.release();
		});

		it("answers the list of workspaces while a read has not finished", async () => {
			const reads = stubReads("one");
			const port = await serve(reads, twoWorkspaces);

			const first = tracked(requestStatus(port, "/a/one"));
			await vi.waitFor(() => {
				expect(reads.calls).toEqual([["a", "one"]]);
			});

			expect(await requestStatus(port, "/")).toBe(200);
			expect(first.settled()).toBe(false);
			reads.release();
		});
	});

	describe("A changed project is requested", () => {
		it("holds the new document and a later time of the read", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, noForge);

			scripted.prints({ ...noForge, project: "changed" });
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toMatchObject({ project: "changed" });
			expect(time(state.readAt)).toBeGreaterThan(time(first.readAt));
		});
	});

	describe("Two requests during one read", () => {
		it("starts no second read of a project keeping a document", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			await holding(scripted, fullDocument);
			scripted.fails();
			await scripted.reads.refresh("work", "one");
			const kept = get(scripted.reads);

			scripted.holds();
			const first = tracked(scripted.reads.refresh("work", "one"));
			await waitUntil(() => lines(scripted.log).length === 3);
			const second = tracked(scripted.reads.refresh("work", "one"));
			await delay(200);

			expect(lines(scripted.log)).toHaveLength(3);
			expect(first.settled()).toBe(false);
			expect(second.settled()).toBe(false);
			expect(kept).toMatchObject({ state: "read" });
			expect(get(scripted.reads)).toEqual(kept);

			scripted.releases();
			await waitUntil(() => first.settled() && second.settled());
			expect(lines(scripted.log)).toHaveLength(3);
		});
	});

	describe("Nobody is asking", () => {
		it("starts no read after a failed one, however long passes", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			scripted.prints(fullDocument);
			vi.useFakeTimers({
				toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
				shouldAdvanceTime: true,
			});

			await scripted.reads.start();
			scripted.fails();
			await scripted.reads.refresh("work", "one");
			expect(lines(scripted.log)).toHaveLength(2);
			await vi.advanceTimersByTimeAsync(10 * 60_000);
			await delay(200);

			expect(lines(scripted.log)).toHaveLength(2);
		});
	});

	describe("A refresh of a whole workspace reads every project", () => {
		it("overlaps their reads, the first failing, and settles when both have finished", async () => {
			const root = temporaryDirectory();
			const log = join(root, "read.log");
			const printedFile = join(root, "document.json");
			const armed = join(root, "armed");
			const release = join(root, "release");
			const toolPath = join(root, "stub-tool");
			writeFileSync(printedFile, JSON.stringify(fullDocument));
			// Armed, each read waits for the other to have begun, so reads one at
			// a time leave the first to its limit and a reason other than this one.
			writeFileSync(
				toolPath,
				[
					`echo "$2" >> '${log}'`,
					`if [ -e '${armed}' ]; then`,
					`until [ "$(wc -l < '${log}')" -ge 4 ]; do sleep 0.02; done`,
					`case "$2" in\n*/bad) echo 'Reason: refused' >&2; exit 2 ;;\nesac`,
					`until [ -e '${release}' ]; do sleep 0.02; done`,
					"fi",
					`cat '${printedFile}'`,
				].join("\n"),
				{ mode: 0o644 },
			);
			const reads = board(root, ["bad", "good"], toolPath);
			await reads.refresh("work");
			const before = held(reads, "bad");

			writeFileSync(armed, "");
			const overview = tracked(reads.refresh("work"));
			await waitUntil(
				() => JSON.stringify(get(reads, "bad")) !== JSON.stringify(before),
			);

			expect(lines(log)).toHaveLength(4);
			expect(overview.settled()).toBe(false);
			const state = held(reads, "bad");
			expect(state.document).toEqual(before.document);
			expect(state.latest?.reason).toContain("refused");

			writeFileSync(release, "");
			await waitUntil(() => overview.settled());
			expect(held(reads, "good").latest).toBeUndefined();
		});
	});

	describe("A request that names no project to read", () => {
		it("starts no read for a refused Host", async () => {
			const reads = stubReads();
			const port = await serve(reads, oneWorkspace);

			const status = await requestStatus(port, "/work/one", {
				Host: "evil.example",
			});

			expect(status).toBe(403);
			expect(reads.calls).toEqual([]);
		});

		it("starts no read for an address answered 404", async () => {
			const reads = stubReads();
			const port = await serve(reads, oneWorkspace);

			expect(await requestStatus(port, "/work/nothing")).toBe(404);
			expect(reads.calls).toEqual([]);
		});

		it("starts no read for the list of workspaces", async () => {
			const reads = stubReads();
			const port = await serve(reads, twoWorkspaces);

			expect(await requestStatus(port, "/")).toBe(200);
			expect(reads.calls).toEqual([]);
		});
	});

	describe("A project is failed only where it holds no document", () => {
		it("is failed, with the reason, where a read fails with no document held", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			scripted.fails();

			await scripted.reads.refresh("work", "one");

			expect(get(scripted.reads)).toMatchObject({ state: "failed" });
			expect((get(scripted.reads) as { reason: string }).reason).toContain(
				"refused",
			);
		});

		it("keeps what it held until the next read finishes", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, fullDocument);

			scripted.fails();
			scripted.holds();
			const request = scripted.reads.refresh("work", "one");
			await waitUntil(() => lines(scripted.log).length === 2);

			expect(get(scripted.reads)).toEqual(first);

			scripted.releases();
			await request;
			expect(held(scripted.reads).document).toEqual(first.document);
		});
	});
});

describe("A read does not replace a better document", () => {
	describe("A failure after a read", () => {
		it("holds the same document and its time, with the failed read's time and reason", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, fullDocument);

			scripted.fails();
			const before = Date.now();
			await expect(
				scripted.reads.refresh("work", "one"),
			).resolves.toBeUndefined();
			const after = Date.now();

			const state = held(scripted.reads);
			expect(state.document).toEqual(first.document);
			expect(state.readAt).toEqual(first.readAt);
			expect(state.latest?.reason).toContain("refused");
			expect(time(state.latest?.at)).toBeGreaterThanOrEqual(before - 1000);
			expect(time(state.latest?.at)).toBeLessThanOrEqual(after + 1000);
			expect(time(state.latest?.at)).toBeGreaterThan(time(first.readAt));
		});
	});

	describe("An unknown schema after a read", () => {
		it("holds the same document, and the reason names version 2", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, fullDocument);

			scripted.prints({ ...fullDocument, schema_version: 2 });
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toEqual(first.document);
			expect(state.latest?.reason).toMatch(/\b2\b/);
		});
	});

	describe("A degraded read after a full one", () => {
		it("holds the same document, with the degraded read's time and what it missed", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, fullDocument);

			scripted.prints(noForge);
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toEqual(first.document);
			expect(state.readAt).toEqual(first.readAt);
			expect(time(state.latest?.at)).toBeGreaterThan(time(first.readAt));
			expect(state.latest?.missed).toEqual(missedBy(noForge));
			expect(state.latest?.reason).toBeUndefined();
		});

		it.each([
			["partly", { forge: "partly" }],
			["missing", { forge: undefined }],
		])("treats a forge that is %s as degraded", async (_name, fields) => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, fullDocument);

			scripted.prints({ ...fullDocument, project: "degraded", ...fields });
			await scripted.reads.refresh("work", "one");

			expect(held(scripted.reads).document).toEqual(first.document);
		});
	});

	describe("A degraded read with no full document", () => {
		it("holds the new document", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, noForge);

			scripted.prints({ ...noForge, project: "newer" });
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toMatchObject({ project: "newer" });
			expect(time(state.readAt)).toBeGreaterThan(time(first.readAt));
			expect(state.latest).toBeUndefined();
		});

		it("replaces a document with no forge at all", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			await holding(scripted, { ...fullDocument, forge: undefined });

			scripted.prints({ ...noForge, project: "newer" });
			await scripted.reads.refresh("work", "one");

			expect(held(scripted.reads).document).toMatchObject({ project: "newer" });
		});
	});

	describe("A failure after a degraded read", () => {
		it("holds the same document, with the failed read's reason", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, noForge);

			scripted.fails();
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toEqual(first.document);
			expect(state.latest?.reason).toContain("refused");
		});
	});

	describe("A full read with a failed fetch", () => {
		it("holds the new document", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			await holding(scripted, fullDocument);

			scripted.prints({
				...fullDocument,
				project: "failed-fetch",
				trunk: { ...fullDocument.trunk, state: "fetch_failed" },
				remote_branches_read: false,
			});
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toMatchObject({ project: "failed-fetch" });
			expect(state.latest).toBeUndefined();
		});
	});

	describe("A full read after a kept document", () => {
		it("holds the new document, with no failed read's reason", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			await holding(scripted, fullDocument);
			scripted.fails();
			await scripted.reads.refresh("work", "one");
			expect(held(scripted.reads).latest?.reason).toContain("refused");

			scripted.recovers();
			scripted.prints({ ...fullDocument, project: "recovered" });
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toMatchObject({ project: "recovered" });
			expect(state.latest).toBeUndefined();
		});
	});

	describe("A network outage", () => {
		it("holds the same document, and what the read missed names all three", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, fullDocument);

			scripted.prints(outage);
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toEqual(first.document);
			const missed = state.latest?.missed ?? [];
			expect(missed).toHaveLength(3);
			expect(missed.join("\n")).toMatch(/statuses may be wrong/i);
			expect(missed.join("\n")).toMatch(/may be stale/i);
			expect(missed.join("\n")).toMatch(/remote branches (were )?not read/i);
		});
	});

	describe("The latest read", () => {
		it("is what the project holds, until a read replaces the document", async () => {
			const scripted = scriptedBoard(temporaryDirectory());
			const first = await holding(scripted, fullDocument);
			scripted.prints(noForge);
			await scripted.reads.refresh("work", "one");
			const degraded = held(scripted.reads);
			await delay(5);

			scripted.fails();
			await scripted.reads.refresh("work", "one");

			const state = held(scripted.reads);
			expect(state.document).toEqual(first.document);
			expect(state.readAt).toEqual(first.readAt);
			expect(state.latest?.reason).toContain("refused");
			expect(state.latest?.missed).toBeUndefined();
			expect(time(state.latest?.at)).toBeGreaterThan(time(degraded.latest?.at));
		});
	});

	describe("What a document missed", () => {
		it("is nothing for a full, fetched document with remote branches read", () => {
			expect(missedBy(fullDocument)).toEqual([]);
		});

		it.each([
			["none", { forge: "none" }],
			["missing", { forge: undefined }],
		])("is the forge line where forge is %s", (_name, fields) => {
			const missed = missedBy({ ...fullDocument, ...fields });

			expect(missed).toHaveLength(1);
			expect(missed[0]).toMatch(/statuses may be wrong/i);
		});

		it("is a line each for a failed fetch and unread remote branches", () => {
			const missed = missedBy({
				...fullDocument,
				trunk: { ...fullDocument.trunk, state: "fetch_failed" },
				remote_branches_read: false,
			});

			expect(missed).toHaveLength(2);
			expect(missed.join("\n")).toMatch(/may be stale/i);
			expect(missed.join("\n")).toMatch(/remote branches (were )?not read/i);
			expect(missed.join("\n")).not.toMatch(/statuses may be wrong/i);
		});

		it("says there is no remote, which branch was read, and that remote branches were not", () => {
			const missed = missedBy({
				...fullDocument,
				trunk: { ...fullDocument.trunk, branch: "work", state: "no_origin" },
				remote_branches_read: false,
			});

			expect(missed).toHaveLength(2);
			expect(missed.join("\n")).toMatch(/no remote named origin/i);
			expect(missed.join("\n")).toMatch(/\bwork\b/);
			expect(missed.join("\n")).toMatch(/remote branches (were )?not read/i);
		});
	});
});
