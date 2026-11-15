// Derived from the change `replace-a-running-board`: the board-pages,
// package and settings deltas, against the built command and real processes.
// Every command here is started without a terminal: its standard input is
// ignored and its output piped.
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
	isolatedEnvironment,
} from "./support/fixture.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 30_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const builtCommand = join(repositoryRoot, "dist", "cli.js");

type Process = {
	child: ChildProcess;
	stdout(): string;
	stderr(): string;
	exited: Promise<{ code: number | null; signal: string | null }>;
};

const processes: Process[] = [];
const servers: Server[] = [];

function settingsFile(env: NodeJS.ProcessEnv): string {
	return join(String(env.XDG_CONFIG_HOME), "dev-task-board", "config.toml");
}

function writeSettings(env: NodeJS.ProcessEnv, text: string): void {
	mkdirSync(join(String(env.XDG_CONFIG_HOME), "dev-task-board"), {
		recursive: true,
	});
	writeFileSync(settingsFile(env), text);
}

function validEnvironment(top = "") {
	const root = temporaryDirectory();
	const env = isolatedEnvironment(root);
	const project = join(root, "one");
	buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
	writeSettings(
		env,
		`${top}[workspaces.work]\nprojects = ${JSON.stringify([project])}\n`,
	);
	return { root, env };
}

function spawnTracked(
	command: string,
	args: string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
): Process {
	const child = spawn(command, args, {
		cwd: options.cwd,
		env: options.env ?? process.env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let stdout = "";
	let stderr = "";
	child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
		stdout += chunk;
	});
	child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
		stderr += chunk;
	});
	const tracked: Process = {
		child,
		stdout: () => stdout,
		stderr: () => stderr,
		exited: new Promise((resolve) => {
			child.on("exit", (code, signal) => {
				resolve({ code, signal });
			});
		}),
	};
	processes.push(tracked);
	return tracked;
}

function start(
	args: string[],
	env: NodeJS.ProcessEnv,
	script = builtCommand,
): Process {
	return spawnTracked(process.execPath, [script, ...args], {
		cwd: String(env.HOME),
		env,
	});
}

async function waitUntil(condition: () => boolean, ms = 15_000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error("timed out waiting");
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

async function listening(board: Process, port: number): Promise<void> {
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

function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`timed out waiting: ${what}`)), ms),
		),
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

// A port p with p..p+count-1 all free, so what is offered above p is known.
async function freeRun(count: number): Promise<number> {
	for (let attempt = 0; attempt < 50; attempt++) {
		const port = await freePort();
		if (port + count - 1 > 65535) continue;
		let all = true;
		for (let next = port + 1; next < port + count; next++) {
			if (!(await isFree(next))) {
				all = false;
				break;
			}
		}
		if (all) return port;
	}
	throw new Error(`no run of ${count} free ports`);
}

function get(port: number, path: string): Promise<{ status: number }> {
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
					resolve({ status: response.statusCode ?? 0 });
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

// A program listening on a port that records every catchable signal it is
// sent. `holds` ignores them all; `lets-go:<ms>` closes the port and exits
// that long after SIGTERM.
const HOLDER_SOURCE = `
const net = require("node:net");
const fs = require("node:fs");
const [port, log, mode = "holds"] = process.argv.slice(2);
const server = net.createServer();
for (const name of ["SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT", "SIGUSR1", "SIGUSR2"]) {
	process.on(name, () => {
		fs.appendFileSync(log, name + "\\n");
		if (name === "SIGTERM" && mode.startsWith("lets-go:")) {
			setTimeout(() => {
				server.close();
				process.exit(0);
			}, Number(mode.slice("lets-go:".length)));
		}
	});
}
server.listen(Number(port), "127.0.0.1", () => {
	fs.appendFileSync(log, "listening\\n");
});
`;

type Holder = { process: Process; pid: number; signals(): string[] };

// Writes `<directory>/<script>` holding the holder program, with a
// package.json named `packageName` in `directory`.
function holderPackage(
	directory: string,
	packageName: string,
	script = join("dist", "cli.js"),
): string {
	mkdirSync(join(directory, "dist"), { recursive: true });
	writeFileSync(
		join(directory, "package.json"),
		JSON.stringify({ name: packageName, version: "0.0.0" }),
	);
	const path = join(directory, script);
	writeFileSync(path, HOLDER_SOURCE);
	return path;
}

async function startHolder(
	scriptArgument: string,
	port: number,
	log: string,
	options: { cwd: string; mode?: string },
): Promise<Holder> {
	const tracked = spawnTracked(
		process.execPath,
		[scriptArgument, String(port), log, options.mode ?? "holds"],
		{ cwd: options.cwd },
	);
	const lines = () =>
		existsSync(log)
			? readFileSync(log, "utf8").split("\n").filter(Boolean)
			: [];
	await Promise.race([
		waitUntil(() => lines().includes("listening")),
		tracked.exited.then(() => {
			throw new Error(`the holder exited: ${tracked.stderr()}`);
		}),
	]);
	return {
		process: tracked,
		pid: Number(tracked.child.pid),
		signals: () => lines().filter((line) => line !== "listening"),
	};
}

function expectRefused(
	result: { code: number | null },
	board: Process,
	port: number,
): void {
	expect(result.code).not.toBe(0);
	expect(result.code).not.toBeNull();
	expect(board.stdout()).toBe("");
	expect(board.stderr()).toContain(String(port));
}

afterEach(async () => {
	for (const server of servers.splice(0)) {
		if (server.listening) {
			await close(server);
		}
	}
	for (const each of processes.splice(0)) {
		if (each.child.exitCode === null && each.child.signalCode === null) {
			each.child.kill("SIGTERM");
			const killed = setTimeout(() => {
				each.child.kill("SIGKILL");
			}, 2000);
			await each.exited;
			clearTimeout(killed);
		}
	}
	removeTemporaryDirectories();
});

describe("The server is local and refuses other hosts", () => {
	describe("A port in use", () => {
		it("exits non-zero, naming the port, where a program that is not a board holds it", async () => {
			const { root, env } = validEnvironment();
			const port = await freePort();
			const holder = await startHolder(
				holderPackage(join(root, "other"), "some-other-program"),
				port,
				join(root, "holder.log"),
				{ cwd: root },
			);

			const board = start(["--port", String(port)], env);
			const result = await within(board.exited, 20_000, "the command to exit");

			expectRefused(result, board, port);
			expect(isRunning(holder.pid)).toBe(true);
		});
	});
});

describe("A running board is replaced", () => {
	describe("A board already on the port", () => {
		it("the first exits, and the second prints that it replaced the board with the first's process id, then its address, and the address answers", async () => {
			const { env } = validEnvironment();
			const port = await freePort();
			const first = start(["--port", String(port)], env);
			await listening(first, port);
			const firstPid = String(first.child.pid);

			const second = start(["--port", String(port)], env);
			await listening(second, port);

			await within(first.exited, 15_000, "the first board to exit");
			const out = second.stdout();
			expect(out).toMatch(/replaced/i);
			const pidAt = out.search(new RegExp(`\\b${firstPid}\\b`));
			expect(pidAt).toBeGreaterThan(-1);
			expect(pidAt).toBeLessThan(out.indexOf(`127.0.0.1:${port}`));
			expect((await get(port, "/")).status).toBe(200);
		});
	});

	describe("A board reached through a link", () => {
		it("the first, run through a link to dist/cli.js, exits and the second listens", async () => {
			const { root, env } = validEnvironment();
			const bin = join(root, "node_modules", ".bin");
			mkdirSync(bin, { recursive: true });
			const link = join(bin, "dev-task-board");
			symlinkSync(builtCommand, link);
			const port = await freePort();
			const first = start(["--port", String(port)], env, link);
			await listening(first, port);

			const second = start(["--port", String(port)], env);
			await listening(second, port);

			await within(first.exited, 15_000, "the first board to exit");
			expect((await get(port, "/")).status).toBe(200);
		});
	});

	describe("A board that lets go within the wait", () => {
		it("takes the port once a board that stops slowly frees it", async () => {
			const { root, env } = validEnvironment();
			const port = await freePort();
			const holder = await startHolder(
				holderPackage(join(root, "slow"), "dev-task-board"),
				port,
				join(root, "holder.log"),
				{ cwd: root, mode: "lets-go:3000" },
			);

			const board = start(["--port", String(port)], env);
			await listening(board, port);

			expect(holder.signals()).toEqual(["SIGTERM"]);
			expect((await get(port, "/")).status).toBe(200);
		});
	});
});

describe("A board that does not let go refuses the start", () => {
	describe("A board that does not let go", () => {
		it("exits non-zero naming the port and the holder's process id, and the holder is sent nothing else", async () => {
			const { root, env } = validEnvironment();
			const port = await freePort();
			const holder = await startHolder(
				holderPackage(join(root, "stuck"), "dev-task-board"),
				port,
				join(root, "holder.log"),
				{ cwd: root },
			);

			const board = start(["--port", String(port)], env);
			const result = await within(board.exited, 25_000, "the command to exit");

			expectRefused(result, board, port);
			expect(board.stderr()).toMatch(new RegExp(`\\b${holder.pid}\\b`));
			expect(holder.signals()).toEqual(["SIGTERM"]);
			expect(isRunning(holder.pid)).toBe(true);
		}, 45_000);
	});
});

describe("Another program's port is not taken", () => {
	describe("Another program, no terminal", () => {
		it("exits non-zero, writing nothing to standard output, naming the port and port =, and the holder still runs", async () => {
			const { root, env } = validEnvironment();
			const port = await freePort();
			const holder = await startHolder(
				holderPackage(join(root, "other"), "some-other-program"),
				port,
				join(root, "holder.log"),
				{ cwd: root },
			);

			const board = start(["--port", String(port)], env);
			const result = await within(board.exited, 20_000, "the command to exit");

			expectRefused(result, board, port);
			expect(board.stderr()).toContain("port =");
			expect(holder.signals()).toEqual([]);
			expect(isRunning(holder.pid)).toBe(true);
		});

		it("advises --port with the nearest free port above", async () => {
			const { root, env } = validEnvironment();
			const port = await freeRun(3);
			await occupy(port + 1);
			await startHolder(
				holderPackage(join(root, "other"), "some-other-program"),
				port,
				join(root, "holder.log"),
				{ cwd: root },
			);

			const board = start(["--port", String(port)], env);
			const result = await within(board.exited, 20_000, "the command to exit");

			expectRefused(result, board, port);
			expect(board.stderr()).toMatch(new RegExp(`--port ${port + 2}(?!\\d)`));
		});
	});

	describe("A look-alike", () => {
		it("refuses the start where the holder's dist/cli.js is in a package named otherwise, and the holder still runs", async () => {
			const { root, env } = validEnvironment();
			const port = await freePort();
			const holder = await startHolder(
				holderPackage(join(root, "x"), "not-dev-task-board"),
				port,
				join(root, "holder.log"),
				{ cwd: root },
			);

			const board = start(["--port", String(port)], env);
			const result = await within(board.exited, 20_000, "the command to exit");

			expectRefused(result, board, port);
			expect(holder.signals()).toEqual([]);
			expect(isRunning(holder.pid)).toBe(true);
		});

		it("refuses the start where the holder's script is not an absolute path", async () => {
			const { root, env } = validEnvironment();
			const port = await freePort();
			const directory = join(root, "relative");
			holderPackage(directory, "dev-task-board");
			const holder = await startHolder(
				join("dist", "cli.js"),
				port,
				join(root, "holder.log"),
				{ cwd: directory },
			);

			const board = start(["--port", String(port)], env);
			const result = await within(board.exited, 20_000, "the command to exit");

			expectRefused(result, board, port);
			expect(holder.signals()).toEqual([]);
			expect(isRunning(holder.pid)).toBe(true);
		});
	});
});

describe("The offered port", () => {
	describe("No port to offer", () => {
		it("exits non-zero naming the port, and advises no --port, where every port up to 100 above is unbindable", async () => {
			const { env } = validEnvironment();
			const port = await freePort();
			await occupy(port);
			for (let next = port + 1; next <= Math.min(port + 100, 65535); next++) {
				try {
					await occupy(next);
				} catch {
					// Held already by something else: unbindable either way.
				}
			}

			const board = start(["--port", String(port)], env);
			const result = await within(board.exited, 20_000, "the command to exit");

			expectRefused(result, board, port);
			expect(board.stderr()).not.toContain("--port");
			expect(board.stderr()).not.toContain("port =");
		});

		it("exits non-zero naming the port, and advises no --port, where the port held is 65535", async (context) => {
			if (!(await isFree(65535))) {
				context.skip();
			}
			const { env } = validEnvironment();
			await occupy(65535);

			const board = start(["--port", "65535"], env);
			const result = await within(board.exited, 20_000, "the command to exit");

			expectRefused(result, board, 65535);
			expect(board.stderr()).not.toContain("--port");
			expect(board.stderr()).not.toContain("port =");
		});
	});
});

describe("The command reports its version or starts the board", () => {
	describe("The port from the settings", () => {
		it("prints its address on the settings' port with no arguments, and the address answers", async (context) => {
			// Hold 8766, so a command that wrongly ignores the setting is refused
			// rather than starting on it or replacing a board running there.
			if (!(await isFree(8766))) {
				context.skip();
			}
			await occupy(8766);
			const port = await freePort();
			const { env } = validEnvironment(`port = ${port}\n`);

			const board = start([], env);
			await listening(board, port);

			expect((await get(port, "/")).status).toBe(200);
		});
	});

	describe("The flag over the settings", () => {
		it("listens on the port --port gave", async () => {
			const fromSettings = await freePort();
			let fromFlag = await freePort();
			while (fromFlag === fromSettings) fromFlag = await freePort();
			const { env } = validEnvironment(`port = ${fromSettings}\n`);

			const board = start(["--port", String(fromFlag)], env);
			await listening(board, fromFlag);

			expect((await get(fromFlag, "/")).status).toBe(200);
			expect(board.stdout()).not.toContain(`127.0.0.1:${fromSettings}`);
		});
	});
});

describe("Settings may name a port", () => {
	describe("A bad port", () => {
		it.each([
			["80", "80"],
			["70000", "70000"],
			["8800.5", "8800.5"],
			['"8800"', '"8800"'],
		])(
			"exits non-zero for port = %s, naming the settings file and port on standard error, and starts no server",
			async (_name, value) => {
				const port = await freePort();
				const { env } = validEnvironment(`port = ${value}\n`);

				const board = start(["--port", String(port)], env);
				const result = await within(
					board.exited,
					20_000,
					"the command to exit",
				);

				expect(result.code).not.toBe(0);
				expect(result.code).not.toBeNull();
				expect(board.stdout()).toBe("");
				expect(board.stderr()).toContain(settingsFile(env));
				expect(board.stderr()).toMatch(/\bport\b/);
				expect(await isFree(port)).toBe(true);
			},
		);
	});
});
