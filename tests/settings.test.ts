import { describe, expect, it } from "vitest";
import { parseSettings, SettingsError, settingsPath } from "../src/settings.js";

const home = "/home/someone";
const root = "/srv/root";

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
	options: Parameters<typeof parseSettings>[1],
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
	describe("Where the file is", () => {
		it("is under XDG_CONFIG_HOME where that is set", () => {
			expect(settingsPath({ XDG_CONFIG_HOME: "/elsewhere" }, home)).toBe(
				"/elsewhere/dev-task-board/config.toml",
			);
		});

		it("is under ~/.config where XDG_CONFIG_HOME is unset", () => {
			expect(settingsPath({}, home)).toBe(
				`${home}/.config/dev-task-board/config.toml`,
			);
		});

		it("is under ~/.config where XDG_CONFIG_HOME is empty", () => {
			expect(settingsPath({ XDG_CONFIG_HOME: "" }, home)).toBe(
				`${home}/.config/dev-task-board/config.toml`,
			);
		});
	});

	describe("A valid file", () => {
		it("holds projects by base name, with ~/ expanded", () => {
			const settings = parseSettings(
				workspace("work", ["~/a/one", `${root}/b/two`]),
				directories(`${home}/a/one`, `${root}/b/two`),
			);

			expect(settings).toEqual([
				{
					name: "work",
					projects: [
						{ name: "one", path: `${home}/a/one` },
						{ name: "two", path: `${root}/b/two` },
					],
				},
			]);
		});

		it("takes the base name after normalising the path", () => {
			const settings = parseSettings(
				workspace("work", [`${root}/a/one/`, `${root}/b/x/../two`]),
				everyPathADirectory,
			);

			expect(settings).toEqual([
				{
					name: "work",
					projects: [
						{ name: "one", path: `${root}/a/one` },
						{ name: "two", path: `${root}/b/two` },
					],
				},
			]);
		});

		it("keeps several workspaces, which may share a base name", () => {
			const settings = parseSettings(
				workspace("a", [`${root}/a/one`]) + workspace("b", [`${root}/b/one`]),
				everyPathADirectory,
			);

			expect(settings.map((entry) => entry.name)).toEqual(["a", "b"]);
		});
	});
});

describe("Bad settings refuse the start", () => {
	describe("Faults of the file's shape", () => {
		it.each([
			["text that is not TOML", "[workspaces\n"],
			["no workspace", ""],
			["an empty workspaces table", "[workspaces]\n"],
			["workspaces that is not a table", "workspaces = 1\n"],
			["a missing projects", "[workspaces.work]\n"],
			["an empty projects", "[workspaces.work]\nprojects = []\n"],
			["a projects that is not a list", '[workspaces.work]\nprojects = "/a"\n'],
			["a projects of non-strings", "[workspaces.work]\nprojects = [1]\n"],
		])("refuses %s", (_name, text) => {
			refusal(text, everyPathADirectory);
		});

		it.each(["relative/path", "./relative", "~", "~someone/path"])(
			"refuses the relative path %s, naming it",
			(path) => {
				const error = refusal(workspace("work", [path]), everyPathADirectory);

				expect(error.message).toContain(path);
			},
		);
	});

	describe("Two projects of one name", () => {
		it("is refused, naming the base name", () => {
			const error = refusal(
				workspace("work", [`${root}/a/one`, `${root}/b/one`]),
				everyPathADirectory,
			);

			expect(error.message).toMatch(/\bone\b/);
		});

		it("is seen after normalising", () => {
			refusal(
				workspace("work", [`${root}/a/one/`, `${root}/b/x/../one`]),
				everyPathADirectory,
			);
		});
	});

	describe("A reserved name", () => {
		it("is refused, naming api", () => {
			const error = refusal(
				workspace("api", [`${root}/a/one`]),
				everyPathADirectory,
			);

			expect(error.message).toMatch(/\bapi\b/);
		});
	});

	describe("A name unusable in an address", () => {
		it("refuses a name holding a slash, naming it", () => {
			const error = refusal(
				workspace("a/b", [`${root}/a/one`]),
				everyPathADirectory,
			);

			expect(error.message).toContain("a/b");
		});

		it.each([".", "..", ""])("refuses the name '%s'", (name) => {
			refusal(workspace(name, [`${root}/a/one`]), everyPathADirectory);
		});
	});

	describe("Paths are checked before duplicates", () => {
		it("refuses as the missing path alone is refused", () => {
			const missing = `${root}/a/one`;
			const present = `${root}/b/one`;
			const options = directories(present);

			const alone = refusal(workspace("work", [missing]), options);
			const both = refusal(workspace("work", [missing, present]), options);

			expect(both.message).toContain(missing);
			expect(both.message).toBe(alone.message);
			expect(both.message).not.toContain(present);
		});
	});

	describe("A project with no usable name", () => {
		it("refuses /, naming the path", () => {
			const error = refusal(workspace("work", ["/"]), everyPathADirectory);

			expect(error.message).toContain("/");
		});

		it.each(["/.", "/a/.."])(
			"refuses %s, whose normal form has no base name",
			(path) => {
				refusal(workspace("work", [path]), everyPathADirectory);
			},
		);
	});

	describe("A project that does not exist", () => {
		it("is refused, naming the path", () => {
			const missing = `${root}/not/here`;

			const error = refusal(workspace("work", [missing]), directories());

			expect(error.message).toContain(missing);
		});

		it("names the expanded or written form of a ~/ path", () => {
			const error = refusal(workspace("work", ["~/not/here"]), directories());

			expect(error.message).toContain("not/here");
		});
	});
});
