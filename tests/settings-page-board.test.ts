// Derived from the change `write-the-settings`: the settings delta's "No
// settings file starts the board empty", board-pages' settings page, saving and
// addresses, and project-reads' "Reads follow saved settings" and "A save
// meets the pass at start". Each runs the built command against an isolated
// home, so it depends on no interface the specs leave open; see that change's
// test-plan.md for each assertion's classification.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildFixtureRepository,
	git,
	isolatedEnvironment,
} from "./support/fixture.js";
import { attribute, blocks, textOf } from "./support/page.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 45_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const builtCommand = join(repositoryRoot, "dist", "cli.js");

// Everything below up to the first describe is declared here, not in
// tests/support/: see test-plan.md, "Missing shared arrangement".

type Board = {
	child: ChildProcess;
	port: number;
	stdout(): string;
	stderr(): string;
	exited: Promise<{ code: number | null; signal: string | null }>;
};

const boards: Board[] = [];
const pidFiles: string[] = [];
const lockedPaths: string[] = [];

type Home = {
	root: string;
	env: NodeJS.ProcessEnv;
	home: string;
	projects: string;
	settings: string;
};

function isolatedHome(): Home {
	const root = temporaryDirectory();
	const env = isolatedEnvironment(root);
	const home = String(env.HOME);
	const projects = join(home, "projects");
	mkdirSync(projects, { recursive: true });
	return {
		root,
		env,
		home,
		projects,
		settings: join(
			String(env.XDG_CONFIG_HOME),
			"dev-task-board",
			"config.toml",
		),
	};
}

function writeSettings(at: Home, text: string): void {
	mkdirSync(join(String(at.env.XDG_CONFIG_HOME), "dev-task-board"), {
		recursive: true,
	});
	writeFileSync(at.settings, text);
}

function workspaceTable(name: string, projects: string[], extra = ""): string {
	return `[workspaces.${JSON.stringify(name)}]\nprojects = ${JSON.stringify(projects)}\n${extra}`;
}

// A directory the page would find: one holding `.git`.
function foundRepository(at: Home, name: string): string {
	const path = join(at.projects, name);
	mkdirSync(join(path, ".git"), { recursive: true });
	return path;
}

// A git repository the carried tool can read, with one backlog entry.
function readableProject(at: Home, name: string, entry: string): string {
	const path = join(at.projects, name);
	mkdirSync(at.projects, { recursive: true });
	buildFixtureRepository(path, at.env, "docs/backlog/AGENTS.md");
	writeFileSync(join(path, "docs", "backlog", `${entry}.md`), `# ${entry}\n`);
	git(path, at.env, "add", ".");
	git(
		path,
		at.env,
		"-c",
		"user.name=Fixture",
		"-c",
		"user.email=fixture@example.invalid",
		"-c",
		"commit.gpgsign=false",
		"commit",
		"--quiet",
		"-m",
		entry,
	);
	return path;
}

// A gh that logs the directory it was run in, and its pid, then runs `then`.
function loggingGh(at: Home, then: string): { log: string; pids: string } {
	const log = join(at.root, "gh.log");
	const pids = join(at.root, "gh.pids");
	pidFiles.push(pids);
	writeFileSync(
		join(at.root, "stubs", "gh"),
		`#!/bin/sh\necho "$PWD" >> '${log}'\n${then}\necho 'gh stub: not available' >&2\nexit 1\n`,
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

function isRunning(pid: number): boolean {
	const { stdout } = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], {
		encoding: "utf8",
	});
	const state = stdout.trim();
	return state !== "" && !state.startsWith("Z");
}

function occupy(port: number): Promise<Server> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(port, "127.0.0.1", () => {
			resolve(server);
		});
	});
}

async function freePort(): Promise<number> {
	const server = await occupy(0);
	const address = server.address();
	await new Promise<void>((resolve) => {
		server.close(() => {
			resolve();
		});
	});
	if (address === null || typeof address === "string") {
		throw new Error("no port");
	}
	return address.port;
}

async function waitUntil(
	condition: () => boolean | Promise<boolean>,
	ms = 15_000,
): Promise<void> {
	const deadline = Date.now() + ms;
	while (!(await condition())) {
		if (Date.now() > deadline) {
			throw new Error("timed out waiting");
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

function pause(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startBoard(at: Home): Promise<Board> {
	const port = await freePort();
	const child = spawn(
		process.execPath,
		[builtCommand, "--port", String(port)],
		{
			cwd: at.home,
			env: at.env,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	let stdout = "";
	let stderr = "";
	child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
		stdout += chunk;
	});
	child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
		stderr += chunk;
	});
	const board: Board = {
		child,
		port,
		stdout: () => stdout,
		stderr: () => stderr,
		exited: new Promise((resolve) => {
			child.on("exit", (code, signal) => {
				resolve({ code, signal });
			});
		}),
	};
	boards.push(board);
	const exited = board.exited.then(({ code, signal }) => {
		throw new Error(
			`the command exited (${code ?? signal}) before listening: ${board.stderr()}`,
		);
	});
	await Promise.race([
		waitUntil(() => board.stdout().includes(`127.0.0.1:${port}`)),
		exited,
	]);
	return board;
}

function runCommand(at: Home) {
	return spawnSync(process.execPath, [builtCommand], {
		cwd: at.home,
		env: at.env,
		encoding: "utf8",
		timeout: 15_000,
		killSignal: "SIGKILL",
	});
}

type Answer = { status: number; location: string | undefined; body: string };

function send(
	port: number,
	method: string,
	path: string,
	headers: Record<string, string> = {},
	body?: string,
): Promise<Answer> {
	const sent: Record<string, string> = {
		Host: `127.0.0.1:${port}`,
		...headers,
	};
	if (body !== undefined) {
		sent["Content-Length"] = String(Buffer.byteLength(body));
	}
	return new Promise((resolve, reject) => {
		let answered = false;
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				method,
				path,
				headers: sent,
				agent: false,
				timeout: 30_000,
			},
			(response) => {
				answered = true;
				let text = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					resolve({
						status: response.statusCode ?? 0,
						location: response.headers.location,
						body: text,
					});
				});
			},
		);
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no answer for ${method} ${path}`));
		});
		outgoing.on("error", (error) => {
			// A server refusing a long body may close before reading it all.
			if (!answered) reject(error);
		});
		outgoing.end(body);
	});
}

function get(board: Board, path: string): Promise<Answer> {
	return send(board.port, "GET", path);
}

function ownPage(port: number): Record<string, string> {
	return {
		Origin: `http://127.0.0.1:${port}`,
		"Sec-Fetch-Site": "same-origin",
		"Content-Type": "application/x-www-form-urlencoded",
	};
}

function save(
	board: Board,
	fields: [string, string][],
	headers: Record<string, string> = {},
): Promise<Answer> {
	return send(
		board.port,
		"POST",
		"/settings",
		{ ...ownPage(board.port), ...headers },
		new URLSearchParams(fields).toString(),
	);
}

async function settingsPage(board: Board): Promise<string> {
	const answer = await get(board, "/settings");
	expect(answer.status).toBe(200);
	return answer.body;
}

type Saved = {
	port?: unknown;
	projects_dir?: unknown;
	workspaces?: Record<
		string,
		{ projects?: string[]; github_account?: unknown }
	>;
};

function savedSettings(at: Home): Saved {
	return parse(readFileSync(at.settings, "utf8")) as Saved;
}

// What pressing each submit button of the page would post to /settings: the
// named fields of its form, which holds it or which its `form` attribute names,
// with the button's own name and value. A form with no submit button posts its
// fields as typed into, so as they stand.
type Submission = Record<string, string>;

function submissions(html: string): Submission[] {
	const forms = blocks(html, "form").map((block) => {
		const open = /^<form\b([^>]*)>/i.exec(html.slice(block.start));
		return { ...block, attributes: open?.[1] ?? "" };
	});
	const posting = (attributes: string) =>
		(attribute(attributes, "method") ?? "").toLowerCase() === "post" &&
		["/settings", "", null].includes(attribute(attributes, "action"));
	const fields = new Map<number, Submission>();
	const submitters = new Map<number, Submission[]>();
	forms.forEach((_form, index) => {
		fields.set(index, {});
		submitters.set(index, []);
	});
	for (const match of html.matchAll(/<(input|button|textarea)\b([^>]*)>/gi)) {
		const tag = (match[1] ?? "").toLowerCase();
		const attributes = match[2] ?? "";
		const at = match.index ?? 0;
		const owner = attribute(attributes, "form");
		const index =
			owner !== null
				? forms.findIndex((form) => attribute(form.attributes, "id") === owner)
				: (forms
						.map((form, i) => ({ form, i }))
						.filter(({ form }) => form.start < at && at < form.end)
						.sort(
							(a, b) => a.form.end - a.form.start - (b.form.end - b.form.start),
						)[0]?.i ?? -1);
		if (index === -1) continue;
		const name = attribute(attributes, "name");
		const type = (attribute(attributes, "type") ?? "").toLowerCase();
		const submits =
			(tag === "button" && (type === "" || type === "submit")) ||
			(tag === "input" && type === "submit");
		if (submits) {
			submitters
				.get(index)
				?.push(
					name === null ? {} : { [name]: attribute(attributes, "value") ?? "" },
				);
		} else if (
			name !== null &&
			!["button", "reset", "checkbox", "radio", "image"].includes(type)
		) {
			const own = fields.get(index);
			if (own !== undefined) own[name] = attribute(attributes, "value") ?? "";
		}
	}
	const found: Submission[] = [];
	forms.forEach((form, index) => {
		if (!posting(form.attributes)) return;
		const base = fields.get(index) ?? {};
		const buttons = submitters.get(index) ?? [];
		if (buttons.length === 0) {
			found.push({ ...base });
		}
		for (const button of buttons) {
			found.push({ ...base, ...button });
		}
	});
	return found;
}

function offered(html: string, workspace: string): string[] {
	return submissions(html)
		.filter((each) => each.workspace === workspace && (each.add ?? "") !== "")
		.map((each) => each.add as string);
}

function removable(html: string, workspace: string): string[] {
	return submissions(html)
		.filter(
			(each) => each.workspace === workspace && (each.remove ?? "") !== "",
		)
		.map((each) => each.remove as string);
}

function removableWorkspaces(html: string): string[] {
	return submissions(html)
		.filter((each) => (each.remove_workspace ?? "") !== "")
		.map((each) => each.remove_workspace as string);
}

function idsOf(html: string): string[] {
	return [...html.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)]
		.map((match) => attribute(match[1] ?? "", "id"))
		.filter((id): id is string => id !== null);
}

function linksToSettings(html: string): boolean {
	return [...html.matchAll(/<a\b([^>]*)>/gi)].some((match) =>
		/^\/settings(#.*)?$/.test(attribute(match[1] ?? "", "href") ?? ""),
	);
}

const couldNotBeRead =
	/could\s*not\s+be\s+read|can(?:no|')t\s+be\s+read|unreadable|could\s*not\s+read|missing|does\s+not\s+exist|not\s+found/i;
const couldNotBeSaved =
	/(?:could|can)\s*(?:no|')t\s+(?:be\s+)?sav|failed\s+to\s+save|not\s+saved/i;

afterEach(async () => {
	for (const path of lockedPaths.splice(0)) {
		try {
			chmodSync(path, 0o755);
		} catch {
			// Removed already.
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
	for (const path of pidFiles.splice(0)) {
		for (const pid of pidsIn(path)) {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// Already gone.
			}
		}
	}
	removeTemporaryDirectories();
});

const asRoot = typeof process.getuid === "function" && process.getuid() === 0;

describe("No settings file starts the board empty", () => {
	describe("No file", () => {
		it("serves, prints the address of /settings, and writes no settings file", async () => {
			const at = isolatedHome();

			const board = await startBoard(at);

			expect(board.stdout()).toContain(
				`http://127.0.0.1:${board.port}/settings`,
			);
			expect((await get(board, "/settings")).status).toBe(200);
			expect(existsSync(at.settings)).toBe(false);
		});

		it("writes no settings file when the page is only looked at", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			const board = await startBoard(at);

			await get(board, "/");
			await settingsPage(board);

			expect(existsSync(at.settings)).toBe(false);
		});
	});

	describe("A file that cannot be read", () => {
		it("exits non-zero naming the file, and leaves it unchanged", () => {
			const at = isolatedHome();
			const text = "[workspaces\nprojects = [\n";
			writeSettings(at, text);

			const result = runCommand(at);

			expect(result.error).toBeUndefined();
			expect(result.status).not.toBe(0);
			expect(result.status).not.toBeNull();
			expect(result.stderr).toContain(at.settings);
			expect(readFileSync(at.settings, "utf8")).toBe(text);
		});
	});
});

describe("Bad settings refuse the start", () => {
	describe("Missing file", () => {
		it.each([
			["set", (at: Home) => at.env.XDG_CONFIG_HOME],
			["unset", () => undefined],
			["empty", () => ""],
		])("is not refused where XDG_CONFIG_HOME is %s", async (_name, value) => {
			const at = isolatedHome();
			at.env = { ...at.env, XDG_CONFIG_HOME: value(at) };

			const board = await startBoard(at);

			expect(board.child.exitCode).toBeNull();
			expect((await get(board, "/settings")).status).toBe(200);
		});
	});
});

describe("The settings page", () => {
	describe("Another workspace offers it too", () => {
		it("offers group/one to b and not to a, which holds it", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			writeSettings(
				at,
				workspaceTable("a", ["group/one"]) + workspaceTable("b", []),
			);
			const board = await startBoard(at);

			const html = await settingsPage(board);

			expect(offered(html, "b")).toContain("group/one");
			expect(offered(html, "a")).not.toContain("group/one");
			expect(removable(html, "a")).toEqual(["group/one"]);
		});
	});

	describe("Removing a workspace", () => {
		it("gives only b, which has no projects, a button removing it", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			writeSettings(
				at,
				workspaceTable("a", ["group/one"]) + workspaceTable("b", []),
			);
			const board = await startBoard(at);

			const html = await settingsPage(board);

			expect(removableWorkspaces(html)).toEqual(["b"]);
		});
	});

	describe("Linked from every page", () => {
		it("links the list of workspaces, an overview and a project's page to /settings", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			writeSettings(
				at,
				workspaceTable("a", ["group/one"]) + workspaceTable("b", []),
			);
			const board = await startBoard(at);

			for (const path of ["/", "/a", "/a/one"]) {
				const answer = await get(board, path);
				expect(answer.status).toBe(200);
				expect(linksToSettings(answer.body), path).toBe(true);
			}
		});

		it("links an overview and a project's page to /settings with one workspace", async () => {
			const at = isolatedHome();
			// Written as an absolute path, so that today's board starts too.
			const one = foundRepository(at, "group/one");
			writeSettings(at, workspaceTable("work", [one]));
			const board = await startBoard(at);

			for (const path of ["/", "/work", "/work/one"]) {
				const answer = await get(board, path);
				expect(answer.status).toBe(200);
				expect(linksToSettings(answer.body), path).toBe(true);
			}
		});
	});

	describe("No workspace", () => {
		it("answers / with 303 to /settings with no settings file", async () => {
			const at = isolatedHome();
			const board = await startBoard(at);

			const answer = await get(board, "/");

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/settings");
		});

		it("answers / with 303 to /settings with a file naming no workspace", async () => {
			const at = isolatedHome();
			writeSettings(at, `projects_dir = "${at.projects}"\n`);
			const board = await startBoard(at);

			const answer = await get(board, "/");

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/settings");
		});
	});

	describe("What the page holds", () => {
		it("shows the projects folder, a field per workspace and one for a workspace, says comments are dropped, and needs no script", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			writeSettings(
				at,
				workspaceTable("a", ["group/one"]) + workspaceTable("b", []),
			);
			const board = await startBoard(at);

			const html = await settingsPage(board);
			const posts = submissions(html);

			expect(textOf(html)).toContain(at.projects);
			for (const name of ["a", "b"]) {
				expect(
					posts.some((each) => each.workspace === name && each.add === ""),
					name,
				).toBe(true);
			}
			expect(posts.some((each) => each.add_workspace === "")).toBe(true);
			expect(textOf(html)).toMatch(/comment/i);
			expect(html).not.toMatch(/<script\b/i);
		});
	});
});

describe("The settings page finds repositories", () => {
	describe("What is found", () => {
		it("lists group/one with a remove button, and offers group/two and solo, sorted, and nothing else", async () => {
			const at = isolatedHome();
			for (const name of [
				"solo",
				"group/one",
				"group/two",
				".hidden/x",
				"node_modules/y",
				"solo/inner",
			]) {
				foundRepository(at, name);
			}
			mkdirSync(join(at.projects, "group", "notes"), { recursive: true });
			writeSettings(at, workspaceTable("work", ["group/one"]));
			const board = await startBoard(at);

			const html = await settingsPage(board);

			expect(removable(html, "work")).toEqual(["group/one"]);
			expect(offered(html, "work")).toEqual(["group/two", "solo"]);
		});

		it("finds a repository whose .git is a file", async () => {
			const at = isolatedHome();
			mkdirSync(join(at.projects, "worktree"), { recursive: true });
			writeFileSync(join(at.projects, "worktree", ".git"), "gitdir: /x\n");
			writeSettings(at, workspaceTable("work", []));
			const board = await startBoard(at);

			expect(offered(await settingsPage(board), "work")).toEqual(["worktree"]);
		});
	});

	describe("No projects folder", () => {
		it("offers no repository, and says the folder could not be read", async () => {
			const at = isolatedHome();
			const nowhere = join(at.root, "nowhere");
			writeSettings(
				at,
				`projects_dir = "${nowhere}"\n${workspaceTable("work", [])}`,
			);
			const board = await startBoard(at);

			const html = await settingsPage(board);

			expect(offered(html, "work")).toEqual([]);
			expect(textOf(html)).toContain(nowhere);
			expect(textOf(html)).toMatch(couldNotBeRead);
		});
	});
});

describe("Saving the settings", () => {
	describe("Adding a found repository", () => {
		it("answers 303 to /settings#workspace-work, and the file lists both, keeping port and github_account", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			foundRepository(at, "group/two");
			const port = await freePort();
			writeSettings(
				at,
				`port = ${port}\n${workspaceTable("work", ["group/one"], 'github_account = "someone"\n')}`,
			);
			const board = await startBoard(at);
			expect(offered(await settingsPage(board), "work")).toContain("group/two");

			const answer = await save(board, [
				["workspace", "work"],
				["add", "group/two"],
			]);

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/settings#workspace-work");
			const saved = savedSettings(at);
			expect([...(saved.workspaces?.work?.projects ?? [])].sort()).toEqual([
				"group/one",
				"group/two",
			]);
			expect(saved.port).toBe(port);
			expect(saved.workspaces?.work?.github_account).toBe("someone");
		});

		it("keeps projects_dir and keys it does not know", async () => {
			const at = isolatedHome();
			const code = join(at.root, "code");
			mkdirSync(join(code, "one"), { recursive: true });
			writeSettings(
				at,
				`projects_dir = "${code}"\nunknown_key = "kept"\n${workspaceTable("work", [])}`,
			);
			const board = await startBoard(at);

			const answer = await save(board, [
				["workspace", "work"],
				["add", "one"],
			]);

			expect(answer.status).toBe(303);
			const saved = savedSettings(at) as Saved & { unknown_key?: unknown };
			expect(saved.projects_dir).toBe(code);
			expect(saved.unknown_key).toBe("kept");
			expect(saved.workspaces?.work?.projects).toEqual(["one"]);
		});
	});

	describe("The first save", () => {
		it("creates the file, with workspace work listing group/one", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			const board = await startBoard(at);

			const added = await save(board, [["add_workspace", "work"]]);
			const project = await save(board, [
				["workspace", "work"],
				["add", "group/one"],
			]);

			expect(added.status).toBe(303);
			expect(project.status).toBe(303);
			expect(savedSettings(at).workspaces?.work?.projects).toEqual([
				"group/one",
			]);
		});

		it("writes under ~/.config where XDG_CONFIG_HOME is unset", async () => {
			const at = isolatedHome();
			at.env = { ...at.env, XDG_CONFIG_HOME: undefined };
			const board = await startBoard(at);

			const answer = await save(board, [["add_workspace", "work"]]);

			expect(answer.status).toBe(303);
			const path = join(at.home, ".config", "dev-task-board", "config.toml");
			const written = parse(readFileSync(path, "utf8")) as Saved;
			expect(Object.keys(written.workspaces ?? {})).toEqual(["work"]);
		});
	});

	describe("Removing", () => {
		it("leaves only group/one under work, and no old", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			foundRepository(at, "group/two");
			writeSettings(
				at,
				workspaceTable("work", ["group/one", "group/two"]) +
					workspaceTable("old", []),
			);
			const board = await startBoard(at);

			const removed = await save(board, [
				["workspace", "work"],
				["remove", "group/two"],
			]);
			const gone = await save(board, [["remove_workspace", "old"]]);

			expect(removed.status).toBe(303);
			expect(removed.location).toBe("/settings#workspace-work");
			expect(gone.status).toBe(303);
			expect(gone.location).toBe("/settings");
			const saved = savedSettings(at);
			expect(Object.keys(saved.workspaces ?? {})).toEqual(["work"]);
			expect(saved.workspaces?.work?.projects).toEqual(["group/one"]);
		});
	});

	describe("Saves one at a time", () => {
		it("keeps every one of several saves posted at once", async () => {
			const at = isolatedHome();
			const board = await startBoard(at);
			const names = ["w1", "w2", "w3", "w4", "w5"];

			const answers = await Promise.all(
				names.map((name) => save(board, [["add_workspace", name]])),
			);

			expect(answers.map((answer) => answer.status)).toEqual(
				names.map(() => 303),
			);
			expect(Object.keys(savedSettings(at).workspaces ?? {}).sort()).toEqual(
				names,
			);
		});
	});
});

describe("A save is checked", () => {
	async function boardWithWork(at: Home, projects = ["group/one"]) {
		foundRepository(at, "group/one");
		writeSettings(at, workspaceTable("work", projects));
		const board = await startBoard(at);
		return { board, before: readFileSync(at.settings, "utf8") };
	}

	describe("A refused add", () => {
		it("answers 400 naming one, and leaves the file unchanged", async () => {
			const at = isolatedHome();
			foundRepository(at, "a/one");
			foundRepository(at, "b/one");
			writeSettings(at, workspaceTable("work", ["a/one"]));
			const before = readFileSync(at.settings, "utf8");
			const board = await startBoard(at);

			const answer = await save(board, [
				["workspace", "work"],
				["add", "b/one"],
			]);

			expect(answer.status).toBe(400);
			expect(textOf(answer.body)).toMatch(/\bone\b/);
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});

		it("answers 400 to an add already held", async () => {
			const at = isolatedHome();
			const { board, before } = await boardWithWork(at);

			const answer = await save(board, [
				["workspace", "work"],
				["add", "group/one"],
			]);

			expect(answer.status).toBe(400);
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});

		it("answers 400 to a remove not held", async () => {
			const at = isolatedHome();
			const { board, before } = await boardWithWork(at);

			const answer = await save(board, [
				["workspace", "work"],
				["remove", "group/two"],
			]);

			expect(answer.status).toBe(400);
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});

		it("answers 400 to a workspace named settings", async () => {
			const at = isolatedHome();
			const { board, before } = await boardWithWork(at);

			const answer = await save(board, [["add_workspace", "settings"]]);

			expect(answer.status).toBe(400);
			expect(textOf(answer.body)).toContain("settings");
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});
	});

	describe("A name that is no directory", () => {
		it("answers 400 naming group/missing, and leaves the file unchanged", async () => {
			const at = isolatedHome();
			const { board, before } = await boardWithWork(at);

			const answer = await save(board, [
				["workspace", "work"],
				["add", "group/missing"],
			]);

			expect(answer.status).toBe(400);
			expect(textOf(answer.body)).toContain("group/missing");
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});
	});

	describe("Removing a workspace with projects", () => {
		it("answers 400, and leaves the file unchanged", async () => {
			const at = isolatedHome();
			const { board, before } = await boardWithWork(at);

			const answer = await save(board, [["remove_workspace", "work"]]);

			expect(answer.status).toBe(400);
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});
	});

	describe("From another site", () => {
		it.each([
			["Sec-Fetch-Site cross-site", { "Sec-Fetch-Site": "cross-site" }],
			["another Origin", { Origin: "http://evil.example" }],
		])(
			"answers 403 with %s, and leaves the file unchanged",
			async (_name, headers) => {
				const at = isolatedHome();
				const { board, before } = await boardWithWork(at);

				const answer = await save(board, [["add_workspace", "new"]], headers);

				expect(answer.status).toBe(403);
				expect(readFileSync(at.settings, "utf8")).toBe(before);
			},
		);

		it("answers 403 ahead of a body too long", async () => {
			const at = isolatedHome();
			const { board, before } = await boardWithWork(at);

			const answer = await save(board, [["add_workspace", "x".repeat(5000)]], {
				"Sec-Fetch-Site": "cross-site",
			});

			expect(answer.status).toBe(403);
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});
	});

	describe("A body too long", () => {
		it("answers 413 to a body over 4096 bytes, and leaves the file unchanged", async () => {
			const at = isolatedHome();
			const { board, before } = await boardWithWork(at);

			const answer = await save(board, [["add_workspace", "x".repeat(5000)]]);

			expect(answer.status).toBe(413);
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});
	});

	describe("A workspace that is not there, or already is", () => {
		it.each([
			[
				"add to gone",
				[
					["workspace", "gone"],
					["add", "group/one"],
				],
			],
			["add_workspace of work", [["add_workspace", "work"]]],
			["remove_workspace of gone", [["remove_workspace", "gone"]]],
		] as [string, [string, string][]][])(
			"answers 400 to %s, and leaves the file unchanged",
			async (_name, fields) => {
				const at = isolatedHome();
				const { board, before } = await boardWithWork(at, []);

				const answer = await save(board, fields);

				expect(answer.status).toBe(400);
				expect(readFileSync(at.settings, "utf8")).toBe(before);
			},
		);
	});

	describe("Two actions at once", () => {
		it.each([
			[
				"add_workspace and remove_workspace",
				[
					["add_workspace", "new"],
					["remove_workspace", "work"],
				],
			],
			[
				"add and remove",
				[
					["workspace", "work"],
					["add", "group/one"],
					["remove", "group/one"],
				],
			],
			["add with no workspace", [["add", "group/one"]]],
			["no action", [["workspace", "work"]]],
		] as [string, [string, string][]][])(
			"answers 400 to %s, and leaves the file unchanged",
			async (_name, fields) => {
				const at = isolatedHome();
				const { board, before } = await boardWithWork(at, []);

				const answer = await save(board, fields);

				expect(answer.status).toBe(400);
				expect(readFileSync(at.settings, "utf8")).toBe(before);
			},
		);
	});
});

describe("A save returns to its workspace", () => {
	describe("A name needing care", () => {
		it("answers 303 to /settings#workspace-a%20b, and the page has a section with that id", async () => {
			const at = isolatedHome();
			foundRepository(at, "group/one");
			writeSettings(at, workspaceTable("a b", []));
			const board = await startBoard(at);

			const answer = await save(board, [
				["workspace", "a b"],
				["add", "group/one"],
			]);

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/settings#workspace-a%20b");
			expect(idsOf(await settingsPage(board))).toContain("workspace-a%20b");
		});
	});
});

describe("A save that cannot be written", () => {
	describe("A file that cannot be written", () => {
		it.skipIf(asRoot)(
			"answers 500 saying the settings could not be saved, and the board shows no workspace new",
			async () => {
				const at = isolatedHome();
				writeSettings(at, workspaceTable("work", []));
				const before = readFileSync(at.settings, "utf8");
				const board = await startBoard(at);
				const directory = join(
					String(at.env.XDG_CONFIG_HOME),
					"dev-task-board",
				);
				lockedPaths.push(directory);
				chmodSync(directory, 0o555);

				const answer = await save(board, [["add_workspace", "new"]]);

				chmodSync(directory, 0o755);
				expect(answer.status).toBe(500);
				expect(textOf(answer.body)).toMatch(couldNotBeSaved);
				expect(readFileSync(at.settings, "utf8")).toBe(before);
				expect(idsOf(await settingsPage(board))).not.toContain("workspace-new");
				expect((await get(board, "/new")).status).toBe(404);
			},
		);

		it.skipIf(asRoot)(
			"answers 500 where the file exists but cannot be read, and leaves it unchanged",
			async () => {
				const at = isolatedHome();
				writeSettings(at, workspaceTable("work", []));
				const before = readFileSync(at.settings, "utf8");
				const board = await startBoard(at);
				lockedPaths.push(at.settings);
				chmodSync(at.settings, 0o000);

				const answer = await save(board, [["add_workspace", "new"]]);

				chmodSync(at.settings, 0o644);
				expect(answer.status).toBe(500);
				expect(readFileSync(at.settings, "utf8")).toBe(before);
				expect((await get(board, "/new")).status).toBe(404);
			},
		);
	});

	describe("A linked file", () => {
		it("keeps the link, and its target holds the saved settings", async () => {
			const at = isolatedHome();
			const dotfiles = join(at.root, "dotfiles");
			mkdirSync(dotfiles);
			const target = join(dotfiles, "config.toml");
			writeFileSync(target, workspaceTable("work", []));
			mkdirSync(join(String(at.env.XDG_CONFIG_HOME), "dev-task-board"), {
				recursive: true,
			});
			symlinkSync(target, at.settings);
			const board = await startBoard(at);

			const answer = await save(board, [["add_workspace", "new"]]);

			expect(answer.status).toBe(303);
			expect(lstatSync(at.settings).isSymbolicLink()).toBe(true);
			const saved = parse(readFileSync(target, "utf8")) as Saved;
			expect(Object.keys(saved.workspaces ?? {}).sort()).toEqual([
				"new",
				"work",
			]);
		});
	});
});

describe("Addresses reach workspaces and projects", () => {
	describe("Another method", () => {
		it("answers a PUT to /settings with 404, and leaves the file unchanged", async () => {
			const at = isolatedHome();
			writeSettings(at, workspaceTable("work", []));
			const before = readFileSync(at.settings, "utf8");
			const board = await startBoard(at);

			const answer = await send(
				board.port,
				"PUT",
				"/settings",
				ownPage(board.port),
				"add_workspace=new",
			);

			expect(answer.status).toBe(404);
			expect(readFileSync(at.settings, "utf8")).toBe(before);
		});
	});
});

describe("Document text is escaped", () => {
	describe("Markup on the settings page", () => {
		it("shows a repository found as <b>x as text", async () => {
			const at = isolatedHome();
			foundRepository(at, "<b>x");
			writeSettings(at, workspaceTable("work", []));
			const board = await startBoard(at);

			const html = await settingsPage(board);

			expect(html).not.toContain("<b>x");
			expect(textOf(html)).toContain("<b>x");
			expect(offered(html, "work")).toEqual(["<b>x"]);
		});

		it("shows a refused add of <i>y as text", async () => {
			const at = isolatedHome();
			writeSettings(at, workspaceTable("work", []));
			const board = await startBoard(at);

			const answer = await save(board, [
				["workspace", "work"],
				["add", "<i>y"],
			]);

			expect(answer.status).toBe(400);
			expect(answer.body).not.toContain("<i>y");
			expect(textOf(answer.body)).toContain("<i>y");
		});
	});
});

describe("Reads follow saved settings", () => {
	describe("A project added", () => {
		it("reads two without a restart, its page shows its tasks, and one is not read again", async () => {
			const at = isolatedHome();
			const one = readableProject(at, "one", "one-entry");
			const two = readableProject(at, "two", "two-entry");
			const { log } = loggingGh(at, "");
			writeSettings(at, workspaceTable("work", ["one"]));
			const board = await startBoard(at);
			await waitUntil(async () =>
				(await get(board, "/work/one")).body.includes("one-entry"),
			);
			const readsOfOne = lines(log).filter((line) => line === one).length;

			const answer = await save(board, [
				["workspace", "work"],
				["add", "two"],
			]);

			expect(answer.status).toBe(303);
			// Read by the save, before any request for its page.
			await waitUntil(() => lines(log).includes(two));
			expect(lines(log).filter((line) => line === one).length).toBe(readsOfOne);
			const page = await get(board, "/work/two");
			expect(page.status).toBe(200);
			expect(page.body).toContain("two-entry");
			expect(board.child.exitCode).toBeNull();
			expect((await get(board, "/work/one")).body).toContain("one-entry");
		});
	});

	describe("A project removed", () => {
		it("answers /work/two with 404, stops its read, and one holds what it held", async () => {
			const at = isolatedHome();
			readableProject(at, "one", "one-entry");
			const two = readableProject(at, "two", "two-entry");
			const { log, pids } = loggingGh(
				at,
				`case "$PWD" in */two) echo $$ >> '${join(at.root, "gh.pids")}'; exec sleep 60;; esac`,
			);
			writeSettings(at, workspaceTable("work", ["one", "two"]));
			const board = await startBoard(at);
			await waitUntil(
				() => lines(log).includes(two) && pidsIn(pids).length > 0,
			);
			const [gh] = pidsIn(pids);

			const answer = await save(board, [
				["workspace", "work"],
				["remove", "two"],
			]);

			expect(answer.status).toBe(303);
			expect((await get(board, "/work/two")).status).toBe(404);
			await waitUntil(() => !isRunning(Number(gh)), 5000);
			const page = await get(board, "/work/one");
			expect(page.status).toBe(200);
			expect(page.body).toContain("one-entry");
		});
	});
});

describe("A save meets the pass at start", () => {
	describe("Removed during the pass at start", () => {
		it("never reads two", async () => {
			const at = isolatedHome();
			const one = readableProject(at, "one", "one-entry");
			const two = readableProject(at, "two", "two-entry");
			const release = join(at.root, "release");
			const { log } = loggingGh(
				at,
				`case "$PWD" in */one) i=0; while [ ! -e '${release}' ] && [ "$i" -lt 600 ]; do sleep 0.05; i=$((i + 1)); done;; esac`,
			);
			writeSettings(at, workspaceTable("work", ["one", "two"]));
			const board = await startBoard(at);
			await waitUntil(() => lines(log).includes(one));

			const answer = await save(board, [
				["workspace", "work"],
				["remove", "two"],
			]);
			writeFileSync(release, "");

			expect(answer.status).toBe(303);
			// A request for one waits for the pass's read of it; after that the
			// pass would turn to two.
			expect((await get(board, "/work/one")).body).toContain("one-entry");
			await pause(3000);
			expect(lines(log)).not.toContain(two);
		});
	});
});
