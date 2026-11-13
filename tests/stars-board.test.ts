// Tests derived from the delta spec of `star-workstreams`
// (openspec/changes/star-workstreams/specs/workstream-stars/spec.md), run
// against the built command as tests/board.test.ts runs it. Each assertion's
// classification is in that change's test-plan.md.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildFixtureRepository,
	isolatedEnvironment,
} from "./support/fixture.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 30_000 });

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement". Each follows its namesake in tests/board.test.ts.

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const builtCommand = join(repositoryRoot, "dist", "cli.js");

type Board = {
	child: ChildProcess;
	stdout(): string;
	stderr(): string;
	exited: Promise<{ code: number | null; signal: string | null }>;
};

const boards: Board[] = [];

// A machine with one valid project, its own state directory, and no
// XDG_STATE_HOME inherited from the machine running the tests.
function machine(state: "set" | "unset" | "empty" = "set") {
	const root = temporaryDirectory();
	const env = isolatedEnvironment(root);
	const project = join(root, "one");
	buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
	const settings = join(String(env.XDG_CONFIG_HOME), "dev-task-board");
	mkdirSync(settings, { recursive: true });
	writeFileSync(
		join(settings, "config.toml"),
		`[workspaces.work]\nprojects = ${JSON.stringify([project])}\n`,
	);
	if (state === "set") {
		env.XDG_STATE_HOME = join(root, "state");
	} else if (state === "empty") {
		env.XDG_STATE_HOME = "";
	} else {
		delete env.XDG_STATE_HOME;
	}
	const fromEnvironment = join(root, "state", "dev-task-board", "stars.json");
	const byDefault = join(
		String(env.HOME),
		".local",
		"state",
		"dev-task-board",
		"stars.json",
	);
	return {
		env,
		starsFile: state === "set" ? fromEnvironment : byDefault,
		fromEnvironment,
		byDefault,
	};
}

function write(path: string, text: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, text);
}

function run(args: string[], env: NodeJS.ProcessEnv) {
	return spawnSync(process.execPath, [builtCommand, ...args], {
		cwd: String(env.HOME),
		env,
		encoding: "utf8",
		timeout: 15_000,
		killSignal: "SIGKILL",
	});
}

function start(args: string[], env: NodeJS.ProcessEnv): Board {
	const child = spawn(process.execPath, [builtCommand, ...args], {
		cwd: String(env.HOME),
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let stdout = "";
	let stderr = "";
	child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
		stdout += chunk;
	});
	child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
		stderr += chunk;
	});
	const board: Board = {
		child,
		stdout: () => stdout,
		stderr: () => stderr,
		exited: new Promise((resolve) => {
			child.on("exit", (code, signal) => {
				resolve({ code, signal });
			});
		}),
	};
	boards.push(board);
	return board;
}

async function waitUntil(condition: () => boolean, ms = 10_000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error("timed out waiting");
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

async function listening(board: Board, port: number): Promise<void> {
	const exited = board.exited.then(({ code, signal }) => {
		throw new Error(
			`the command exited (${code ?? signal}) before listening: ${board.stderr()}`,
		);
	});
	await Promise.race([
		waitUntil(() => board.stdout().includes(`127.0.0.1:${port}`)),
		exited,
	]);
}

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			server.close(() => {
				if (address === null || typeof address === "string") {
					reject(new Error("no port"));
				} else {
					resolve(address.port);
				}
			});
		});
	});
}

function get(port: number, path: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}` },
				agent: false,
				timeout: 15_000,
			},
			(response) => {
				response.resume();
				response.on("end", () => {
					resolve(response.statusCode ?? 0);
				});
			},
		);
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no answer for ${path}`));
		});
		outgoing.on("error", reject);
		outgoing.end();
	});
}

function expectRefused(result: ReturnType<typeof run>): void {
	expect(result.error).toBeUndefined();
	expect(result.status).not.toBe(0);
	expect(result.status).not.toBeNull();
	expect(result.stdout).toBe("");
	expect(result.stderr).not.toMatch(/^\s+at /m);
}

async function starts(env: NodeJS.ProcessEnv): Promise<void> {
	const port = await freePort();
	const board = start(["--port", String(port)], env);
	await listening(board, port);
	expect(await get(port, "/")).toBe(200);
}

async function refusesStart(env: NodeJS.ProcessEnv) {
	const result = run(["--port", String(await freePort())], env);
	expectRefused(result);
	return result;
}

afterEach(async () => {
	for (const board of boards.splice(0)) {
		if (board.child.exitCode === null && board.child.signalCode === null) {
			board.child.kill("SIGTERM");
			const killed = setTimeout(() => {
				board.child.kill("SIGKILL");
			}, 8000);
			await board.exited;
			clearTimeout(killed);
		}
	}
	removeTemporaryDirectories();
});

describe("Stars are kept on this machine", () => {
	describe("No file", () => {
		it("starts with no stars file", async () => {
			const { env } = machine();

			await starts(env);
		});
	});

	describe("The state directory from the environment", () => {
		it("reads the stars file under XDG_STATE_HOME: a bad one there refuses the start", async () => {
			const { env, fromEnvironment } = machine("set");
			write(fromEnvironment, "{not json");

			const result = await refusesStart(env);

			expect(result.stderr).toContain(fromEnvironment);
		});

		it("does not read ~/.local/state where XDG_STATE_HOME is set", async () => {
			const { env, byDefault } = machine("set");
			write(byDefault, "{not json");

			await starts(env);
		});

		it.each(["unset", "empty"] as const)(
			"reads ~/.local/state/dev-task-board/stars.json where XDG_STATE_HOME is %s",
			async (state) => {
				const { env, byDefault } = machine(state);
				write(byDefault, "{not json");

				const result = await refusesStart(env);

				expect(result.stderr).toContain(byDefault);
			},
		);
	});
});

describe("A bad stars file refuses the start", () => {
	describe("Not JSON", () => {
		it("exits non-zero naming the file, and leaves the file unchanged", async () => {
			const { env, starsFile } = machine();
			write(starsFile, "{not json");

			const result = await refusesStart(env);

			expect(result.stderr).toContain(starsFile);
			expect(readFileSync(starsFile, "utf8")).toBe("{not json");
		});
	});

	describe("Not a list of names", () => {
		it('exits non-zero naming the file for {"/p/one": "alpha"}', async () => {
			const { env, starsFile } = machine();
			const text = JSON.stringify({ version: 1, stars: { "/p/one": "alpha" } });
			write(starsFile, text);

			const result = await refusesStart(env);

			expect(result.stderr).toContain(starsFile);
			expect(readFileSync(starsFile, "utf8")).toBe(text);
		});
	});

	describe("Another version", () => {
		it("exits non-zero naming the file and version 2", async () => {
			const { env, starsFile } = machine();
			write(starsFile, JSON.stringify({ version: 2, stars: {} }));

			const result = await refusesStart(env);

			expect(result.stderr).toContain(starsFile);
			const rest = result.stderr.split(starsFile).join(" ");
			expect(rest).toMatch(/version/i);
			expect(rest).toMatch(/\b2\b/);
		});
	});

	describe("A hand edit out of order", () => {
		it("starts with repeated, unordered names and an empty list", async () => {
			const { env, starsFile } = machine();
			write(
				starsFile,
				JSON.stringify({
					version: 1,
					stars: { "/p/one": ["beta", "alpha", "beta"], "/p/two": [] },
				}),
			);

			await starts(env);
		});
	});
});
