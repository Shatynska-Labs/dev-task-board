// Derived from the change `replace-a-running-board`, settings delta:
// "Settings may name a port". The shape `{ workspaces, port }` is design.md
// decision 6.
import { describe, expect, it } from "vitest";
import { parseSettings } from "../src/settings.js";

const everyPathADirectory = { home: "/home/someone", isDirectory: () => true };

const workspace = '[workspaces.work]\nprojects = ["/srv/root/one"]\n';

describe("Settings may name a port", () => {
	describe("With a port", () => {
		it("holds port 8800", () => {
			const read = parseSettings(
				`port = 8800\n${workspace}`,
				everyPathADirectory,
			) as unknown as { workspaces: unknown; port: unknown };

			expect(read.port).toBe(8800);
			expect(read.workspaces).toEqual([
				{ name: "work", projects: [{ name: "one", path: "/srv/root/one" }] },
			]);
		});
	});

	describe("Without a port", () => {
		it("holds no port", () => {
			const read = parseSettings(workspace, everyPathADirectory) as unknown as {
				workspaces: unknown;
				port: unknown;
			};

			expect(read.port).toBeUndefined();
			expect(read.workspaces).toEqual([
				{ name: "work", projects: [{ name: "one", path: "/srv/root/one" }] },
			]);
		});
	});
});
