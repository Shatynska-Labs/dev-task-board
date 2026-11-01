import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function listPackedFiles(): string[] {
	const output = execFileSync(
		"npm",
		["pack", "--dry-run", "--json", "--ignore-scripts"],
		{
			cwd: repositoryRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const [packed] = JSON.parse(output) as { files: { path: string }[] }[];
	if (packed === undefined) {
		throw new Error("npm pack reported no package");
	}
	return packed.files.map((file) => file.path);
}

function packageContentProblems(files: string[]): string[] {
	const required = [
		"dist/cli.js",
		"vendor/task-board",
		"vendor/task-board.source",
	];
	const forbidden = ["src/", "tests/", "tools/"];
	return [
		...required
			.filter((path) => !files.includes(path))
			.map((path) => `missing ${path}`),
		...files
			.filter((path) => forbidden.some((prefix) => path.startsWith(prefix)))
			.map((path) => `holds ${path}`),
	];
}

function beginsWithShebang(text: string): boolean {
	return text.split("\n")[0] === "#!/usr/bin/env node";
}

function namesRepository(packageJsonText: string): boolean {
	const manifest = JSON.parse(packageJsonText) as {
		repository?: { url?: unknown };
	};
	const url = manifest.repository?.url;
	return (
		typeof url === "string" &&
		/^(git\+)?https:\/\/github\.com\/Shatynska-Labs\/dev-task-board(\.git)?$/.test(
			url,
		)
	);
}

describe("The package holds what it runs", () => {
	describe("Contents of the packed package", () => {
		it("lists the command and the carried tool, and no sources, tests or tools", () => {
			expect(packageContentProblems(listPackedFiles())).toEqual([]);
		});

		it("begins dist/cli.js with the node shebang", () => {
			const text = readFileSync(join(repositoryRoot, "dist", "cli.js"), "utf8");

			expect(beginsWithShebang(text)).toBe(true);
		});
	});

	describe("the checks above, over material chosen to falsify them", () => {
		const complete = [
			"README.md",
			"dist/cli.js",
			"package.json",
			"vendor/task-board",
			"vendor/task-board.source",
		];

		it("accepts a complete list", () => {
			expect(packageContentProblems(complete)).toEqual([]);
		});

		it.each(["dist/cli.js", "vendor/task-board", "vendor/task-board.source"])(
			"reports a list without %s",
			(path) => {
				const files = complete.filter((file) => file !== path);

				expect(packageContentProblems(files)).toEqual([`missing ${path}`]);
			},
		);

		it.each(["src/cli.ts", "tests/cli.test.ts", "tools/release-decision.mjs"])(
			"reports a list holding %s",
			(path) => {
				expect(packageContentProblems([...complete, path])).toEqual([
					`holds ${path}`,
				]);
			},
		);

		it("tells a shebang from a file that only mentions one", () => {
			expect(beginsWithShebang("#!/usr/bin/env node\nexport {};\n")).toBe(true);
			expect(beginsWithShebang("// #!/usr/bin/env node\n")).toBe(false);
			expect(beginsWithShebang("\n#!/usr/bin/env node\n")).toBe(false);
			expect(beginsWithShebang("#!/usr/bin/env nodejs\n")).toBe(false);
		});
	});
});

describe("The package names its repository", () => {
	describe("Repository field", () => {
		it("names Shatynska-Labs/dev-task-board in repository.url", () => {
			const text = readFileSync(join(repositoryRoot, "package.json"), "utf8");

			expect(namesRepository(text)).toBe(true);
		});
	});

	describe("the check above, over material chosen to falsify it", () => {
		it.each([
			"https://github.com/Shatynska-Labs/dev-task-board",
			"git+https://github.com/Shatynska-Labs/dev-task-board.git",
		])("accepts %s", (url) => {
			expect(namesRepository(JSON.stringify({ repository: { url } }))).toBe(
				true,
			);
		});

		it.each([
			[
				"another owner",
				{ repository: { url: "https://github.com/someone/dev-task-board" } },
			],
			[
				"another repository",
				{
					repository: {
						url: "https://github.com/Shatynska-Labs/dev-task-board-fork",
					},
				},
			],
			["no repository", {}],
			["a repository with no url", { repository: {} }],
		])("rejects %s", (_name, manifest) => {
			expect(namesRepository(JSON.stringify(manifest))).toBe(false);
		});
	});
});
