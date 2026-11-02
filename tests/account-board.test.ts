import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
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

type Board = { child: ChildProcess; stdout(): string; stderr(): string };

const boards: Board[] = [];

function settingsFile(env: NodeJS.ProcessEnv): string {
	return join(String(env.XDG_CONFIG_HOME), "dev-task-board", "config.toml");
}

function writeSettings(env: NodeJS.ProcessEnv, text: string): void {
	mkdirSync(join(String(env.XDG_CONFIG_HOME), "dev-task-board"), {
		recursive: true,
	});
	writeFileSync(settingsFile(env), text);
}

// A gh holding one account's token, and refusing any other account.
function ghHolding(root: string, account: string, token: string): void {
	writeFileSync(
		join(root, "stubs", "gh"),
		[
			"#!/bin/sh",
			`if [ "$1 $2" = "auth token" ]; then`,
			`  if [ "$4" = '${account}' ]; then echo '${token}'; exit 0; fi`,
			"  exit 1",
			"fi",
			"exit 1",
		].join("\n"),
		{ mode: 0o755 },
	);
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
	const board = { child, stdout: () => stdout, stderr: () => stderr };
	boards.push(board);
	return board;
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

async function listening(board: Board, port: number): Promise<void> {
	const deadline = Date.now() + 10_000;
	while (!board.stdout().includes(`127.0.0.1:${port}`)) {
		if (Date.now() > deadline || board.child.exitCode !== null) {
			throw new Error(`the board is not listening: ${board.stderr()}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

function body(port: number, path: string): Promise<string> {
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
				let text = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					resolve(text);
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

function project(root: string, env: NodeJS.ProcessEnv): string {
	const path = join(root, "one");
	buildFixtureRepository(path, env, "docs/backlog/AGENTS.md");
	return path;
}

afterEach(async () => {
	for (const board of boards.splice(0)) {
		if (board.child.exitCode === null && board.child.signalCode === null) {
			const exited = new Promise((resolve) => {
				board.child.on("exit", resolve);
			});
			board.child.kill("SIGKILL");
			await exited;
		}
	}
	removeTemporaryDirectories();
});

describe("Bad settings refuse the start", () => {
	describe("A github account", () => {
		it.each([
			["empty", 'github_account = ""'],
			["a number", "github_account = 1"],
		])(
			"exits non-zero where it is %s, naming the file, the workspace and the field",
			(_name, field) => {
				const root = temporaryDirectory();
				const env = isolatedEnvironment(root);
				const path = project(root, env);
				writeSettings(
					env,
					`[workspaces.desk]\nprojects = ${JSON.stringify([path])}\n${field}\n`,
				);

				const result = spawnSync(process.execPath, [builtCommand], {
					cwd: String(env.HOME),
					env,
					encoding: "utf8",
					timeout: 15_000,
					killSignal: "SIGKILL",
				});

				expect(result.error).toBeUndefined();
				expect(result.status).not.toBe(0);
				expect(result.status).not.toBeNull();
				expect(result.stdout).toBe("");
				expect(result.stderr).toContain(settingsFile(env));
				expect(result.stderr).toContain("desk");
				expect(result.stderr).toContain("github_account");
			},
		);
	});
});

describe("A workspace may name a GitHub account", () => {
	describe("With an account", () => {
		it("starts the board", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			ghHolding(root, "someone", "token-of-someone");
			writeSettings(
				env,
				`[workspaces.desk]\nprojects = ${JSON.stringify([project(root, env)])}\ngithub_account = "someone"\n`,
			);
			const port = await freePort();

			const board = start(["--port", String(port)], env);
			await listening(board, port);

			expect(await body(port, "/desk")).toContain("one");
		});
	});
});

describe("A read uses its workspace's GitHub account", () => {
	describe("A token for the account", () => {
		it("neither logs the token nor shows it", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			ghHolding(root, "someone", "token-of-someone");
			writeSettings(
				env,
				`[workspaces.desk]\nprojects = ${JSON.stringify([project(root, env)])}\ngithub_account = "someone"\n`,
			);
			const port = await freePort();

			const board = start(["--port", String(port)], env);
			await listening(board, port);
			const html = await body(port, "/desk/one");

			expect(html).not.toContain("token-of-someone");
			expect(board.stdout()).not.toContain("token-of-someone");
			expect(board.stderr()).not.toContain("token-of-someone");
		});
	});
});

describe("A page names an account it could not use", () => {
	describe("No token, nothing held before", () => {
		it("names the account on a running board's pages", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			writeSettings(
				env,
				`[workspaces.desk]\nprojects = ${JSON.stringify([project(root, env)])}\ngithub_account = "someone"\n`,
			);
			const port = await freePort();

			const board = start(["--port", String(port)], env);
			await listening(board, port);

			expect(await body(port, "/desk/one")).toContain("someone");
			expect(await body(port, "/desk")).toContain("someone");
		});
	});
});

describe("Several workspaces show as tabs", () => {
	describe("Several workspaces", () => {
		it("shows them on a running board, in the order of the file", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const path = JSON.stringify([project(root, env)]);
			writeSettings(
				env,
				`[workspaces.zeta]\nprojects = ${path}\n[workspaces.alpha]\nprojects = ${path}\n`,
			);
			const port = await freePort();

			const board = start(["--port", String(port)], env);
			await listening(board, port);
			const html = await body(port, "/alpha");

			const zeta = html.search(/href=["']\/zeta["']/);
			const alpha = html.search(/href=["']\/alpha["']/);
			expect(zeta).toBeGreaterThan(-1);
			expect(zeta).toBeLessThan(alpha);
			expect(html).toMatch(/aria-current=["']page["']/);
		});
	});
});
