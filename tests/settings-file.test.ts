// Edge cases of saving found in the code review of `write-the-settings`: a
// name on an object's prototype in the first save, and a link to a file not
// written yet.
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SaveRefused, settingsFile } from "../src/settings-file.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

afterEach(() => {
	removeTemporaryDirectories();
});

function fileIn(root: string) {
	const path = join(root, "config", "config.toml");
	return {
		path,
		file: settingsFile(path, { home: root, isDirectory: () => true }),
	};
}

describe("The first save", () => {
	it.each(["constructor", "toString"])(
		"adds a workspace named %s",
		async (name) => {
			const { path, file } = fileIn(temporaryDirectory());

			await file.save({ kind: "add_workspace", workspace: name });

			expect(readFileSync(path, "utf8")).toContain(`[workspaces.${name}]`);
		},
	);

	it("refuses a project added to __proto__, which no file holds", async () => {
		const { path, file } = fileIn(temporaryDirectory());

		await expect(
			file.save({ kind: "add", workspace: "__proto__", project: "one" }),
		).rejects.toBeInstanceOf(SaveRefused);
		expect(existsSync(path)).toBe(false);
	});
});

describe("A link to a file not written yet", () => {
	it("writes the link's target, and keeps the link", async () => {
		const root = temporaryDirectory();
		const { path, file } = fileIn(root);
		const target = join(root, "dotfiles", "config.toml");
		mkdirSync(join(root, "config"), { recursive: true });
		mkdirSync(join(root, "dotfiles"), { recursive: true });
		symlinkSync(target, path);

		await file.save({ kind: "add_workspace", workspace: "work" });

		expect(lstatSync(path).isSymbolicLink()).toBe(true);
		expect(readFileSync(target, "utf8")).toContain("[workspaces.work]");
	});
});
