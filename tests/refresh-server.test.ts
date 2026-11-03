import { request as httpRequest } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startServer } from "../src/server.js";
import { removeTemporaryDirectories } from "./support/temporary.js";

vi.setConfig({ testTimeout: 15_000 });

function documentWith(taskName: string) {
	return {
		schema_version: 1,
		project: "one",
		written_at: "2026-11-01T22:17:44Z",
		trunk: {
			ref: "HEAD",
			branch: "main",
			commit: "3fd0ad2",
			state: "no_origin",
		},
		remote_branches_read: false,
		forge: "full",
		forge_limit: 5000,
		warnings: 0,
		workstreams: [],
		tasks: [
			{
				name: taskName,
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
}

const oneWorkspace = [
	{
		name: "work",
		projects: [
			{ name: "one", path: "/srv/one" },
			{ name: "two", path: "/srv/two" },
		],
	},
];

const twoWorkspaces = [
	{ name: "a", projects: [{ name: "one", path: "/srv/one" }] },
	{ name: "b", projects: [{ name: "one", path: "/srv/one" }] },
];

// The `reads` port as `design.md` gives it: `get` and `refresh`.
function stubReads(whenRefreshed: () => Promise<void> = async () => {}) {
	const stub = {
		calls: [] as [string, string | undefined][],
		taskName: "only-task",
		get: () => ({
			state: "read",
			document: documentWith(stub.taskName),
			readAt: "2026-11-01T22:18:00Z",
		}),
		quick: async () => undefined,
		refresh: (workspace: string, project?: string) => {
			stub.calls.push([workspace, project]);
			return whenRefreshed();
		},
	};
	return stub;
}

function serve(reads: unknown, workspaces: unknown = oneWorkspace) {
	return startServer(
		{ workspaces, reads } as unknown as Parameters<typeof startServer>[0],
		0,
	);
}

type Answer = {
	status: number;
	cacheControl: string | undefined;
	body: string;
};

function request(
	port: number,
	path: string,
	headers: Record<string, string> = {},
): Promise<Answer> {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}`, ...headers },
				agent: false,
				timeout: 10_000,
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
						cacheControl: response.headers["cache-control"],
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

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

afterEach(removeTemporaryDirectories);

describe("A page shows what was read for it", () => {
	describe("A refresh shows a change", () => {
		it("answers a project's page once its read is done, with what it left", async () => {
			let finish = () => {};
			const reads = stubReads(
				() =>
					new Promise<void>((resolve) => {
						finish = () => {
							reads.taskName = "fresh-task";
							resolve();
						};
					}),
			);
			const port = await serve(reads);
			let answered = false;

			const answer = request(port, "/work/one").then((response) => {
				answered = true;
				return response;
			});
			await vi.waitFor(() => {
				expect(reads.calls).toEqual([["work", "one"]]);
			});
			await delay(100);

			expect(answered).toBe(false);

			finish();
			const { status, body } = await answer;
			expect(status).toBe(200);
			expect(body).toContain("fresh-task");
			expect(body).not.toContain("only-task");
		});

		it("reads again on each request", async () => {
			const reads = stubReads();
			const port = await serve(reads);

			await request(port, "/work/one");
			await request(port, "/work/one");

			expect(reads.calls).toEqual([
				["work", "one"],
				["work", "one"],
			]);
		});
	});

	describe("A request from another site", () => {
		describe.each(["cross-site", "same-site"])("%s", (site) => {
			it.each(["/work/one", "/work", "/"])(
				"answers %s with 403, and starts no read",
				async (path) => {
					const reads = stubReads();
					const port = await serve(reads);

					const { status, body } = await request(port, path, {
						"Sec-Fetch-Site": site,
					});

					expect(status).toBe(403);
					expect(body).not.toContain("only-task");
					expect(reads.calls).toEqual([]);
				},
			);
		});

		it("starts no read for an address that would be 404", async () => {
			const reads = stubReads();
			const port = await serve(reads);

			await request(port, "/nobody", { "Sec-Fetch-Site": "cross-site" });

			expect(reads.calls).toEqual([]);
		});
	});

	describe("A request from the reader", () => {
		it.each([
			["none", { "Sec-Fetch-Site": "none" }],
			["same-origin", { "Sec-Fetch-Site": "same-origin" }],
			["no such header", {}],
		])("answers %s normally", async (_name, headers) => {
			const reads = stubReads();
			const port = await serve(reads);

			const { status, body } = await request(port, "/work/one", headers);

			expect(status).toBe(200);
			expect(body).toContain("only-task");
			expect(reads.calls).toEqual([["work", "one"]]);
		});
	});

	describe("Not cached", () => {
		it.each(["/", "/work", "/work/one"])(
			"sends %s with Cache-Control: no-store",
			async (path) => {
				const { status, cacheControl } = await request(
					await serve(stubReads()),
					path,
				);

				expect(status).toBe(200);
				expect(cacheControl).toBe("no-store");
			},
		);

		it("sends the list of workspaces with Cache-Control: no-store", async () => {
			const port = await serve(stubReads(), twoWorkspaces);

			expect((await request(port, "/")).cacheControl).toBe("no-store");
		});
	});
});

describe("Each project is read at start and when requested", () => {
	describe("A request that names no project to read", () => {
		it("starts no read for a refused Host", async () => {
			const reads = stubReads();
			const port = await serve(reads);

			const { status } = await request(port, "/work/one", {
				Host: "evil.example",
			});

			expect(status).toBe(403);
			expect(reads.calls).toEqual([]);
		});

		it.each(["/nobody", "/work/nothing", "/%E0", "/work/one/more", "/api/"])(
			"starts no read for %s, which is 404",
			async (path) => {
				const reads = stubReads();
				const port = await serve(reads);

				const { status } = await request(port, path);

				expect(status).toBe(404);
				expect(reads.calls).toEqual([]);
			},
		);

		it("starts no read for the list of workspaces", async () => {
			const reads = stubReads();
			const port = await serve(reads, twoWorkspaces);

			const { status } = await request(port, "/");

			expect(status).toBe(200);
			expect(reads.calls).toEqual([]);
		});
	});
});
