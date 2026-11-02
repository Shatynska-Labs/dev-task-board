import { request as httpRequest } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { renderOverview, renderProject } from "../src/render.js";
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
	tasks: [],
};

const read = {
	state: "read",
	document,
	readAt: "2026-11-01T22:18:00Z",
};

function workspaces(...names: string[]) {
	return names.map((name) => ({
		name,
		projects: [{ name: "one", path: `/srv/${name}/one` }],
	}));
}

// The `reads` port, saying which workspace was asked after.
function recordingReads() {
	const stub = {
		touched: [] as string[],
		get: (workspace: string) => {
			stub.touched.push(workspace);
			return read;
		},
		refresh: async (workspace: string) => {
			stub.touched.push(workspace);
		},
	};
	return stub;
}

function serve(served: unknown, reads: unknown = recordingReads()) {
	return startServer(
		{ workspaces: served, reads } as unknown as Parameters<
			typeof startServer
		>[0],
		0,
	);
}

function body(port: number, path: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}` },
				agent: false,
				timeout: 5000,
			},
			(response) => {
				let text = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					expect(response.statusCode).toBe(200);
					resolve(text);
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

function links(html: string): string[] {
	return [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
}

function address(tag: string): string | undefined {
	return /\bhref=["']([^"']*)["']/.exec(tag)?.[1];
}

function addresses(html: string): (string | undefined)[] {
	return links(html).map(address);
}

function marked(html: string): (string | undefined)[] {
	return links(html)
		.filter((tag) => /\baria-current=["']page["']/.test(tag))
		.map(address);
}

const anyReads = {
	get: () => read,
} as unknown as Parameters<typeof renderOverview>[1];

describe("Several workspaces show as tabs", () => {
	describe("Several workspaces", () => {
		it("links an overview to each, and marks only its own", async () => {
			const port = await serve(workspaces("a", "b"));

			const html = await body(port, "/b");

			expect(addresses(html)).toEqual(expect.arrayContaining(["/a", "/b"]));
			expect(marked(html)).toEqual(["/b"]);
		});

		it("names each tab", async () => {
			const port = await serve(workspaces("first", "second"));

			const html = await body(port, "/second");

			expect(html).toMatch(
				/<a\b[^>]*href=["']\/first["'][^>]*>\s*(<[^>]+>\s*)*first\s*</,
			);
			expect(html).toMatch(
				/<a\b[^>]*href=["']\/second["'][^>]*>\s*(<[^>]+>\s*)*second\s*</,
			);
		});

		it("keeps the order of the settings", async () => {
			const port = await serve(workspaces("z", "m", "a"));

			const shown = addresses(await body(port, "/m")).filter((href) =>
				["/z", "/m", "/a"].includes(String(href)),
			);

			expect([...new Set(shown)]).toEqual(["/z", "/m", "/a"]);
		});

		it("needs no script", async () => {
			const port = await serve(workspaces("a", "b"));

			const html = await body(port, "/b");

			expect(marked(html)).toEqual(["/b"]);
			expect(html).not.toMatch(/<script\b/i);
			expect(html).not.toMatch(/\son[a-z]+=/i);
		});
	});

	describe("On a project's page", () => {
		it("links to each overview, and marks only its workspace", async () => {
			const port = await serve(workspaces("a", "b"));

			const html = await body(port, "/b/one");

			expect(addresses(html)).toEqual(expect.arrayContaining(["/a", "/b"]));
			expect(marked(html)).toEqual(["/b"]);
		});
	});

	describe("One workspace", () => {
		it("shows no tabs on its overview or a project's page", async () => {
			const port = await serve(workspaces("work"));

			expect(marked(await body(port, "/work"))).toEqual([]);
			expect(marked(await body(port, "/work/one"))).toEqual([]);
		});

		it.each([
			["no list", undefined],
			["a list of one", ["work"]],
		])("draws no tabs given %s", (_name, names) => {
			const overview = renderOverview(
				workspaces("work")[0] as Parameters<typeof renderOverview>[0],
				anyReads,
				names,
			);
			const project = renderProject(
				"work",
				"one",
				read as unknown as Parameters<typeof renderProject>[2],
				names,
			);

			expect(marked(overview)).toEqual([]);
			expect(marked(project)).toEqual([]);
		});
	});

	describe("A name needing care", () => {
		it("encodes the address and escapes the text", async () => {
			const port = await serve(workspaces("a b", "<c>"));

			const html = await body(port, "/a%20b");

			expect(addresses(html)).toEqual(
				expect.arrayContaining(["/a%20b", "/%3Cc%3E"]),
			);
			expect(marked(html)).toEqual(["/a%20b"]);
			expect(html).toContain("&lt;c&gt;");
			expect(html).not.toContain("<c>");
		});

		it("serves the tab it encoded", async () => {
			const port = await serve(workspaces("a b", "<c>"));

			expect(marked(await body(port, "/%3Cc%3E"))).toEqual(["/%3Cc%3E"]);
		});
	});

	describe("Another workspace is not read", () => {
		it("touches only the workspace of the overview", async () => {
			const reads = recordingReads();
			const port = await serve(workspaces("a", "b"), reads);

			await body(port, "/a");

			expect(reads.touched).toContain("a");
			expect(reads.touched).not.toContain("b");
		});

		it("touches only the workspace of a project's page", async () => {
			const reads = recordingReads();
			const port = await serve(workspaces("a", "b"), reads);

			await body(port, "/a/one");

			expect(reads.touched).toContain("a");
			expect(reads.touched).not.toContain("b");
		});
	});

	describe("The list of workspaces", () => {
		it("stays a list at /, with no tab marked and nothing read", async () => {
			const reads = recordingReads();
			const port = await serve(workspaces("a", "b"), reads);

			const html = await body(port, "/");

			expect(addresses(html)).toEqual(expect.arrayContaining(["/a", "/b"]));
			expect(marked(html)).toEqual([]);
			expect(reads.touched).toEqual([]);
		});
	});
});
