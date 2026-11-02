import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
	exited: Promise<void>;
};

const boards: Board[] = [];

function writeSettings(env: NodeJS.ProcessEnv, text: string): void {
	const directory = join(String(env.XDG_CONFIG_HOME), "dev-task-board");
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, "config.toml"), text);
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

function commitEntry(
	project: string,
	env: NodeJS.ProcessEnv,
	name: string,
): void {
	writeFileSync(join(project, "docs", "backlog", `${name}.md`), `# ${name}\n`);
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
		name,
	);
}

// A gh that holds a read open, in the projects `held` matches, until `release`
// exists, and logs where it was asked. Bounded, so that nothing outlives a test.
function holdingGh(root: string, held = "*"): { log: string; release: string } {
	const log = join(root, "gh.log");
	const release = join(root, "release");
	writeFileSync(
		join(root, "stubs", "gh"),
		[
			"#!/bin/sh",
			`echo "$PWD" >> '${log}'`,
			`case "$PWD" in ${held})`,
			"i=0",
			`until [ -e '${release}' ] || [ "$i" -ge 1000 ]; do sleep 0.02; i=$((i + 1)); done`,
			";; esac",
			"exit 1",
			"",
		].join("\n"),
		{ mode: 0o755 },
	);
	return { log, release };
}

function lines(path: string): string[] {
	return existsSync(path)
		? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
		: [];
}

function start(args: string[], env: NodeJS.ProcessEnv): Board {
	const child = spawn(process.execPath, [builtCommand, ...args], {
		cwd: String(env.HOME),
		env,
		stdio: ["ignore", "pipe", "ignore"],
	});
	let stdout = "";
	child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
		stdout += chunk;
	});
	const board: Board = {
		child,
		stdout: () => stdout,
		exited: new Promise((resolve) => {
			child.on("exit", () => {
				resolve();
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
		await delay(20);
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function freePort(): Promise<number> {
	const server: Server = createServer();
	await new Promise<void>((resolve, reject) => {
		server.on("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	await new Promise((resolve) => {
		server.close(resolve);
	});
	if (address === null || typeof address === "string") {
		throw new Error("no port");
	}
	return address.port;
}

async function boardOn(env: NodeJS.ProcessEnv): Promise<number> {
	const port = await freePort();
	const board = start(["--port", String(port)], env);
	await waitUntil(() => board.stdout().includes(`127.0.0.1:${port}`));
	return port;
}

function get(
	port: number,
	path: string,
	ms = 20_000,
): Promise<{ status: number; body: string }> {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}` },
				agent: false,
				timeout: ms,
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

describe("A page shows what was read for it", () => {
	describe("A refresh shows a change", () => {
		it("shows an entry committed after the page was read", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const project = fixtureProject(root, env, "one");
			writeSettings(
				env,
				`[workspaces.work]\nprojects = ${JSON.stringify([project])}\n`,
			);
			const port = await boardOn(env);

			const before = await get(port, "/work/one");
			commitEntry(project, env, "a-later-entry");
			const after = await get(port, "/work/one");

			expect(before.status).toBe(200);
			expect(before.body).not.toContain("a-later-entry");
			expect(after.body).toContain("a-later-entry");
		});
	});
});

describe("Each project is read at start and when requested", () => {
	describe("The server answers during a read", () => {
		it("answers another project's page and the list without waiting", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const one = fixtureProject(root, env, "one");
			const two = fixtureProject(root, env, "two");
			const three = fixtureProject(root, env, "three");
			writeSettings(
				env,
				[
					"[workspaces.work]",
					`projects = ${JSON.stringify([one, two])}`,
					"[workspaces.other]",
					`projects = ${JSON.stringify([three])}`,
					"",
				].join("\n"),
			);
			const { log } = holdingGh(root, "*/one");
			const port = await boardOn(env);
			await waitUntil(() => lines(log).includes(one));

			const page = await get(port, "/work/two", 5000);
			const list = await get(port, "/", 5000);

			expect(page.status).toBe(200);
			expect(page.body).not.toMatch(/being read/i);
			expect(list.status).toBe(200);
		});
	});

	describe("Two requests during one read", () => {
		it("starts no second read, and both answer when the read finishes", async () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const project = fixtureProject(root, env, "one");
			writeSettings(
				env,
				`[workspaces.work]\nprojects = ${JSON.stringify([project])}\n`,
			);
			const { log, release } = holdingGh(root);
			const port = await boardOn(env);
			await waitUntil(() => lines(log).length > 0);
			let answers = 0;
			const counted = () =>
				get(port, "/work/one").then((response) => {
					answers += 1;
					return response;
				});

			const requests = Promise.all([counted(), counted()]);
			await delay(1000);

			expect(answers).toBe(0);
			expect(lines(log)).toEqual([project]);

			writeFileSync(release, "");
			for (const { status, body } of await requests) {
				expect(status).toBe(200);
				expect(body).not.toMatch(/being read/i);
			}
		});
	});
});
