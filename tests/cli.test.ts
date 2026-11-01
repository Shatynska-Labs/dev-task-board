import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const builtCommand = join(repositoryRoot, "dist", "cli.js");

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
	const directory = realpathSync(
		mkdtempSync(join(tmpdir(), "dev-task-board-cli-")),
	);
	temporaryDirectories.push(directory);
	return directory;
}

function runCommand(script: string, args: string[], cwd: string) {
	return spawnSync(process.execPath, [script, ...args], {
		cwd,
		encoding: "utf8",
	});
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("The command reports its version", () => {
	describe("Asked for its version", () => {
		it("prints the version in package.json and exits zero", () => {
			const { version } = JSON.parse(
				readFileSync(join(repositoryRoot, "package.json"), "utf8"),
			) as { version: string };

			const result = runCommand(
				builtCommand,
				["--version"],
				temporaryDirectory(),
			);

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe(version);
		});

		it("reads the package.json beside dist/, not a copy of the version and not the working directory's", () => {
			const root = temporaryDirectory();
			const packageRoot = join(root, "package");
			const elsewhere = join(root, "elsewhere");
			mkdirSync(packageRoot);
			mkdirSync(elsewhere);
			cpSync(join(repositoryRoot, "dist"), join(packageRoot, "dist"), {
				recursive: true,
			});
			writeFileSync(
				join(packageRoot, "package.json"),
				JSON.stringify({ type: "module", version: "9.8.7" }),
			);
			writeFileSync(
				join(elsewhere, "package.json"),
				JSON.stringify({ version: "1.1.1" }),
			);

			const result = runCommand(
				join(packageRoot, "dist", "cli.js"),
				["--version"],
				elsewhere,
			);

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe("9.8.7");
		});
	});

	describe("Run with no supported argument", () => {
		const unsupported: [string, string[]][] = [
			["no arguments", []],
			["an unknown option", ["--unknown"]],
			["an unknown word", ["serve"]],
			["--version with something else", ["--version", "--unknown"]],
		];

		it.each(unsupported)("refuses %s", (_name, args) => {
			// Without this a missing build would satisfy the refusal: Node itself
			// exits non-zero with text on standard error and none on standard output.
			expect(existsSync(builtCommand)).toBe(true);

			const result = runCommand(builtCommand, args, temporaryDirectory());

			expect(result.status).not.toBe(0);
			expect(result.status).not.toBeNull();
			expect(result.stderr.trim()).not.toBe("");
			expect(result.stdout).toBe("");
			expect(result.stderr).not.toMatch(/^\s+at /m);
		});
	});
});
