import { request as httpRequest } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { startServer } from "../src/server.js";

vi.setConfig({ testTimeout: 15_000 });

const document = {
	schema_version: 1,
	project: "one",
	written_at: "2026-11-01T22:17:44Z",
	trunk: { ref: "HEAD", branch: "main", commit: "3fd0ad2", state: "no_origin" },
	remote_branches_read: false,
	forge: "full",
	forge_limit: 5000,
	warnings: 0,
	workstreams: [],
	tasks: [
		{
			name: "only-task",
			status: "recorded",
			stage: null,
			workstreams: [],
			unplaced: false,
			closed_workstream: null,
			parts: ["entry"],
			last_commit: 1793540012,
			summary: null,
			priority: null,
			waits_on: [],
			body: null,
			merge_unchecked: false,
			warnings: [],
		},
	],
};

const oneWorkspace = [
	{
		name: "work",
		projects: [
			{ name: "one", path: "/srv/one" },
			{ name: "two words", path: "/srv/two words" },
		],
	},
];

const readEverything = {
	get: (_workspace: string, project: string) =>
		project === "one" || project === "two words"
			? { state: "read", document, readAt: "2026-11-01T22:18:00Z" }
			: { state: "reading" },
	refresh: async () => {},
};

function serve(workspaces: unknown = oneWorkspace) {
	return startServer(
		{ workspaces, reads: readEverything } as unknown as Parameters<
			typeof startServer
		>[0],
		0,
	);
}

// fetch cannot set Host. The server under test has no close in the design, so
// each stays open until the test worker exits; see test-plan.md.
function request(
	port: number,
	path: string,
	host = `127.0.0.1:${port}`,
): Promise<{ status: number; type: string; body: string }> {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: host },
				agent: false,
				timeout: 5000,
			},
			(response) => {
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					body += chunk;
				});
				response.on("end", () => {
					resolve({
						status: response.statusCode ?? 0,
						type: String(response.headers["content-type"]),
						body,
					});
				});
			},
		);
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no answer for ${path}`));
		});
		outgoing.on("error", reject);
		outgoing.end();
	});
}

describe("The server is local and refuses other hosts", () => {
	describe("An unexpected host", () => {
		it.each([
			["evil.example", () => "evil.example"],
			["evil.example with the port", (port: number) => `evil.example:${port}`],
			[
				"127.0.0.1 with another port",
				(port: number) => `127.0.0.1:${port + 1}`,
			],
			[
				"localhost with another port",
				(port: number) => `localhost:${port + 1}`,
			],
			["127.0.0.1 with no port", () => "127.0.0.1"],
			["localhost with no port", () => "localhost"],
		])("answers 403 to %s", async (_name, host) => {
			const port = await serve();

			const response = await request(port, "/work", host(port));

			expect(response.status).toBe(403);
			expect(response.body).not.toContain("only-task");
		});

		it("answers 403 before an address would be 404", async () => {
			const port = await serve();

			const response = await request(port, "/nobody", "evil.example");

			expect(response.status).toBe(403);
		});
	});

	describe("The expected hosts", () => {
		it.each([
			["127.0.0.1", (port: number) => `127.0.0.1:${port}`],
			["localhost", (port: number) => `localhost:${port}`],
		])("answers %s normally", async (_name, host) => {
			const port = await serve();

			const response = await request(port, "/work", host(port));

			expect(response.status).toBe(200);
			expect(response.body).toContain("one");
		});

		it("answers with HTML", async () => {
			const port = await serve();

			const response = await request(port, "/work");

			expect(response.type).toMatch(/^text\/html/);
		});
	});

	it("binds the loopback address the port was asked of", async () => {
		const port = await serve();

		expect(port).toBeGreaterThan(0);
		expect((await request(port, "/")).status).toBe(200);
	});
});

describe("Addresses reach workspaces and projects", () => {
	describe("One workspace", () => {
		it("shows the workspace's overview at /", async () => {
			const port = await serve();

			const root = await request(port, "/");
			const overview = await request(port, "/work");

			expect(root.status).toBe(200);
			expect(overview.status).toBe(200);
			expect(root.body).toBe(overview.body);
			expect(root.body).toMatch(/href=["']\/work\/one["']/);
		});
	});

	describe("Several workspaces", () => {
		it("links to each at /", async () => {
			const port = await serve([
				{ name: "a", projects: [{ name: "one", path: "/srv/one" }] },
				{ name: "b", projects: [{ name: "one", path: "/srv/one" }] },
			]);

			const response = await request(port, "/");

			expect(response.status).toBe(200);
			expect(response.body).toMatch(/href=["']\/a["']/);
			expect(response.body).toMatch(/href=["']\/b["']/);
		});

		it("serves each workspace at its address", async () => {
			const port = await serve([
				{ name: "a", projects: [{ name: "one", path: "/srv/one" }] },
				{ name: "b", projects: [{ name: "other", path: "/srv/other" }] },
			]);

			expect((await request(port, "/b")).body).toMatch(/href=["']\/b\/other/);
		});
	});

	describe("A project's address", () => {
		it("shows the project's page", async () => {
			const port = await serve();

			const response = await request(port, "/work/one");

			expect(response.status).toBe(200);
			expect(response.body).toContain("only-task");
		});

		it("decodes a percent-encoded name", async () => {
			const port = await serve();

			const response = await request(port, "/work/two%20words");

			expect(response.status).toBe(200);
			expect(response.body).toContain("only-task");
		});
	});

	describe("An unknown address", () => {
		it.each([
			"/nobody",
			"/work/nothing",
			"/%E0",
			"/work/%E0",
			"/work/one/more",
			"/work/",
			"/api",
			"/api/",
			"/api/work",
			"/__proto__",
			"*",
			"/constructor",
			"/work/constructor",
		])("answers %s with 404", async (path) => {
			const port = await serve();

			const response = await request(port, path);

			expect(response.status).toBe(404);
		});
	});
});
