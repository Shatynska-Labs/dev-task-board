import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSettings, SettingsError } from "../src/settings.js";
import { isolatedEnvironment } from "./support/fixture.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

const home = "/home/someone";
const everyPathADirectory = { home, isDirectory: () => true };

function workspace(name: string, field: string): string {
	return `[workspaces.${name}]\nprojects = ["/srv/root/one"]\n${field}\n`;
}

function refusal(text: string): Error {
	try {
		parseSettings(text, everyPathADirectory);
	} catch (error) {
		expect(error).toBeInstanceOf(SettingsError);
		return error as Error;
	}
	throw new Error("the settings were accepted");
}

afterEach(() => {
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("Bad settings refuse the start", () => {
	describe("A github account", () => {
		it.each([
			["empty", 'github_account = ""'],
			["a number", "github_account = 1"],
			["a boolean", "github_account = true"],
			["a list", 'github_account = ["someone"]'],
			["a table", 'github_account = { name = "someone" }'],
		])(
			"refuses one that is %s, naming the workspace and the field",
			(_name, field) => {
				const error = refusal(workspace("desk", field));

				expect(error.message).toContain("desk");
				expect(error.message).toContain("github_account");
			},
		);

		it.each([
			["empty", 'github_account = ""'],
			["a number", "github_account = 1"],
		])("does not call one that is %s unsupported", (_name, field) => {
			const error = refusal(workspace("desk", field));

			expect(error.message).not.toMatch(/not yet supported/i);
		});

		it("is checked ahead of the projects", () => {
			const error = refusal(
				'[workspaces.desk]\nprojects = ["relative/path"]\ngithub_account = ""\n',
			);

			expect(error.message).toContain("github_account");
		});
	});
});

describe("A workspace may name a GitHub account", () => {
	describe("With an account", () => {
		it("holds that account", () => {
			const [read] = parseSettings(
				workspace("desk", 'github_account = "someone"'),
				everyPathADirectory,
			);

			expect(Object.values(read as object)).toContain("someone");
		});

		it("reads it as given", () => {
			const [read] = parseSettings(
				workspace("desk", 'github_account = "  Some.One  "'),
				everyPathADirectory,
			);

			expect(Object.values(read as object)).toContain("  Some.One  ");
		});

		it("keeps each workspace's account apart from another's", () => {
			const [first, second] = parseSettings(
				workspace("a", 'github_account = "first"') +
					workspace("b", 'github_account = "second"'),
				everyPathADirectory,
			);

			expect(Object.values(first as object)).toContain("first");
			expect(Object.values(second as object)).toContain("second");
		});

		it("does not ask gh whether it holds the account", () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const asked = join(root, "asked");
			writeFileSync(
				join(root, "stubs", "gh"),
				`#!/bin/sh\necho "$*" >> '${asked}'\nexit 1\n`,
				{ mode: 0o755 },
			);
			vi.stubEnv("PATH", env.PATH);

			const [read] = parseSettings(
				workspace("desk", 'github_account = "someone"'),
				everyPathADirectory,
			);

			expect(Object.values(read as object)).toContain("someone");
			expect(existsSync(asked)).toBe(false);
		});
	});

	describe("Without an account", () => {
		it("holds no account", () => {
			const [read] = parseSettings(
				'[workspaces.desk]\nprojects = ["/srv/root/one"]\n',
				everyPathADirectory,
			);

			expect(read).toEqual({
				name: "desk",
				projects: [{ name: "one", path: "/srv/root/one" }],
			});
		});
	});
});
