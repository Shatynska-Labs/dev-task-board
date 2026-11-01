import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildFixtureRepository,
	git,
	isolatedEnvironment,
} from "./support/fixture.js";

vi.setConfig({ testTimeout: 30_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const carriedTool = join(repositoryRoot, "vendor", "task-board");

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
	const directory = realpathSync(
		mkdtempSync(join(tmpdir(), "dev-task-board-tool-")),
	);
	temporaryDirectories.push(directory);
	return directory;
}

function runCarriedTool(fixture: string, cwd: string, env: NodeJS.ProcessEnv) {
	return spawnSync("bash", [carriedTool, "--json", fixture], {
		cwd,
		env,
		encoding: "utf8",
	});
}

function holdsFullCommit(text: string): boolean {
	return /(?<![0-9a-fA-F])[0-9a-fA-F]{40}(?![0-9a-fA-F])/.test(text);
}

afterEach(() => {
	vi.unstubAllEnvs();
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("The carried tool works and names its source", () => {
	describe("Source record", () => {
		it("holds a 40-character hexadecimal commit", () => {
			const text = readFileSync(
				join(repositoryRoot, "vendor", "task-board.source"),
				"utf8",
			);

			expect(holdsFullCommit(text)).toBe(true);
		});
	});

	describe("the check above, over material chosen to falsify it", () => {
		it("accepts a full commit", () => {
			expect(holdsFullCommit(`${"a1".repeat(20)}\n`)).toBe(true);
		});

		it.each([
			["an abbreviated commit", "2cc5bd8\n"],
			["a run longer than a commit", `${"a".repeat(41)}\n`],
			["forty characters that are not hexadecimal", `${"g".repeat(40)}\n`],
			["an empty record", ""],
		])("rejects %s", (_name, text) => {
			expect(holdsFullCommit(text)).toBe(false);
		});
	});

	describe("Reading a project", () => {
		it.each(["docs/backlog/AGENTS.md", "docs/workstreams/AGENTS.md"])(
			"produces one document of schema_version 1 for a project holding %s",
			(committedFile) => {
				const root = temporaryDirectory();
				const env = isolatedEnvironment(root);
				const fixture = join(root, "fixture-project");
				buildFixtureRepository(fixture, env, committedFile);

				const result = runCarriedTool(fixture, root, env);

				expect(result.status).toBe(0);
				const document = JSON.parse(result.stdout) as {
					schema_version: unknown;
					project: unknown;
				};
				expect(document.schema_version).toBe(1);
				expect(document.project).toBe(basename(fixture));
			},
		);
	});

	describe("A repository the tool cannot read", () => {
		it("exits 2 with nothing on standard output", () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const fixture = join(root, "fixture-project");
			buildFixtureRepository(fixture, env, "README.md");

			const result = runCarriedTool(fixture, root, env);

			expect(result.status).toBe(2);
			expect(result.stdout).toBe("");
		});
	});
});

describe("Fixtures are isolated from the surrounding Git", () => {
	it("leaves a repository named by a surrounding GIT_DIR unchanged", () => {
		const root = temporaryDirectory();
		const env = isolatedEnvironment(root);
		const surrounding = join(root, "surrounding");
		buildFixtureRepository(surrounding, env, "README.md");
		const before = git(surrounding, env, "rev-parse", "HEAD");
		vi.stubEnv("GIT_DIR", join(surrounding, ".git"));
		vi.stubEnv("GIT_WORK_TREE", surrounding);

		const isolated = isolatedEnvironment(root);
		const fixture = join(root, "fixture-project");
		buildFixtureRepository(fixture, isolated, "README.md");

		expect(
			Object.keys(isolated).filter((name) => name.startsWith("GIT_")),
		).toEqual([]);
		expect(git(surrounding, env, "rev-parse", "HEAD")).toBe(before);
		expect(git(fixture, isolated, "rev-list", "--count", "HEAD").trim()).toBe(
			"1",
		);
	});
});
