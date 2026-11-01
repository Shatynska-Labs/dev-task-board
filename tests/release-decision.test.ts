import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const decisionScript = join(repositoryRoot, "tools", "release-decision.mjs");

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function reports(version: string): string {
	return `printf '%s\\n' '${version}'\n`;
}

function failsWith(code: string): string {
	return `echo 'npm error code ${code}' >&2\nexit 1\n`;
}

function stubNpm(directory: string, behaviour: string): string {
	const calls = join(directory, "npm-calls");
	writeFileSync(
		join(directory, "npm"),
		[
			"#!/bin/sh",
			`printf '%s\\n' "$*" >> '${calls}'`,
			'if [ "$*" != "view dev-task-board version" ]; then',
			`  echo "npm stub: unexpected arguments: $*" >&2`,
			"  exit 64",
			"fi",
			behaviour,
		].join("\n"),
		{ mode: 0o755 },
	);
	return calls;
}

function runDecision(packageVersion: string, behaviour: string) {
	// Without this a missing script would satisfy every "exits non-zero" scenario.
	expect(existsSync(decisionScript)).toBe(true);

	const directory = realpathSync(
		mkdtempSync(join(tmpdir(), "dev-task-board-release-")),
	);
	temporaryDirectories.push(directory);
	writeFileSync(
		join(directory, "package.json"),
		JSON.stringify({ name: "dev-task-board", version: packageVersion }),
	);
	const calls = stubNpm(directory, behaviour);

	const result = spawnSync(process.execPath, [decisionScript], {
		cwd: directory,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${directory}${delimiter}${process.env.PATH ?? ""}`,
		},
	});

	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
		askedTheRegistry: existsSync(calls) && readFileSync(calls, "utf8") !== "",
	};
}

describe("A release is decided against the registry", () => {
	describe("The package is not on the registry", () => {
		it("prints publish=false, writes a notice to standard error, and exits zero", () => {
			const result = runDecision("0.1.0", failsWith("E404"));

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe("publish=false");
			expect(result.stderr.trim()).not.toBe("");
		});
	});

	describe("The version is unchanged", () => {
		it("prints publish=false and exits zero", () => {
			const result = runDecision("0.1.0", reports("0.1.0"));

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe("publish=false");
		});
	});

	describe("The version is raised", () => {
		it.each([
			["0.10.0", "0.9.0"],
			["0.1.10", "0.1.9"],
			["10.0.0", "9.0.0"],
			["0.1.1", "0.1.0"],
			["0.2.0", "0.1.9"],
			["1.0.0", "0.9.9"],
		])("publishes %s over %s", (packageVersion, registryVersion) => {
			const result = runDecision(packageVersion, reports(registryVersion));

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe("publish=true");
		});
	});

	describe("The version is lowered", () => {
		it.each([
			["0.1.0", "0.2.0"],
			["0.9.0", "0.10.0"],
			["0.1.9", "0.1.10"],
			["0.9.9", "1.0.0"],
		])("fails with %s against %s", (packageVersion, registryVersion) => {
			const result = runDecision(packageVersion, reports(registryVersion));

			expect(result.askedTheRegistry).toBe(true);
			expect(result.status).not.toBe(0);
			expect(result.stdout).not.toMatch(/^publish=/m);
		});
	});

	describe("A version of another form", () => {
		it.each([
			["0.1.0-beta.1", "the registry reports a version", reports("0.1.0")],
			["0.1", "the registry reports a version", reports("0.1.0")],
			["1.2.3.4", "the registry reports a version", reports("0.1.0")],
			["0.1.0-beta.1", "the package is not on the registry", failsWith("E404")],
		])("fails for %s where %s", (packageVersion, _name, behaviour) => {
			const result = runDecision(packageVersion, behaviour);

			expect(result.status).not.toBe(0);
			expect(result.stdout).not.toMatch(/^publish=/m);
		});

		it("fails where the registry's version is of another form", () => {
			const result = runDecision("0.1.0", reports("0.1.0-beta.1"));

			expect(result.askedTheRegistry).toBe(true);
			expect(result.status).not.toBe(0);
			expect(result.stdout).not.toMatch(/^publish=/m);
		});
	});

	describe("The registry cannot be read", () => {
		it.each(["ETIMEDOUT", "E403", "E500"])("fails on %s", (code) => {
			const result = runDecision("0.1.0", failsWith(code));

			expect(result.askedTheRegistry).toBe(true);
			expect(result.status).not.toBe(0);
			expect(result.stdout).not.toMatch(/^publish=/m);
		});
	});
});
