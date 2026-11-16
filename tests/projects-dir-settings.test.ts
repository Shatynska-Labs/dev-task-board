// Derived from the change `write-the-settings`, settings delta: "Settings name
// workspaces and their projects" and "Bad settings refuse the start" as
// modified. Each assertion's classification is in that change's test-plan.md.
// parseSettings(text, { home, isDirectory }) is the signature the existing
// tests use; that `~/projects` is taken from `home` is an assumption recorded
// in test-plan.md.
import { describe, expect, it } from "vitest";
import { parseSettings, SettingsError } from "../src/settings.js";

const home = "/home/someone";
const root = "/srv/root";

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".
function directories(...paths: string[]) {
	const known = new Set(paths);
	return { home, isDirectory: (path: string) => known.has(path) };
}

const everyPathADirectory = { home, isDirectory: () => true };

function workspace(name: string, projects: string[]): string {
	return `[workspaces.${JSON.stringify(name)}]\nprojects = ${JSON.stringify(projects)}\n`;
}

function refusal(
	text: string,
	options: Parameters<typeof parseSettings>[1] = everyPathADirectory,
): Error {
	try {
		parseSettings(text, options);
	} catch (error) {
		expect(error).toBeInstanceOf(SettingsError);
		return error as Error;
	}
	throw new Error("the settings were accepted");
}

describe("Settings name workspaces and their projects", () => {
	describe("A name in the projects folder", () => {
		it("holds project one at ~/projects/group/one where no projects_dir is given", () => {
			const { workspaces } = parseSettings(
				workspace("work", ["group/one"]),
				directories(`${home}/projects`, `${home}/projects/group/one`),
			);

			expect(workspaces).toHaveLength(1);
			expect(workspaces[0]?.name).toBe("work");
			expect(workspaces[0]?.projects).toEqual([
				{ name: "one", path: `${home}/projects/group/one` },
			]);
		});
	});

	describe("Another projects folder", () => {
		it("holds project one at <root>/code/one where projects_dir is <root>/code", () => {
			const { workspaces } = parseSettings(
				`projects_dir = "${root}/code"\n${workspace("work", ["one"])}`,
				directories(`${root}/code`, `${root}/code/one`),
			);

			expect(workspaces[0]?.projects).toEqual([
				{ name: "one", path: `${root}/code/one` },
			]);
		});

		it("expands a projects_dir beginning ~/", () => {
			const { workspaces } = parseSettings(
				`projects_dir = "~/code"\n${workspace("work", ["one"])}`,
				directories(`${home}/code`, `${home}/code/one`),
			);

			expect(workspaces[0]?.projects).toEqual([
				{ name: "one", path: `${home}/code/one` },
			]);
		});

		it("still reads absolute and ~/ paths beside names", () => {
			const { workspaces } = parseSettings(
				`projects_dir = "${root}/code"\n${workspace("work", ["one", `${root}/b/two`, "~/c/three"])}`,
				directories(
					`${root}/code`,
					`${root}/code/one`,
					`${root}/b/two`,
					`${home}/c/three`,
				),
			);

			expect(workspaces[0]?.projects).toEqual([
				{ name: "one", path: `${root}/code/one` },
				{ name: "two", path: `${root}/b/two` },
				{ name: "three", path: `${home}/c/three` },
			]);
		});
	});

	describe("One project in two workspaces", () => {
		it("holds project one at that path in both a and b", () => {
			const { workspaces } = parseSettings(
				workspace("a", ["group/one"]) + workspace("b", ["group/one"]),
				directories(`${home}/projects`, `${home}/projects/group/one`),
			);

			expect(workspaces.map((each) => each.name)).toEqual(["a", "b"]);
			for (const each of workspaces) {
				expect(each.projects).toEqual([
					{ name: "one", path: `${home}/projects/group/one` },
				]);
			}
		});
	});

	describe("Empty", () => {
		it("holds workspace work with no projects where its projects is empty", () => {
			const { workspaces } = parseSettings(
				workspace("work", []),
				everyPathADirectory,
			);

			expect(workspaces).toHaveLength(1);
			expect(workspaces[0]?.name).toBe("work");
			expect(workspaces[0]?.projects).toEqual([]);
		});

		it("holds no workspace where the file names none", () => {
			const { workspaces } = parseSettings("", everyPathADirectory);

			expect(workspaces).toEqual([]);
		});

		it("holds no workspace where the file holds only top-level keys", () => {
			const { workspaces } = parseSettings(
				`port = 8800\nprojects_dir = "${root}/code"\n`,
				directories(),
			);

			expect(workspaces).toEqual([]);
		});
	});
});

describe("Bad settings refuse the start", () => {
	describe("A reserved name", () => {
		it.each(["api", "settings"])(
			"refuses a workspace named %s, naming it",
			(name) => {
				const error = refusal(workspace(name, [`${root}/a/one`]));

				expect(error.message).toMatch(new RegExp(`\\b${name}\\b`));
			},
		);
	});

	describe("A project that does not exist", () => {
		it("refuses a name in the projects folder that is not a directory, naming it", () => {
			const error = refusal(
				workspace("work", ["group/missing"]),
				directories(`${home}/projects`),
			);

			expect(error.message).toContain("group/missing");
		});
	});

	describe("A name leaving the projects folder", () => {
		it.each(["../elsewhere", "group//one", "group/./one", "group/one/.."])(
			"refuses %s, naming it",
			(name) => {
				const error = refusal(workspace("work", [name]));

				expect(error.message).toContain(name);
			},
		);
	});

	describe("A bad projects folder", () => {
		it.each([
			["code", 'projects_dir = "code"\n'],
			["7", "projects_dir = 7\n"],
		])("refuses projects_dir as %s, naming projects_dir", (_name, line) => {
			const error = refusal(line + workspace("work", ["one"]));

			expect(error.message).toContain("projects_dir");
		});
	});
});
