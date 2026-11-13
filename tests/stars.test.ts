// Tests derived from the delta spec of `star-workstreams`
// (openspec/changes/star-workstreams/specs/workstream-stars/spec.md), at the
// level of `src/stars.ts` as design.md D10 names it. Each assertion's
// classification is in that change's test-plan.md.
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadStars, starsPath } from "../src/stars.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

const home = "/home/someone";

// A stars file's path whose directories do not exist yet.
function freshPath(): string {
	return join(temporaryDirectory(), "state", "dev-task-board", "stars.json");
}

function writtenFile(text: string): string {
	const path = freshPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, text);
	return path;
}

function held(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function names(set: Set<string>): string[] {
	return [...set].sort();
}

// loadStars may answer at once or with a promise; either refusal counts.
async function expectRefused(path: string): Promise<Error> {
	let caught: unknown;
	try {
		await loadStars(path);
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(Error);
	return caught as Error;
}

afterEach(removeTemporaryDirectories);

describe("Stars are kept on this machine", () => {
	describe("The state directory from the environment", () => {
		it("is $XDG_STATE_HOME/dev-task-board/stars.json where XDG_STATE_HOME is /s", () => {
			expect(starsPath({ XDG_STATE_HOME: "/s" }, home)).toBe(
				"/s/dev-task-board/stars.json",
			);
		});

		it("is ~/.local/state/dev-task-board/stars.json where XDG_STATE_HOME is unset", () => {
			expect(starsPath({}, home)).toBe(
				"/home/someone/.local/state/dev-task-board/stars.json",
			);
		});

		it("is ~/.local/state/dev-task-board/stars.json where XDG_STATE_HOME is empty", () => {
			expect(starsPath({ XDG_STATE_HOME: "" }, home)).toBe(
				"/home/someone/.local/state/dev-task-board/stars.json",
			);
		});
	});

	describe("No file", () => {
		it("loads a missing file as no stars", async () => {
			const stars = await loadStars(freshPath());

			expect(names(stars.starred("/p/one"))).toEqual([]);
		});
	});

	describe("Stars survive a restart", () => {
		it("holds alpha of /p/one starred when loaded again from the same file", async () => {
			const path = freshPath();
			const before = await loadStars(path);
			await before.set("/p/one", "alpha", true);

			const after = await loadStars(path);

			expect(names(after.starred("/p/one"))).toEqual(["alpha"]);
		});
	});

	describe("The file's content", () => {
		it("holds beta then alpha, starred, as one sorted list, creating the directory", async () => {
			const path = freshPath();
			const stars = await loadStars(path);

			await stars.set("/p/one", "beta", true);
			await stars.set("/p/one", "alpha", true);

			expect(held(path)).toEqual({
				version: 1,
				stars: { "/p/one": ["alpha", "beta"] },
			});
		});

		it("shows the stars it has set as starred", async () => {
			const stars = await loadStars(freshPath());

			await stars.set("/p/one", "beta", true);
			await stars.set("/p/one", "alpha", true);

			expect(names(stars.starred("/p/one"))).toEqual(["alpha", "beta"]);
			expect(names(stars.starred("/p/two"))).toEqual([]);
		});
	});

	describe("The last star of a project cleared", () => {
		it("leaves no key /p/one once its only star is cleared", async () => {
			const path = writtenFile(
				JSON.stringify({ version: 1, stars: { "/p/one": ["alpha"] } }),
			);
			const stars = await loadStars(path);

			await stars.set("/p/one", "alpha", false);

			const file = held(path) as { version: number; stars: object };
			expect(file.version).toBe(1);
			expect(Object.keys(file.stars)).not.toContain("/p/one");
			expect(names(stars.starred("/p/one"))).toEqual([]);
		});
	});

	describe("Overlapping sets", () => {
		it("keeps both alpha and beta when they are set at once", async () => {
			const path = freshPath();
			const stars = await loadStars(path);

			await Promise.all([
				stars.set("/p/one", "alpha", true),
				stars.set("/p/one", "beta", true),
			]);

			expect(held(path)).toEqual({
				version: 1,
				stars: { "/p/one": ["alpha", "beta"] },
			});
			expect(names(stars.starred("/p/one"))).toEqual(["alpha", "beta"]);
			expect(names((await loadStars(path)).starred("/p/one"))).toEqual([
				"alpha",
				"beta",
			]);
		});
	});

	describe("A star that cannot be saved", () => {
		it("rejects the set and holds the star unchanged where the directory cannot be written", async (context) => {
			if (process.getuid?.() === 0) {
				context.skip();
			}
			const directory = join(temporaryDirectory(), "read-only");
			mkdirSync(directory);
			const path = join(directory, "stars.json");
			const stars = await loadStars(path);
			chmodSync(directory, 0o555);
			try {
				await expect(stars.set("/p/one", "alpha", true)).rejects.toThrow();

				expect(names(stars.starred("/p/one"))).toEqual([]);
				expect(existsSync(path)).toBe(false);
			} finally {
				chmodSync(directory, 0o755);
			}
		});
	});
});

describe("A bad stars file refuses the start", () => {
	describe("Not JSON", () => {
		it("refuses {not json, naming the file, and leaves it unchanged", async () => {
			const path = writtenFile("{not json");

			const error = await expectRefused(path);

			expect(error.message).toContain(path);
			expect(readFileSync(path, "utf8")).toBe("{not json");
		});
	});

	describe("Not a list of names", () => {
		it('refuses {"/p/one": "alpha"}, naming the file', async () => {
			const path = writtenFile(
				JSON.stringify({ version: 1, stars: { "/p/one": "alpha" } }),
			);

			expect((await expectRefused(path)).message).toContain(path);
		});

		it.each([
			["stars an array", { version: 1, stars: [] }],
			["a name not a string", { version: 1, stars: { "/p/one": [1] } }],
			["no stars", { version: 1 }],
			["not an object", [1]],
		])("refuses %s, naming the file", async (_name, content) => {
			const path = writtenFile(JSON.stringify(content));

			expect((await expectRefused(path)).message).toContain(path);
		});
	});

	describe("Another version", () => {
		it("refuses version 2, naming the file and the version", async () => {
			const path = writtenFile(JSON.stringify({ version: 2, stars: {} }));

			const { message } = await expectRefused(path);

			expect(message).toContain(path);
			const rest = message.split(path).join(" ");
			expect(rest).toMatch(/version/i);
			expect(rest).toMatch(/\b2\b/);
		});
	});

	describe("A file that cannot be read", () => {
		it("refuses a stars.json that is a directory, naming it", async () => {
			const path = freshPath();
			mkdirSync(path, { recursive: true });

			expect((await expectRefused(path)).message).toContain(path);
		});
	});

	describe("A hand edit out of order", () => {
		it("accepts repeats, disorder and an empty list, and the next write normalises them", async () => {
			const path = writtenFile(
				JSON.stringify({
					version: 1,
					stars: { "/p/one": ["beta", "alpha", "beta"], "/p/two": [] },
				}),
			);
			const stars = await loadStars(path);

			await stars.set("/p/one", "gamma", true);

			expect(held(path)).toEqual({
				version: 1,
				stars: { "/p/one": ["alpha", "beta", "gamma"] },
			});
		});
	});
});
