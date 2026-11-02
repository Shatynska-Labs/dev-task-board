import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildFixtureRepository,
	git,
	isolatedEnvironment,
} from "./support/fixture.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 30_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const builtCommand = join(repositoryRoot, "dist", "cli.js");

type Board = {
	child: ChildProcess;
	stdout(): string;
	stderr(): string;
	exited: Promise<{ code: number | null; signal: string | null }>;
};

const boards: Board[] = [];
const servers: Server[] = [];
const ghPidFiles: string[] = [];

function settingsFile(env: NodeJS.ProcessEnv): string {
	return join(String(env.XDG_CONFIG_HOME), "dev-task-board", "config.toml");
}

function writeSettings(env: NodeJS.ProcessEnv, text: string): void {
	mkdirSync(join(String(env.XDG_CONFIG_HOME), "dev-task-board"), {
		recursive: true,
	});
	writeFileSync(settingsFile(env), text);
}

function workspaceWith(...projects: string[]): string {
	return `[workspaces.work]\nprojects = ${JSON.stringify(projects)}\n`;
}

function fixtureProject(
	root: string,
	env: NodeJS.ProcessEnv,
	name: string,
): string {
	const path = join(root, name);
	buildFixtureRepository(path, env, "docs/backlog/AGENTS.md");
	return path;
}

function validEnvironment() {
	const root = temporaryDirectory();
	const env = isolatedEnvironment(root);
	const project = fixtureProject(root, env, "one");
	writeSettings(env, workspaceWith(project));
	return { root, env, project };
}

// The tool waits on gh, so a gh that does not finish holds a read open. It logs
// the project it was asked in and its pid, and exec keeps that pid the sleeper's.
function slowGh(root: string): { log: string; pids: string } {
	const log = join(root, "gh.log");
	const pids = join(root, "gh.pids");
	ghPidFiles.push(pids);
	writeFileSync(
		join(root, "stubs", "gh"),
		`#!/bin/sh\necho "$PWD" >> '${log}'\necho $$ >> '${pids}'\nexec sleep 60\n`,
		{ mode: 0o755 },
	);
	return { log, pids };
}

function lines(path: string): string[] {
	return existsSync(path)
		? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
		: [];
}

function pidsIn(path: string): number[] {
	return lines(path)
		.map(Number)
		.filter((pid) => Number.isInteger(pid) && pid > 1);
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

function occupy(port: number): Promise<Server> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(port, "127.0.0.1", () => {
			servers.push(server);
			resolve(server);
		});
	});
}

function close(server: Server): Promise<void> {
	return new Promise((resolve) => {
		server.close(() => {
			resolve();
		});
	});
}

async function freePort(): Promise<number> {
	const server = await occupy(0);
	const address = server.address();
	await close(server);
	if (address === null || typeof address === "string") {
		throw new Error("no port");
	}
	return address.port;
}

async function isFree(port: number): Promise<boolean> {
	try {
		await close(await occupy(port));
		return true;
	} catch {
		return false;
	}
}

function get(
	port: number,
	path: string,
): Promise<{ status: number; body: string }> {
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
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					body += chunk;
				});
				response.on("end", () => {
					resolve({ status: response.statusCode ?? 0, body });
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

// A zombie answers kill(pid, 0), so ask ps what state the process is in.
function isRunning(pid: number): boolean {
	const { stdout } = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], {
		encoding: "utf8",
	});
	const state = stdout.trim();
	return state !== "" && !state.startsWith("Z");
}

function expectRefused(result: ReturnType<typeof run>): void {
	expect(result.error).toBeUndefined();
	expect(result.status).not.toBe(0);
	expect(result.status).not.toBeNull();
	expect(result.stdout).toBe("");
	expect(result.stderr).not.toMatch(/^\s+at /m);
}

afterEach(async () => {
	for (const server of servers.splice(0)) {
		if (server.listening) {
			await close(server);
		}
	}
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
	for (const path of ghPidFiles.splice(0)) {
		for (const pid of pidsIn(path)) {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// Already gone, as a passing test leaves it.
			}
		}
	}
	removeTemporaryDirectories();
});

describe("The command reports its version or starts the board", () => {
	describe("Asked for its version", () => {
		it("prints the version in package.json and exits zero", () => {
			const { version } = JSON.parse(
				readFileSync(join(repositoryRoot, "package.json"), "utf8"),
			) as { version: string };
			const { env } = validEnvironment();

			const result = run(["--version"], env);

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe(version);
		});
	});

	describe("Starting", () => {
		it("prints its address, and the address answers", async () => {
			const { env } = validEnvironment();
			const port = await freePort();

			const board = start(["--port", String(port)], env);
			await listening(board, port);

			expect((await get(port, "/")).status).toBe(200);
		});

		it("starts on 8766 with no arguments", async (context) => {
			if (!(await isFree(8766))) {
				context.skip();
			}
			const { env } = validEnvironment();

			const board = start([], env);
			await listening(board, 8766);

			expect((await get(8766, "/")).status).toBe(200);
		});

		it("shows a project's tasks once its read has finished", async () => {
			const { root, env } = validEnvironment();
			const project = join(root, "one");
			writeFileSync(join(project, "docs", "backlog", "an-entry.md"), "# x\n");
			git(project, env, "add", ".");
			git(
				project,
				env,
				"-c",
				"user.name=Fixture",
				"-c",
				"user.email=fixture@example.invalid",
				"-c",
				"commit.gpgsign=false",
				"commit",
				"--quiet",
				"-m",
				"entry",
			);
			const port = await freePort();

			const board = start(["--port", String(port)], env);
			await listening(board, port);

			let body = "";
			const deadline = Date.now() + 15_000;
			while (!body.includes("an-entry") && Date.now() < deadline) {
				body = (await get(port, "/work/one")).body;
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			expect(body).toContain("an-entry");
		});
	});

	describe("An unknown argument", () => {
		it.each([
			["an unknown option", ["--unknown"]],
			["an unknown word", ["serve"]],
			["--port with no number", ["--port"]],
			["--port 80", ["--port", "80"]],
			["--port 70000", ["--port", "70000"]],
			["--port 1023", ["--port", "1023"]],
			["--port 65536", ["--port", "65536"]],
			["--port with a word", ["--port", "many"]],
			["--port with a fraction", ["--port", "8766.5"]],
			["--port with something after it", ["--port", "8766", "serve"]],
		])("refuses %s, with valid settings present", (_name, args) => {
			const { env } = validEnvironment();

			const result = run(args, env);

			expectRefused(result);
			expect(result.stderr.trim()).not.toBe("");
		});
	});
});

describe("The server is local and refuses other hosts", () => {
	describe("A port in use", () => {
		it("exits non-zero, naming the port", async () => {
			const { env } = validEnvironment();
			const port = await freePort();
			await occupy(port);

			const board = start(["--port", String(port)], env);
			const { code } = await board.exited;

			expect(code).not.toBe(0);
			expect(code).not.toBeNull();
			expect(board.stderr()).toContain(String(port));
			expect(board.stdout()).toBe("");
		});
	});
});

describe("Bad settings refuse the start", () => {
	describe("Missing file", () => {
		it("exits non-zero, naming the path, the table and projects", () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);

			const result = run([], env);

			expectRefused(result);
			expect(result.stderr).toContain(settingsFile(env));
			expect(result.stderr).toContain("[workspaces.<name>]");
			expect(result.stderr).toContain("projects");
		});

		it.each([
			["unset", undefined],
			["empty", ""],
		])("looks under ~/.config where XDG_CONFIG_HOME is %s", (_name, value) => {
			const root = temporaryDirectory();
			const env: NodeJS.ProcessEnv = {
				...isolatedEnvironment(root),
				XDG_CONFIG_HOME: value,
			};

			const result = run([], env);

			expectRefused(result);
			expect(result.stderr).toContain(
				join(String(env.HOME), ".config", "dev-task-board", "config.toml"),
			);
		});
	});

	describe("A fault in the file", () => {
		it.each([
			["text that is not TOML", "[workspaces\n", undefined],
			["a reserved name", '[workspaces.api]\nprojects = ["/"]\n', "api"],
			[
				"a path the system cannot answer for",
				'[workspaces.work]\nprojects = ["/tmp/a\\u0000b"]\n',
				"not a directory",
			],
			[
				"a github account",
				'[workspaces.work]\nprojects = ["/"]\ngithub_account = "x"\n',
				"github_account",
			],
		])(
			"refuses %s, naming the settings file and the fault",
			(_name, text, fault) => {
				const root = temporaryDirectory();
				const env = isolatedEnvironment(root);
				writeSettings(env, text);

				const result = run([], env);

				expectRefused(result);
				expect(result.stderr).toContain(settingsFile(env));
				if (fault !== undefined) {
					expect(result.stderr).toContain(fault);
				}
			},
		);
	});
});

describe("What the tool needs is checked at start", () => {
	function pathWithout(root: string, missing: string): string {
		const directory = join(root, "only");
		mkdirSync(directory);
		for (const name of ["bash", "git", "awk"]) {
			if (name === missing) {
				continue;
			}
			const found = spawnSync("sh", ["-c", `command -v ${name}`], {
				encoding: "utf8",
			}).stdout.trim();
			symlinkSync(found, join(directory, name));
		}
		return directory;
	}

	describe("A missing requirement", () => {
		it.each(["bash", "git", "awk"])("refuses, naming %s", (missing) => {
			const { root, env } = validEnvironment();

			const result = run([], { ...env, PATH: pathWithout(root, missing) });

			expectRefused(result);
			expect(result.stderr).toMatch(new RegExp(`\\b${missing}\\b`));
		});

		it("starts with no gh on PATH", async () => {
			const { root, env } = validEnvironment();
			const port = await freePort();

			const board = start(["--port", String(port)], {
				...env,
				PATH: pathWithout(root, "gh"),
			});
			await listening(board, port);

			expect((await get(port, "/")).status).toBe(200);
		});
	});
});

describe("Stopping the board stops its reads", () => {
	describe("Stopped during a read", () => {
		it.each(["SIGINT", "SIGTERM"] as const)(
			"on %s, the read is gone, the port free, and it exits zero",
			async (signal) => {
				const { root, env } = validEnvironment();
				const { log, pids } = slowGh(root);
				const port = await freePort();
				const board = start(["--port", String(port)], env);
				await listening(board, port);
				await waitUntil(() => lines(log).length > 0 && pidsIn(pids).length > 0);
				const [gh] = pidsIn(pids);

				const before = Date.now();
				board.child.kill(signal);
				const { code } = await board.exited;

				expect(code).toBe(0);
				// SIGTERM ends the stub's sleep at once, so this is well inside the
				// 5 second grace; the margin is for a loaded machine.
				expect(Date.now() - before).toBeLessThan(7000);
				await waitUntil(() => !isRunning(Number(gh)), 2000);
				expect(await isFree(port)).toBe(true);
			},
		);
	});

	describe("Stopped with a project waiting", () => {
		it("never reads the second project", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const first = fixtureProject(root, env, "one");
			const second = fixtureProject(root, env, "two");
			writeSettings(env, workspaceWith(first, second));
			const { log } = slowGh(root);
			const port = await freePort();
			const board = start(["--port", String(port)], env);
			await listening(board, port);
			await waitUntil(() => lines(log).length > 0);

			board.child.kill("SIGINT");
			const { code } = await board.exited;

			expect(code).toBe(0);
			expect(lines(log)).toEqual([first]);
		});
	});
});
