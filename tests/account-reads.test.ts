import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReads, whatMissed } from "../src/reads.js";
import { renderOverview, renderProject } from "../src/render.js";
import { parseSettings } from "../src/settings.js";
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

const unset = "<unset>";
const unusableConfiguration = "/dev/null/gh";

type Reads = ReturnType<typeof createReads>;
type Document = Record<string, unknown>;
type Latest = { at: string; reason?: string; missed?: string[] };
type State =
	| { state: "reading" }
	| { state: "read"; document: Document; readAt: string; latest?: Latest }
	| { state: "failed"; reason: string };

const fullDocument = {
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
	forge: "full",
	forge_limit: 5000,
	warnings: 0,
	workstreams: [],
	tasks: [],
};

const running: Reads[] = [];
const spawnedPids: number[] = [];

// A machine with the board's process environment, and the stand-ins a read
// meets on it: a gh and a tool. Each stands in for the real one as design.md
// states it behaves, and each logs what it was given.
function machine() {
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
	for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR"]) {
		vi.stubEnv(name, undefined);
	}
	const tokens = join(root, "tokens");
	mkdirSync(tokens);
	const asked = join(root, "gh.log");
	writeGh(
		root,
		[
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
		].join("\n"),
	);
	return {
		root,
		env,
		asked,
		holds(account: string, token = `token-of-${account}`) {
			writeFileSync(join(tokens, account), `${token}\n`);
		},
		loses(account: string) {
			rmSync(join(tokens, account));
		},
	};
}

function writeGh(root: string, body: string): void {
	writeFileSync(join(root, "stubs", "gh"), `#!/bin/sh\n${body}\n`, {
		mode: 0o755,
	});
}

function pathWithNoGh(root: string): string {
	const directory = join(root, "no-gh");
	mkdirSync(directory);
	for (const name of ["bash", "cat"]) {
		const found = spawnSync("sh", ["-c", `command -v ${name}`], {
			encoding: "utf8",
		}).stdout.trim();
		symlinkSync(found, join(directory, name));
	}
	return directory;
}

// Run through `bash`, it logs what it was given, and reports as the carried
// tool does: `forge` is `none` where `gh` fails.
function scriptedTool(root: string) {
	const seen = join(root, "seen.log");
	const failing = join(root, "failing");
	const full = join(root, "full.json");
	const none = join(root, "none.json");
	const path = join(root, "stub-tool");
	writeFileSync(full, JSON.stringify(fullDocument));
	writeFileSync(none, JSON.stringify({ ...fullDocument, forge: "none" }));
	writeFileSync(
		path,
		[
			`printf '%s\\t%s\\t%s\\n' "\${GH_TOKEN-${unset}}" "\${GITHUB_TOKEN-${unset}}" "\${GH_CONFIG_DIR-${unset}}" >> '${seen}'`,
			`if [ -e '${failing}' ]; then echo 'Reason: refused' >&2; exit 2; fi`,
			`if gh pr list > /dev/null 2>&1; then cat '${full}'; else cat '${none}'; fi`,
		].join("\n"),
		{ mode: 0o644 },
	);
	return {
		path,
		seen,
		fails() {
			writeFileSync(failing, "");
		},
		reads(): { gh: string; github: string; configuration: string }[] {
			return lines(seen).map((line) => {
				const [gh, github, configuration] = line.split("\t");
				return {
					gh: String(gh),
					github: String(github),
					configuration: String(configuration),
				};
			});
		},
	};
}

function settings(
	root: string,
	accounts: Record<string, string | undefined>,
	project = "one",
) {
	const path = join(root, project);
	mkdirSync(path, { recursive: true });
	const text = Object.entries(accounts)
		.map(
			([name, account]) =>
				`[workspaces.${name}]\nprojects = [${JSON.stringify(path)}]\n${
					account === undefined
						? ""
						: `github_account = ${JSON.stringify(account)}\n`
				}`,
		)
		.join("");
	return parseSettings(text, { home: root, isDirectory: () => true });
}

function board(
	root: string,
	toolPath: string,
	limits = { limitMs: 10_000, graceMs: 200 },
): Reads {
	const reads = createReads(settings(root, { work: "someone" }), {
		toolPath,
		...limits,
	});
	running.push(reads);
	return reads;
}

function get(reads: Reads, workspace = "work"): State {
	return reads.get(workspace, "one") as unknown as State;
}

function held(reads: Reads, workspace = "work") {
	const state = get(reads, workspace);
	if (state.state !== "read") {
		throw new Error(`expected a document, got ${JSON.stringify(state)}`);
	}
	return state;
}

function failedReason(reads: Reads): string {
	const state = get(reads);
	if (state.state !== "failed") {
		throw new Error(`expected a failed read, got ${JSON.stringify(state)}`);
	}
	return state.reason;
}

function lines(path: string): string[] {
	return existsSync(path)
		? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
		: [];
}

function tokenRequests(path: string): string[] {
	return lines(path).filter((line) => line.startsWith("auth "));
}

function missedBy(document: unknown): string[] {
	return whatMissed(document as Parameters<typeof whatMissed>[0]);
}

function page(reads: Reads): string {
	return renderProject(
		"work",
		"one",
		reads.get("work", "one") as Parameters<typeof renderProject>[2],
	);
}

function overview(reads: Reads): string {
	return renderOverview(
		{ name: "work", projects: [{ name: "one", path: "/srv/one" }] },
		reads as unknown as Parameters<typeof renderOverview>[1],
	);
}

function textOf(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
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

function pidIn(path: string): number {
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

// A gh that does not answer, keeping its pid when `exec` replaces it.
function ghThatDoesNotAnswer(root: string, before = ""): string {
	const pid = join(root, "gh.pid");
	writeGh(root, `${before}\necho $$ > '${pid}'\nexec sleep 60`);
	return pid;
}

afterEach(async () => {
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

describe("A read uses its workspace's GitHub account", () => {
	describe("A token for the account", () => {
		it("asks gh for that account, and the tool's GH_TOKEN is its token", async () => {
			const { root, asked, holds } = machine();
			holds("someone");
			const tool = scriptedTool(root);
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");

			expect(tokenRequests(asked)).toEqual(["auth token --user someone"]);
			expect(tool.reads()).toEqual([
				{ gh: "token-of-someone", github: unset, configuration: unset },
			]);
		});

		it("does not change the board's own environment", async () => {
			const { root, holds } = machine();
			holds("someone");
			vi.stubEnv("GH_TOKEN", "the-boards-own");
			const tool = scriptedTool(root);
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");

			expect(tool.reads()[0]?.gh).toBe("token-of-someone");
			expect(process.env.GH_TOKEN).toBe("the-boards-own");
			expect(process.env.GH_CONFIG_DIR).toBeUndefined();
		});

		it("does not change the active login", async () => {
			const { root, asked, holds } = machine();
			holds("someone");
			const reads = board(root, scriptedTool(root).path);

			await reads.refresh("work", "one");

			expect(lines(asked).filter((line) => /^auth switch/.test(line))).toEqual(
				[],
			);
		});

		it("keeps the token out of what the project holds and shows", async () => {
			const { root, holds } = machine();
			holds("someone");
			const reads = board(root, scriptedTool(root).path);

			await reads.refresh("work", "one");

			expect(JSON.stringify(get(reads))).not.toContain("token-of-someone");
			expect(page(reads)).not.toContain("token-of-someone");
			expect(overview(reads)).not.toContain("token-of-someone");
		});

		it("reports nothing about the account", async () => {
			const { root, holds } = machine();
			holds("someone");
			const reads = board(root, scriptedTool(root).path);

			await reads.refresh("work", "one");

			const state = held(reads);
			expect(state.document).toEqual(fullDocument);
			expect(state.latest).toBeUndefined();
		});
	});

	describe("Two workspaces, two accounts", () => {
		it("gives each read the token of its own workspace's account", async () => {
			const { root, holds } = machine();
			holds("first");
			holds("second");
			const toolPath = join(root, "project-is-token");
			writeFileSync(
				toolPath,
				`printf '%s' '${JSON.stringify({ ...fullDocument, project: "TOKEN" })}' | sed "s/TOKEN/$GH_TOKEN/"\n`,
				{ mode: 0o644 },
			);
			const reads = createReads(settings(root, { a: "first", b: "second" }), {
				toolPath,
				limitMs: 10_000,
				graceMs: 200,
			});
			running.push(reads);

			await Promise.all([reads.refresh("a"), reads.refresh("b")]);

			expect(held(reads, "a").document.project).toBe("token-of-first");
			expect(held(reads, "b").document.project).toBe("token-of-second");
		});
	});

	describe("Asked for each read", () => {
		it("asks gh for the token twice", async () => {
			const { root, asked, holds } = machine();
			holds("someone");
			const reads = board(root, scriptedTool(root).path);

			await reads.refresh("work", "one");
			await reads.refresh("work", "one");

			expect(tokenRequests(asked)).toEqual([
				"auth token --user someone",
				"auth token --user someone",
			]);
		});

		it("gives the second read the token gh then holds", async () => {
			const { root, holds } = machine();
			holds("someone", "before-a-login");
			const tool = scriptedTool(root);
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");
			holds("someone", "after-a-login");
			await reads.refresh("work", "one");

			expect(tool.reads().map((read) => read.gh)).toEqual([
				"before-a-login",
				"after-a-login",
			]);
		});
	});

	describe("No token", () => {
		it.each([
			["exits non-zero", "exit 1"],
			["prints nothing", "exit 0"],
			["prints only a line break", "echo; exit 0"],
		])("runs the tool with no login where gh %s", async (_name, answer) => {
			const { root } = machine();
			writeGh(
				root,
				`if [ "$1" = auth ]; then ${answer}; fi\nif ! mkdir -p "$GH_CONFIG_DIR" 2>/dev/null; then exit 1; fi\nexit 0`,
			);
			vi.stubEnv("GH_TOKEN", "the-boards-own");
			vi.stubEnv("GITHUB_TOKEN", "also-the-boards-own");
			const tool = scriptedTool(root);
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");

			expect(tool.reads()).toEqual([
				{ gh: unset, github: unset, configuration: unusableConfiguration },
			]);
			const state = held(reads);
			expect(state.document).toMatchObject({
				forge: "none",
				no_token_for: "someone",
			});
			expect(process.env.GH_TOKEN).toBe("the-boards-own");
			expect(process.env.GITHUB_TOKEN).toBe("also-the-boards-own");
		});

		it("gives the carried tool a gh that cannot use a login, so forge is none", async () => {
			const { root, env } = machine();
			vi.stubEnv("GH_TOKEN", "the-boards-own");
			vi.stubEnv("GITHUB_TOKEN", "also-the-boards-own");
			const project = join(root, "one");
			buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
			const reads = board(root, carriedTool, {
				limitMs: 20_000,
				graceMs: 500,
			});

			await reads.refresh("work", "one");

			expect(held(reads).document).toMatchObject({
				schema_version: 1,
				forge: "none",
				no_token_for: "someone",
			});
		});

		it("reads forge full through the same gh with a token, so that test can fail", async () => {
			const { root, env, holds } = machine();
			holds("someone");
			const project = join(root, "one");
			buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
			const reads = board(root, carriedTool, {
				limitMs: 20_000,
				graceMs: 500,
			});

			await reads.refresh("work", "one");

			expect(held(reads).document).toMatchObject({ forge: "full" });
			expect(held(reads).document).not.toHaveProperty("no_token_for");
		});

		it("holds the account's name as a line of what the document missed", async () => {
			const { root } = machine();
			const reads = board(root, scriptedTool(root).path);

			await reads.refresh("work", "one");

			expect(
				missedBy(held(reads).document).filter((line) =>
					line.includes("someone"),
				),
			).toHaveLength(1);
		});

		it("keeps what gh wrote on standard error out of every reason", async () => {
			const { root } = machine();
			writeGh(root, "echo 'leaked-secret' >&2\nexit 1");
			const tool = scriptedTool(root);
			tool.fails();
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");

			expect(JSON.stringify(get(reads))).not.toContain("leaked-secret");
		});
	});

	describe("Without gh", () => {
		it("reads with forge none, and the project holds the account's name", async () => {
			const { root } = machine();
			const tool = scriptedTool(root);
			const reads = board(root, tool.path);
			vi.stubEnv("PATH", pathWithNoGh(root));

			await reads.refresh("work", "one");

			expect(held(reads).document).toMatchObject({
				forge: "none",
				no_token_for: "someone",
			});
			expect(tool.reads()).toEqual([
				{ gh: unset, github: unset, configuration: unusableConfiguration },
			]);
		});
	});

	describe("A token that does not come", () => {
		it.each([
			["ends on being stopped", ""],
			["ignores being stopped", "trap '' TERM"],
		])(
			"stops a gh that %s, starts no tool, and fails naming the account and the limit",
			async (_name, before) => {
				const { root } = machine();
				const pid = ghThatDoesNotAnswer(root, before);
				const tool = scriptedTool(root);
				const limitMs = 500;
				const graceMs = 300;
				const reads = board(root, tool.path, { limitMs, graceMs });

				const started = Date.now();
				await reads.refresh("work", "one");
				const elapsed = Date.now() - started;

				const reason = failedReason(reads);
				expect(reason).toContain("someone");
				expect(reason).toMatch(/limit|timed? ?out/i);
				expect(reason.startsWith("no token for GitHub account someone: ")).toBe(
					true,
				);
				expect(tool.reads()).toEqual([]);
				expect(elapsed).toBeLessThan(limitMs + graceMs + 1000);
				const gh = pidIn(pid);
				await waitUntil(() => !isRunning(gh));
			},
		);

		it("takes the time gh took out of the tool's limit", async () => {
			const { root } = machine();
			writeGh(root, "sleep 1\necho token-of-someone");
			const toolPath = join(root, "hanging-tool");
			writeFileSync(toolPath, "exec sleep 60\n", { mode: 0o644 });
			const limitMs = 1500;
			const graceMs = 200;
			const reads = board(root, toolPath, { limitMs, graceMs });

			const started = Date.now();
			await reads.refresh("work", "one");
			const elapsed = Date.now() - started;

			expect(failedReason(reads)).toMatch(/limit|timed? ?out/i);
			expect(elapsed).toBeLessThan(limitMs + graceMs + 600);
		});
	});

	describe("No token, and the tool fails", () => {
		it("keeps the document, and the latest reason names the account and the tool's reason", async () => {
			const { root, holds, loses } = machine();
			holds("someone");
			const tool = scriptedTool(root);
			const reads = board(root, tool.path);
			await reads.refresh("work", "one");
			const before = held(reads);

			loses("someone");
			tool.fails();
			await reads.refresh("work", "one");

			const state = held(reads);
			expect(state.document).toEqual(before.document);
			expect(state.latest?.reason).toMatch(
				/^no token for GitHub account someone: .*refused/,
			);
		});

		it("fails with the same reason where no document is held", async () => {
			const { root } = machine();
			const tool = scriptedTool(root);
			tool.fails();
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");

			expect(failedReason(reads)).toMatch(
				/^no token for GitHub account someone: .*refused/,
			);
		});

		it("does not name the account where a token came and the tool failed", async () => {
			const { root, holds } = machine();
			holds("someone");
			const tool = scriptedTool(root);
			tool.fails();
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");

			expect(failedReason(reads)).not.toContain("someone");
		});
	});

	describe("Stopping while a token is taken", () => {
		it("stops gh, and no tool is started", async () => {
			const { root } = machine();
			const pid = ghThatDoesNotAnswer(root);
			const tool = scriptedTool(root);
			const reads = board(root, tool.path, {
				limitMs: 20_000,
				graceMs: 200,
			});

			const finished = reads.start();
			await waitUntil(() => holdsPid(pid));
			const gh = pidIn(pid);
			await reads.stop();
			await finished;

			await waitUntil(() => !isRunning(gh));
			expect(tool.reads()).toEqual([]);
		});
	});

	describe("No account", () => {
		it("does not ask gh for a token, and the tool sees the same GH_TOKEN", async () => {
			const { root, asked } = machine();
			vi.stubEnv("GH_TOKEN", "the-boards-own");
			vi.stubEnv("GITHUB_TOKEN", "also-the-boards-own");
			const tool = scriptedTool(root);
			const noAccount = createReads(settings(root, { work: undefined }), {
				toolPath: tool.path,
				limitMs: 10_000,
				graceMs: 200,
			});
			running.push(noAccount);

			await noAccount.refresh("work", "one");

			expect(tokenRequests(asked)).toEqual([]);
			expect(tool.reads()).toEqual([
				{
					gh: "the-boards-own",
					github: "also-the-boards-own",
					configuration: unset,
				},
			]);
			expect(held(noAccount).document).not.toHaveProperty("no_token_for");
		});
	});
});

describe("A page names an account it could not use", () => {
	describe("No token, nothing held before", () => {
		it("names the account and says statuses may be wrong on its page and overview", async () => {
			const { root } = machine();
			const reads = board(root, scriptedTool(root).path);

			await reads.refresh("work", "one");

			for (const text of [textOf(page(reads)), textOf(overview(reads))]) {
				expect(text).toContain("someone");
				expect(text).toMatch(/statuses may be wrong/i);
			}
		});
	});

	describe("No token, a full document held", () => {
		it("keeps the document, and the latest read names the account", async () => {
			const { root, holds, loses } = machine();
			holds("someone");
			const reads = board(root, scriptedTool(root).path);
			await reads.refresh("work", "one");
			const before = held(reads);

			loses("someone");
			await reads.refresh("work", "one");

			const state = held(reads);
			expect(state.document).toEqual(before.document);
			expect(state.readAt).toEqual(before.readAt);
			expect(state.latest?.missed?.join("\n")).toContain("someone");
			expect(textOf(page(reads))).toContain("someone");
		});
	});

	describe("No token, and the read failed", () => {
		it("shows the reason, naming the account, on its page and overview", async () => {
			const { root } = machine();
			const tool = scriptedTool(root);
			tool.fails();
			const reads = board(root, tool.path);

			await reads.refresh("work", "one");

			for (const text of [textOf(page(reads)), textOf(overview(reads))]) {
				expect(text).toContain("someone");
				expect(text).toContain("refused");
			}
		});
	});

	describe("A token again", () => {
		it("names no account after a later full read", async () => {
			const { root, holds } = machine();
			const reads = board(root, scriptedTool(root).path);
			await reads.refresh("work", "one");
			expect(textOf(page(reads))).toContain("someone");

			holds("someone");
			await reads.refresh("work", "one");

			expect(held(reads).document.forge).toBe("full");
			expect(held(reads).latest).toBeUndefined();
			expect(textOf(page(reads))).not.toContain("someone");
		});
	});
});
