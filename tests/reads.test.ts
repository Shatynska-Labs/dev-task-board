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

const spawnedPids: number[] = [];

function stubTool(directory: string, body: string): string {
	const path = join(directory, "stub-tool");
	// Neither executable nor with a shebang: only `bash <path>` can run it.
	writeFileSync(path, `${body}\n`, { mode: 0o644 });
	return path;
}

function printsDocument(directory: string, document: unknown): string {
	const path = join(directory, "document.json");
	writeFileSync(path, JSON.stringify(document));
	return stubTool(directory, `cat '${path}'`);
}

function projects(directory: string, ...names: string[]) {
	return names.map((name) => {
		const path = join(directory, name);
		mkdirSync(path);
		return { name, path };
	});
}

function oneProject(directory: string) {
	return [{ name: "work", projects: projects(directory, "one") }];
}

function get(
	reads: { get(workspace: string, project: string): unknown },
	project = "one",
): ProjectState {
	return reads.get("work", project) as ProjectState;
}

function failureReason(state: ProjectState): string {
	if (state.state !== "failed") {
		throw new Error(`expected a failed read, got ${JSON.stringify(state)}`);
	}
	return state.reason;
}

async function waitUntil(condition: () => boolean, ms = 5000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error("timed out waiting");
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

function readPid(path: string): number {
	const pid = Number(readFileSync(path, "utf8").trim());
	// Signalling pid 0 would reach this test run's own process group.
	if (!Number.isInteger(pid) || pid <= 1) {
		throw new Error(`no pid in ${path}`);
	}
	spawnedPids.push(pid);
	return pid;
}

function holdsPid(path: string): boolean {
	return existsSync(path) && readFileSync(path, "utf8").trim() !== "";
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

afterEach(() => {
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

describe("Each project is read once at start", () => {
	describe("A readable project", () => {
		it("holds the document the carried tool printed, and the time of the read", async () => {
			const root = temporaryDirectory();
			const env = useIsolatedProcessEnvironment(root);
			const project = join(root, "one");
			buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
			const reads = createReads(
				[{ name: "work", projects: [{ name: "one", path: project }] }],
				{ toolPath: carriedTool, limitMs: 20_000, graceMs: 500 },
			);

			const before = Date.now();
			await reads.start();
			const after = Date.now();

			const state = get(reads);
			if (state.state !== "read") {
				throw new Error(`expected a read, got ${JSON.stringify(state)}`);
			}
			expect(state.document).toMatchObject({
				schema_version: 1,
				project: "one",
				tasks: [],
			});
			const readAt = new Date(state.readAt as string).getTime();
			expect(readAt).toBeGreaterThanOrEqual(before - 1000);
			expect(readAt).toBeLessThanOrEqual(after + 1000);
		});

		it("holds exactly what the tool printed", async () => {
			const root = temporaryDirectory();
			const document = { ...minimalDocument, project: "printed" };
			const reads = createReads(oneProject(root), {
				toolPath: printsDocument(root, document),
				limitMs: 10_000,
				graceMs: 200,
			});

			await reads.start();

			expect(get(reads)).toMatchObject({ state: "read", document });
		});

		it("holds a document larger than a pipe's buffer whole", async () => {
			const root = temporaryDirectory();
			const document = {
				...minimalDocument,
				tasks: Array.from({ length: 5000 }, (_, index) => ({
					name: `task-${index}`,
					status: "recorded",
					body: "x".repeat(100),
				})),
			};
			const reads = createReads(oneProject(root), {
				toolPath: printsDocument(root, document),
				limitMs: 10_000,
				graceMs: 200,
			});

			await reads.start();

			expect(get(reads)).toMatchObject({ state: "read", document });
		});

		it("runs the tool through bash with --json and the project's path", async () => {
			const root = temporaryDirectory();
			const log = join(root, "arguments.log");
			const workspaces = oneProject(root);
			const reads = createReads(workspaces, {
				toolPath: stubTool(
					root,
					`printf '%s\\n' "$@" > '${log}'\necho '${JSON.stringify(minimalDocument)}'`,
				),
				limitMs: 10_000,
				graceMs: 200,
			});

			await reads.start();

			expect(readFileSync(log, "utf8").trim().split("\n")).toEqual([
				"--json",
				join(root, "one"),
			]);
		});

		it("reads one project at a time per workspace, each once", async () => {
			const root = temporaryDirectory();
			const log = join(root, "order.log");
			const reads = createReads(
				[{ name: "work", projects: projects(root, "one", "two") }],
				{
					toolPath: stubTool(
						root,
						[
							`echo "start \${2##*/}" >> '${log}'`,
							"sleep 0.1",
							`echo "end \${2##*/}" >> '${log}'`,
							`echo '${JSON.stringify(minimalDocument)}'`,
						].join("\n"),
					),
					limitMs: 10_000,
					graceMs: 200,
				},
			);

			await reads.start();

			expect(readFileSync(log, "utf8").trim().split("\n")).toEqual([
				"start one",
				"end one",
				"start two",
				"end two",
			]);
		});
	});

	describe("The server answers during a read", () => {
		it("holds a read that has not finished, and a project waiting, as being read", async () => {
			const root = temporaryDirectory();
			const release = join(root, "release");
			const reads = createReads(
				[{ name: "work", projects: projects(root, "one", "two") }],
				{
					toolPath: stubTool(
						root,
						`until [ -e '${release}' ]; do sleep 0.02; done\necho '${JSON.stringify(minimalDocument)}'`,
					),
					limitMs: 10_000,
					graceMs: 200,
				},
			);

			const finished = reads.start();

			expect(get(reads, "one")).toEqual({ state: "reading" });
			expect(get(reads, "two")).toEqual({ state: "reading" });

			writeFileSync(release, "");
			await finished;

			expect(get(reads, "one").state).toBe("read");
			expect(get(reads, "two").state).toBe("read");
		});
	});
});

describe("A failed read has a reason", () => {
	function failingWith(root: string, body: string) {
		return createReads(oneProject(root), {
			toolPath: stubTool(root, body),
			limitMs: 10_000,
			graceMs: 200,
		});
	}

	describe("The tool refuses", () => {
		it("has failed, with the carried tool's Reason: line as its reason", async () => {
			const root = temporaryDirectory();
			const env = useIsolatedProcessEnvironment(root);
			const project = join(root, "one");
			buildFixtureRepository(project, env, "README.md");
			const report = spawnSync("bash", [carriedTool, "--json", project], {
				env,
				encoding: "utf8",
			});
			const line = report.stderr
				.split("\n")
				.find((text) => text.startsWith("Reason:"));
			if (line === undefined) {
				throw new Error(`the tool gave no Reason: line: ${report.stderr}`);
			}
			const reads = createReads(
				[{ name: "work", projects: [{ name: "one", path: project }] }],
				{ toolPath: carriedTool, limitMs: 20_000, graceMs: 500 },
			);

			await reads.start();

			const reason = failureReason(get(reads));
			expect(reason).toContain(line.slice("Reason:".length).trim());
			expect(reason).not.toContain("Outcome:");
		});

		it("keeps the Reason: line where other lines follow it", async () => {
			const root = temporaryDirectory();
			const reads = failingWith(
				root,
				"echo 'Target: x' >&2\necho 'Reason: the stated reason' >&2\necho 'Outcome: BLOCKED' >&2\nexit 2",
			);

			await reads.start();

			const reason = failureReason(get(reads));
			expect(reason).toContain("the stated reason");
			expect(reason).not.toContain("BLOCKED");
		});

		it("keeps the last line of standard error where no line is a Reason:", async () => {
			const root = temporaryDirectory();
			const reads = failingWith(
				root,
				"echo 'first line' >&2\necho 'last line' >&2\nexit 1",
			);

			await reads.start();

			const reason = failureReason(get(reads));
			expect(reason).toContain("last line");
			expect(reason).not.toContain("first line");
		});
	});

	describe("A failure with nothing on standard error", () => {
		it("names the exit code", async () => {
			const root = temporaryDirectory();
			const reads = failingWith(root, "exit 37");

			await reads.start();

			expect(failureReason(get(reads))).toMatch(/\b37\b/);
		});

		it("names the signal", async () => {
			const root = temporaryDirectory();
			const reads = failingWith(root, "kill -KILL $$");

			await reads.start();

			expect(failureReason(get(reads))).toContain("SIGKILL");
		});
	});

	describe("An unknown schema", () => {
		it("has failed, naming version 2", async () => {
			const root = temporaryDirectory();
			const reads = createReads(oneProject(root), {
				toolPath: printsDocument(root, {
					...minimalDocument,
					schema_version: 2,
				}),
				limitMs: 10_000,
				graceMs: 200,
			});

			await reads.start();

			expect(failureReason(get(reads))).toMatch(/\b2\b/);
		});

		it.each([
			["no schema_version", '{"tasks":[]}'],
			["a string schema_version", '{"schema_version":"1"}'],
			["null", "null"],
		])("has failed on a document with %s", async (_name, printed) => {
			const root = temporaryDirectory();
			const reads = failingWith(root, `echo '${printed}'`);

			await reads.start();

			expect(get(reads).state).toBe("failed");
		});
	});

	describe("A read past its limit", () => {
		it("stops the tool and its child, and fails with that reason", async () => {
			const root = temporaryDirectory();
			const toolPid = join(root, "tool.pid");
			const childPid = join(root, "child.pid");
			const reads = createReads(oneProject(root), {
				toolPath: stubTool(
					root,
					`echo $$ > '${toolPid}'\nsleep 60 &\necho $! > '${childPid}'\nwait`,
				),
				limitMs: 500,
				graceMs: 200,
			});

			await reads.start();

			const reason = failureReason(get(reads));
			expect(reason).toMatch(/limit|timed? ?out/i);
			await waitUntil(
				() => !isRunning(readPid(toolPid)) && !isRunning(readPid(childPid)),
			);
		});

		it("sends SIGKILL after the grace to what ignores SIGTERM", async () => {
			const root = temporaryDirectory();
			const toolPid = join(root, "tool.pid");
			const limitMs = 500;
			const graceMs = 300;
			const reads = createReads(oneProject(root), {
				toolPath: stubTool(
					root,
					`trap '' TERM\necho $$ > '${toolPid}'\nwhile :; do sleep 0.05; done`,
				),
				limitMs,
				graceMs,
			});

			const before = Date.now();
			await reads.start();
			const elapsed = Date.now() - before;

			expect(get(reads).state).toBe("failed");
			expect(elapsed).toBeGreaterThanOrEqual(limitMs + graceMs - 50);
			await waitUntil(() => !isRunning(readPid(toolPid)));
		});

		it("kills a child that outlives the tool and ignores SIGTERM", async () => {
			const root = temporaryDirectory();
			const childPid = join(root, "child.pid");
			const reads = createReads(oneProject(root), {
				toolPath: stubTool(
					root,
					[
						`sh -c 'trap "" TERM; echo $$ > "${childPid}"; exec sleep 60' &`,
						`until [ -s '${childPid}' ]; do sleep 0.01; done`,
						"wait",
					].join("\n"),
				),
				limitMs: 500,
				graceMs: 200,
			});

			await reads.start();

			await waitUntil(() => !isRunning(readPid(childPid)));
			expect(get(reads).state).toBe("failed");
		});
	});

	describe("A process that left the group and holds the pipes", () => {
		function holdingTool(root: string, pidFile: string, then: string) {
			return stubTool(
				root,
				[
					`perl -MPOSIX -e 'POSIX::setsid(); open(F, ">", "${pidFile}"); print F $$; close(F); sleep 30' &`,
					`until [ -s '${pidFile}' ]; do sleep 0.01; done`,
					then,
				].join("\n"),
			);
		}

		it("holds the document without waiting for it", async () => {
			const root = temporaryDirectory();
			const holder = join(root, "holder.pid");
			const reads = createReads(oneProject(root), {
				toolPath: holdingTool(
					root,
					holder,
					`echo '${JSON.stringify(minimalDocument)}'`,
				),
				limitMs: 10_000,
				graceMs: 200,
			});

			const before = Date.now();
			await reads.start();
			readPid(holder);

			expect(get(reads).state).toBe("read");
			expect(Date.now() - before).toBeLessThan(5000);
		});

		it("does not hold stop() past the grace", async () => {
			const root = temporaryDirectory();
			const holder = join(root, "holder.pid");
			const toolPid = join(root, "tool.pid");
			const reads = createReads(oneProject(root), {
				toolPath: holdingTool(
					root,
					holder,
					`echo $$ > '${toolPid}'\nexec sleep 60`,
				),
				limitMs: 20_000,
				graceMs: 200,
			});

			const finished = reads.start();
			await waitUntil(() => holdsPid(toolPid));
			readPid(holder);
			const before = Date.now();
			await reads.stop();
			await finished;

			expect(Date.now() - before).toBeLessThan(5000);
		});
	});

	describe("A tool that exits zero with bad output", () => {
		it("has failed, saying the output could not be read", async () => {
			const root = temporaryDirectory();
			const reads = failingWith(root, "echo 'this is not JSON'");

			await reads.start();

			expect(failureReason(get(reads))).toMatch(/could not be read/i);
		});

		it("has failed on two documents, which are not one", async () => {
			const root = temporaryDirectory();
			const text = JSON.stringify(minimalDocument);
			const reads = failingWith(root, `echo '${text}'\necho '${text}'`);

			await reads.start();

			expect(failureReason(get(reads))).toMatch(/could not be read/i);
		});
	});

	describe("One failure among several", () => {
		it("still reads the second project", async () => {
			const root = temporaryDirectory();
			const reads = createReads(
				[{ name: "work", projects: projects(root, "bad", "good") }],
				{
					toolPath: stubTool(
						root,
						`case "$2" in\n*/bad) echo 'Reason: refused' >&2; exit 2 ;;\nesac\necho '${JSON.stringify(minimalDocument)}'`,
					),
					limitMs: 10_000,
					graceMs: 200,
				},
			);

			await reads.start();

			expect(get(reads, "bad").state).toBe("failed");
			expect(get(reads, "good").state).toBe("read");
		});
	});
});

describe("Stopping the board stops its reads", () => {
	describe("Stopped during a read", () => {
		it("stop() settles with the tool and its child gone", async () => {
			const root = temporaryDirectory();
			const toolPid = join(root, "tool.pid");
			const childPid = join(root, "child.pid");
			const reads = createReads(oneProject(root), {
				toolPath: stubTool(
					root,
					`sleep 60 &\necho $! > '${childPid}'\necho $$ > '${toolPid}'\nwait`,
				),
				limitMs: 20_000,
				graceMs: 200,
			});

			const finished = reads.start();
			await waitUntil(() => holdsPid(toolPid));
			await reads.stop();
			await finished;

			await waitUntil(
				() => !isRunning(readPid(toolPid)) && !isRunning(readPid(childPid)),
			);
		});

		it("stop() uses the grace for what ignores SIGTERM", async () => {
			const root = temporaryDirectory();
			const toolPid = join(root, "tool.pid");
			const graceMs = 300;
			const reads = createReads(oneProject(root), {
				toolPath: stubTool(
					root,
					`trap '' TERM\necho $$ > '${toolPid}'\nwhile :; do sleep 0.05; done`,
				),
				limitMs: 20_000,
				graceMs,
			});

			const finished = reads.start();
			await waitUntil(() => holdsPid(toolPid));
			const before = Date.now();
			await reads.stop();
			await finished;

			expect(Date.now() - before).toBeGreaterThanOrEqual(graceMs - 50);
			await waitUntil(() => !isRunning(readPid(toolPid)));
		});
	});

	describe("Stopped with a project waiting", () => {
		it("never reads the second project", async () => {
			const root = temporaryDirectory();
			const log = join(root, "read.log");
			const toolPid = join(root, "tool.pid");
			const reads = createReads(
				[{ name: "work", projects: projects(root, "one", "two") }],
				{
					toolPath: stubTool(
						root,
						`echo "$2" >> '${log}'\necho $$ > '${toolPid}'\nexec sleep 60`,
					),
					limitMs: 20_000,
					graceMs: 200,
				},
			);

			const finished = reads.start();
			await waitUntil(() => holdsPid(toolPid));
			readPid(toolPid);
			await reads.stop();
			await finished;

			expect(readFileSync(log, "utf8").trim().split("\n")).toEqual([
				join(root, "one"),
			]);
		});
	});
});
