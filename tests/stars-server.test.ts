// Tests derived from the delta specs of `star-workstreams`
// (openspec/changes/star-workstreams/specs/), run against the server with a
// stub of the `reads` port and a stub of the `Stars` port that design.md D10
// names. Each assertion's classification is in that change's test-plan.md.
import { request as httpRequest } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { startServer } from "../src/server.js";
import {
	fullDocument,
	step,
	type Task,
	task,
	workstream,
} from "./support/document.js";
import { attribute, blocks, escapeRegExp, textOf } from "./support/page.js";

vi.setConfig({ testTimeout: 15_000 });

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".

// The `Stars` port as design.md D10 gives it, held in memory.
function stubStars(initial: Record<string, string[]> = {}, failure?: Error) {
	const held = new Map<string, Set<string>>(
		Object.entries(initial).map(([path, names]) => [path, new Set(names)]),
	);
	return {
		starred(projectPath: string): Set<string> {
			return new Set(held.get(projectPath) ?? []);
		},
		async set(projectPath: string, name: string, on: boolean): Promise<void> {
			if (failure !== undefined) {
				throw failure;
			}
			const names = held.get(projectPath) ?? new Set<string>();
			if (on) {
				names.add(name);
			} else {
				names.delete(name);
			}
			held.set(projectPath, names);
		},
	};
}

type Stars = ReturnType<typeof stubStars>;

// The `reads` port as tests/server.test.ts gives it, every project read and
// holding `document`, with its reads counted.
function stubReads(document: unknown) {
	return {
		get: () => ({ state: "read", document, readAt: "2026-11-01T22:18:00Z" }),
		quick: vi.fn(async () => undefined),
		refresh: vi.fn(async () => {}),
	};
}

const oneWorkspace = [
	{
		name: "work",
		projects: [
			{ name: "one", path: "/srv/one" },
			{ name: "two words", path: "/srv/two words" },
		],
	},
];

function inactive(name: string, steps: string[]) {
	return { ...workstream(name, steps), active: false };
}

// A task with no `last_commit` key at all, as distinct from `null`.
function withoutCommit(value: Task): Task {
	const { last_commit: _, ...rest } = value;
	return rest as Task;
}

// One project holding active workstream `alpha` and inactive `beta`.
const alphaAndBeta = fullDocument({
	workstreams: [workstream("alpha", ["s-1"]), inactive("beta", ["s-2"])],
	tasks: [step("s-1", "alpha"), step("s-2", "beta")],
});

async function serve(
	options: { document?: unknown; stars?: Stars; workspaces?: unknown } = {},
) {
	const reads = stubReads(options.document ?? alphaAndBeta);
	const stars = options.stars ?? stubStars();
	const port = await startServer(
		{
			workspaces: options.workspaces ?? oneWorkspace,
			reads,
			stars,
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
	return { port, reads, stars };
}

type Answer = {
	status: number;
	location: string | undefined;
	body: string;
};

// fetch cannot set Host. A header given as undefined is not sent.
function send(
	port: number,
	method: string,
	path: string,
	headers: Record<string, string | undefined> = {},
	body?: string,
): Promise<Answer> {
	const sent: Record<string, string> = { Host: `127.0.0.1:${port}` };
	for (const [name, value] of Object.entries(headers)) {
		if (value === undefined) {
			delete sent[name];
		} else {
			sent[name] = value;
		}
	}
	if (body !== undefined) {
		sent["Content-Length"] = String(Buffer.byteLength(body));
	}
	return new Promise((resolve, reject) => {
		let answered = false;
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				method,
				path,
				headers: sent,
				agent: false,
				timeout: 10_000,
			},
			(response) => {
				answered = true;
				let text = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					resolve({
						status: response.statusCode ?? 0,
						location: response.headers.location,
						body: text,
					});
				});
			},
		);
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no answer for ${method} ${path}`));
		});
		outgoing.on("error", (error) => {
			// A server refusing a long body may close before reading it all.
			if (!answered) reject(error);
		});
		outgoing.end(body);
	});
}

function ownPage(port: number, host = `127.0.0.1:${port}`) {
	return {
		Host: host,
		Origin: `http://${host}`,
		"Sec-Fetch-Site": "same-origin",
		"Content-Type": "application/x-www-form-urlencoded",
	};
}

function post(
	port: number,
	path: string,
	body: string,
	headers: Record<string, string | undefined> = {},
): Promise<Answer> {
	return send(port, "POST", path, { ...ownPage(port), ...headers }, body);
}

async function pageOf(port: number, path: string): Promise<string> {
	const answer = await send(port, "GET", path);
	expect(answer.status).toBe(200);
	return answer.body;
}

const phaseTag =
	/<section\b[^>]*\bclass=["'](?:[^"']*\s)?phase(?:\s[^"']*)?["'][^>]*>/g;

// The part left shown: from the last phase's opening tag to the end.
function lastPhase(html: string): string {
	const starts = [...html.matchAll(phaseTag)].map((match) => match.index ?? 0);
	const last = starts.at(-1);
	if (last === undefined) throw new Error("the page has no phase");
	return html.slice(last);
}

type Button = { start: number; attributes: string; inner: string };

function buttons(html: string): Button[] {
	return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].map(
		(match) => ({
			start: match.index ?? 0,
			attributes: match[1] ?? "",
			inner: match[2] ?? "",
		}),
	);
}

function starButtons(html: string): Button[] {
	return buttons(html).filter((button) =>
		["star", "unstar"].includes(attribute(button.attributes, "name") ?? ""),
	);
}

// The star button whose value is the workstream's name.
function starButtonOf(html: string, stream: string): Button {
	const found = starButtons(html).filter(
		(button) => attribute(button.attributes, "value") === stream,
	);
	expect(found).toHaveLength(1);
	return found[0] as Button;
}

// What the button is called: its aria-label, or else its text with what is
// hidden from assistive technology left out.
function accessibleName(button: Button): string {
	const label = attribute(button.attributes, "aria-label");
	if (label !== null) return label.trim();
	return textOf(
		button.inner.replace(
			/<([a-zA-Z][\w-]*)\b[^>]*\baria-hidden=["']true["'][^>]*>[\s\S]*?<\/\1>/g,
			" ",
		),
	).trim();
}

// The text of the <summary> that holds the button, or null.
function summaryAround(html: string, button: Button): string | null {
	const [summary] = blocks(html, "summary")
		.filter((block) => block.start < button.start && button.start < block.end)
		.sort((a, b) => a.end - a.start - (b.end - b.start));
	return summary === undefined
		? null
		: textOf(html.slice(summary.start, summary.end));
}

function formsWithId(html: string, id: string): string[] {
	return [...html.matchAll(/<form\b([^>]*)>/gi)]
		.map((match) => match[1] ?? "")
		.filter((attributes) => attribute(attributes, "id") === id);
}

describe("The page sets a star", () => {
	describe("Starring", () => {
		it("answers 303 to /work/one#alpha, stars alpha, and starts no read", async () => {
			const { port, reads, stars } = await serve();

			const answer = await post(port, "/work/one", "star=alpha");

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/work/one#alpha");
			expect([...stars.starred("/srv/one")]).toEqual(["alpha"]);
			expect(reads.quick).not.toHaveBeenCalled();
			expect(reads.refresh).not.toHaveBeenCalled();
		});

		it("percent-encodes the project's name in the address it answers with", async () => {
			const { port, stars } = await serve();

			const answer = await post(port, "/work/two%20words", "star=alpha");

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/work/two%20words#alpha");
			expect([...stars.starred("/srv/two words")]).toEqual(["alpha"]);
		});

		it("accepts the board's own page addressed as localhost", async () => {
			const { port, stars } = await serve();

			const answer = await post(
				port,
				"/work/one",
				"star=alpha",
				ownPage(port, `localhost:${port}`),
			);

			expect(answer.status).toBe(303);
			expect([...stars.starred("/srv/one")]).toEqual(["alpha"]);
		});
	});

	describe("Unstarring", () => {
		it("answers 303 to /work/one#alpha, and alpha is not starred", async () => {
			const { port, stars } = await serve({
				stars: stubStars({ "/srv/one": ["alpha"] }),
			});

			const answer = await post(port, "/work/one", "unstar=alpha");

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/work/one#alpha");
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});
	});

	describe("Sent twice", () => {
		it("answers 303 to star=alpha again, and alpha is still starred", async () => {
			const { port, stars } = await serve({
				stars: stubStars({ "/srv/one": ["alpha"] }),
			});

			const answer = await post(port, "/work/one", "star=alpha");

			expect(answer.status).toBe(303);
			expect(answer.location).toBe("/work/one#alpha");
			expect([...stars.starred("/srv/one")]).toEqual(["alpha"]);
		});

		it("answers 303 to unstar of a workstream not starred, and leaves it so", async () => {
			const { port, stars } = await serve();

			const answer = await post(port, "/work/one", "unstar=alpha");

			expect(answer.status).toBe(303);
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});
	});

	describe("A star that cannot be saved", () => {
		it("answers 500 with a page saying so and why, escaped, and alpha is not starred", async () => {
			const { port, stars } = await serve({
				stars: stubStars({}, new Error("EACCES <denied> here")),
			});

			const answer = await post(port, "/work/one", "star=alpha");

			expect(answer.status).toBe(500);
			expect(textOf(answer.body)).toMatch(/could not be saved/i);
			expect(answer.body).toContain("EACCES &lt;denied&gt; here");
			expect(answer.body).not.toContain("<denied>");
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});
	});

	describe("One project in two workspaces", () => {
		it("shows alpha starred on /b/one once starred from /a/one", async () => {
			const { port } = await serve({
				workspaces: [
					{ name: "a", projects: [{ name: "one", path: "/p/one" }] },
					{ name: "b", projects: [{ name: "one", path: "/p/one" }] },
				],
			});

			expect((await post(port, "/a/one", "star=alpha")).status).toBe(303);
			const shown = lastPhase(await pageOf(port, "/b/one"));

			expect(attribute(starButtonOf(shown, "alpha").attributes, "name")).toBe(
				"unstar",
			);
		});
	});
});

describe("Only the board's own page sets a star", () => {
	describe("From another site", () => {
		it.each([
			["Sec-Fetch-Site cross-site", { "Sec-Fetch-Site": "cross-site" }],
			["Origin http://evil.example", { Origin: "http://evil.example" }],
			[
				"an Origin naming another of the board's hosts",
				{ Origin: "http://localhost:1" },
			],
		])(
			"answers 403 with %s, and nothing is starred",
			async (_name, headers) => {
				const { port, stars } = await serve();

				const answer = await post(port, "/work/one", "star=alpha", headers);

				expect(answer.status).toBe(403);
				expect([...stars.starred("/srv/one")]).toEqual([]);
			},
		);
	});

	describe("Without the headers", () => {
		it.each([
			["no Sec-Fetch-Site", { "Sec-Fetch-Site": undefined }],
			["no Origin", { Origin: undefined }],
			["Sec-Fetch-Site none", { "Sec-Fetch-Site": "none" }],
		])(
			"answers 403 with %s, and nothing is starred",
			async (_name, headers) => {
				const { port, stars } = await serve();

				const answer = await post(port, "/work/one", "star=alpha", headers);

				expect(answer.status).toBe(403);
				expect([...stars.starred("/srv/one")]).toEqual([]);
			},
		);
	});

	describe("A malformed body", () => {
		it.each([
			["an empty body", ""],
			["two fields", "star=alpha&unstar=beta"],
			["another field", "pin=alpha"],
		])("answers 400 to %s, and nothing changes", async (_name, body) => {
			const { port, stars } = await serve({
				stars: stubStars({ "/srv/one": ["beta"] }),
			});

			const answer = await post(port, "/work/one", body);

			expect(answer.status).toBe(400);
			expect([...stars.starred("/srv/one")]).toEqual(["beta"]);
		});
	});

	describe("A long body", () => {
		it("answers 413 to a body of 5000 bytes, and nothing changes", async () => {
			const { port, stars } = await serve();

			const answer = await post(port, "/work/one", `star=${"a".repeat(4995)}`);

			expect(answer.status).toBe(413);
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});
	});

	describe("An unknown workstream or project", () => {
		it("answers 404 to star=nobody on /work/one, and nothing changes", async () => {
			const { port, stars } = await serve();

			const answer = await post(port, "/work/one", "star=nobody");

			expect(answer.status).toBe(404);
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});

		it("answers 404 to star=alpha on /work/nothing, and nothing changes", async () => {
			const { port, stars } = await serve();

			const answer = await post(port, "/work/nothing", "star=alpha");

			expect(answer.status).toBe(404);
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});
	});

	describe("The first failing check decides", () => {
		it("answers 403 to a body of 5000 bytes with no Origin", async () => {
			const { port } = await serve();

			const answer = await post(port, "/work/one", `star=${"a".repeat(4995)}`, {
				Origin: undefined,
			});

			expect(answer.status).toBe(403);
		});

		it("answers 413 to pin=alpha in a body of 5000 bytes", async () => {
			const { port } = await serve();

			const answer = await post(
				port,
				"/work/one",
				`pin=alpha${"a".repeat(4991)}`,
			);

			expect(answer.status).toBe(413);
		});

		it("answers 404 to /work/nothing with no Origin", async () => {
			const { port } = await serve();

			const answer = await post(port, "/work/nothing", "star=alpha", {
				Origin: undefined,
			});

			expect(answer.status).toBe(404);
		});
	});
});

describe("Addresses reach workspaces and projects", () => {
	describe("One workspace", () => {
		it("shows the overview of work at /", async () => {
			const { port } = await serve();

			const root = await send(port, "GET", "/");
			const overview = await send(port, "GET", "/work");

			expect(root.status).toBe(200);
			expect(root.body).toBe(overview.body);
		});
	});

	describe("Several workspaces", () => {
		it("links to /a and /b at /", async () => {
			const { port } = await serve({
				workspaces: [
					{ name: "a", projects: [{ name: "one", path: "/srv/one" }] },
					{ name: "b", projects: [{ name: "one", path: "/srv/one" }] },
				],
			});

			const answer = await send(port, "GET", "/");

			expect(answer.status).toBe(200);
			expect(answer.body).toMatch(/href=["']\/a["']/);
			expect(answer.body).toMatch(/href=["']\/b["']/);
		});
	});

	describe("An unknown address", () => {
		it.each(["/nobody", "/work/nothing", "/%E0"])(
			"answers %s with 404",
			async (path) => {
				const { port } = await serve();

				expect((await send(port, "GET", path)).status).toBe(404);
			},
		);
	});

	describe("Another method", () => {
		it("answers a POST to /work with 404, from the board's own page", async () => {
			const { port, stars } = await serve();

			const answer = await post(port, "/work", "star=alpha");

			expect(answer.status).toBe(404);
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});

		it("answers a PUT to /work/one with 404, from the board's own page", async () => {
			const { port, stars } = await serve();

			const answer = await send(
				port,
				"PUT",
				"/work/one",
				ownPage(port),
				"star=alpha",
			);

			expect(answer.status).toBe(404);
			expect([...stars.starred("/srv/one")]).toEqual([]);
		});
	});
});

describe("A workstream shows its star", () => {
	describe("Not starred", () => {
		it("gives alpha's summary a button named star, valued alpha, showing ☆, called Star alpha, submitting a form posting to /work/one", async () => {
			const { port } = await serve();

			const html = await pageOf(port, "/work/one");
			const shown = lastPhase(html);
			const button = starButtonOf(shown, "alpha");

			expect(summaryAround(shown, button)).toContain("alpha");
			expect(attribute(button.attributes, "name")).toBe("star");
			expect(textOf(button.inner)).toContain("☆");
			expect(textOf(button.inner)).not.toContain("★");
			expect(accessibleName(button)).toBe("Star alpha");
			const formId = attribute(button.attributes, "form");
			expect(formId).not.toBeNull();
			const [form] = formsWithId(html, String(formId));
			expect(form).toBeDefined();
			expect(attribute(form ?? "", "action")).toBe("/work/one");
			expect((attribute(form ?? "", "method") ?? "").toLowerCase()).toBe(
				"post",
			);
		});
	});

	describe("Starred", () => {
		it("gives alpha's summary a button named unstar, valued alpha, showing ★, called Unstar alpha", async () => {
			const { port } = await serve({
				stars: stubStars({ "/srv/one": ["alpha"] }),
			});

			const shown = lastPhase(await pageOf(port, "/work/one"));
			const button = starButtonOf(shown, "alpha");

			expect(summaryAround(shown, button)).toContain("alpha");
			expect(attribute(button.attributes, "name")).toBe("unstar");
			expect(textOf(button.inner)).toContain("★");
			expect(textOf(button.inner)).not.toContain("☆");
			expect(accessibleName(button)).toBe("Unstar alpha");
		});

		it("stars only the project whose path is starred", async () => {
			const { port } = await serve({
				stars: stubStars({ "/srv/two words": ["alpha"] }),
			});

			const shown = lastPhase(await pageOf(port, "/work/one"));

			expect(attribute(starButtonOf(shown, "alpha").attributes, "name")).toBe(
				"star",
			);
		});
	});

	describe("Every workstream", () => {
		it("gives the inactive workstream beta its own button, in its summary", async () => {
			const { port } = await serve();

			const shown = lastPhase(await pageOf(port, "/work/one"));
			const button = starButtonOf(shown, "beta");

			expect(summaryAround(shown, button)).toContain("beta");
		});

		it("carries the workstream's name escaped as the button's value", async () => {
			const name = 'x"><b>y';
			const { port } = await serve({
				document: fullDocument({
					workstreams: [workstream(name, ["s-1"])],
					tasks: [step("s-1", name)],
				}),
			});

			const html = await pageOf(port, "/work/one");

			expect(
				attribute(starButtonOf(lastPhase(html), name).attributes, "name"),
			).toBe("star");
			expect(html).not.toContain("<b>y");
		});

		it("carries no script", async () => {
			const { port } = await serve();

			expect(await pageOf(port, "/work/one")).not.toMatch(/<script\b/i);
		});
	});
});

// The text of a workstream section in the part left shown: from its heading
// to the next of the page's later headings, or to the end. Follows
// tests/other-workstreams-order-render.test.ts.
function sectionText(html: string, heading: RegExp, next?: RegExp): string {
	const text = textOf(lastPhase(html));
	const start = text.search(heading);
	if (start === -1) throw new Error(`the page shows no ${heading}`);
	const rest = text.slice(start);
	const end = next === undefined ? -1 : rest.slice(1).search(next);
	return end === -1 ? rest : rest.slice(0, end + 1);
}

const OTHER = /other workstreams/i;
const ACTIVE = /active workstreams/i;

// The names, ordered by where each first appears as a whole word in `text`.
function orderIn(text: string, ...names: string[]): string[] {
	const at = (name: string) =>
		text.search(new RegExp(`(^|\\s)${escapeRegExp(name)}(\\s|$)`));
	for (const name of names) {
		if (at(name) === -1) throw new Error(`the section shows no ${name}`);
	}
	return [...names].sort((a, b) => at(a) - at(b));
}

async function otherOrder(
	document: unknown,
	starred: string[],
	...names: string[]
): Promise<string[]> {
	const { port } = await serve({
		document,
		stars: stubStars({ "/srv/one": starred }),
	});
	return orderIn(sectionText(await pageOf(port, "/work/one"), OTHER), ...names);
}

async function activeOrder(
	document: unknown,
	starred: string[],
	...names: string[]
): Promise<string[]> {
	const { port } = await serve({
		document,
		stars: stubStars({ "/srv/one": starred }),
	});
	return orderIn(
		sectionText(await pageOf(port, "/work/one"), ACTIVE, OTHER),
		...names,
	);
}

describe("Workstreams are ordered by their latest commit", () => {
	it("Newest first: beta, at 200, before alpha, at 100", async () => {
		const document = fullDocument({
			workstreams: [inactive("alpha", ["s-1"]), inactive("beta", ["s-2"])],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				step("s-2", "beta", { last_commit: 200 }),
			],
		});

		expect(await otherOrder(document, [], "alpha", "beta")).toEqual([
			"beta",
			"alpha",
		]);
	});

	it("The latest of several tasks: alpha, at 100 and 300, before beta, at 200", async () => {
		const document = fullDocument({
			workstreams: [
				inactive("beta", ["s-3"]),
				inactive("alpha", ["s-1", "s-2"]),
			],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				step("s-2", "alpha", { last_commit: 300 }),
				step("s-3", "beta", { last_commit: 200 }),
			],
		});

		expect(await otherOrder(document, [], "alpha", "beta")).toEqual([
			"alpha",
			"beta",
		]);
	});

	it("An unplaced task counts: alpha's unplaced 300 puts it before beta's 200", async () => {
		const document = fullDocument({
			workstreams: [inactive("beta", ["s-2"]), inactive("alpha", ["s-1"])],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				task("u-1", {
					workstreams: ["alpha"],
					unplaced: true,
					last_commit: 300,
				}),
				step("s-2", "beta", { last_commit: 200 }),
			],
		});

		expect(await otherOrder(document, [], "alpha", "beta")).toEqual([
			"alpha",
			"beta",
		]);
	});

	it("No commit comes last: beta, at 100, before alpha, at null", async () => {
		const document = fullDocument({
			workstreams: [inactive("alpha", ["s-1"]), inactive("beta", ["s-2"])],
			tasks: [
				step("s-1", "alpha", { last_commit: null }),
				step("s-2", "beta", { last_commit: 100 }),
			],
		});

		expect(await otherOrder(document, [], "alpha", "beta")).toEqual([
			"beta",
			"alpha",
		]);
	});

	it("Equal commits by name: alpha before beta, both at 100, beta first in the document", async () => {
		const document = fullDocument({
			workstreams: [inactive("beta", ["s-1"]), inactive("alpha", ["s-2"])],
			tasks: [
				step("s-1", "beta", { last_commit: 100 }),
				step("s-2", "alpha", { last_commit: 100 }),
			],
		});

		expect(await otherOrder(document, [], "alpha", "beta")).toEqual([
			"alpha",
			"beta",
		]);
	});

	it("No commits by name: alpha before beta, neither with a commit, beta first in the document", async () => {
		const document = fullDocument({
			workstreams: [inactive("beta", ["s-1"]), inactive("alpha", ["s-2"])],
			tasks: [
				withoutCommit(step("s-1", "beta")),
				step("s-2", "alpha", { last_commit: null }),
			],
		});

		expect(await otherOrder(document, [], "alpha", "beta")).toEqual([
			"alpha",
			"beta",
		]);
	});

	it("Active workstreams are ordered too: beta, at 200, before alpha, at 100", async () => {
		const document = fullDocument({
			workstreams: [workstream("alpha", ["s-1"]), workstream("beta", ["s-2"])],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				step("s-2", "beta", { last_commit: 200 }),
			],
		});

		expect(await activeOrder(document, [], "alpha", "beta")).toEqual([
			"beta",
			"alpha",
		]);
	});

	it("Starred first: starred alpha, at 100, before beta, at 200, among the active workstreams", async () => {
		const document = fullDocument({
			workstreams: [workstream("alpha", ["s-1"]), workstream("beta", ["s-2"])],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				step("s-2", "beta", { last_commit: 200 }),
			],
		});

		expect(await activeOrder(document, ["alpha"], "alpha", "beta")).toEqual([
			"alpha",
			"beta",
		]);
	});

	it("Starred among themselves by latest commit: beta, alpha, gamma among the other workstreams", async () => {
		const document = fullDocument({
			workstreams: [
				inactive("alpha", ["s-1"]),
				inactive("beta", ["s-2"]),
				inactive("gamma", ["s-3"]),
			],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				step("s-2", "beta", { last_commit: 200 }),
				step("s-3", "gamma", { last_commit: 300 }),
			],
		});

		expect(
			await otherOrder(document, ["alpha", "beta"], "alpha", "beta", "gamma"),
		).toEqual(["beta", "alpha", "gamma"]);
	});

	it("A star keeps its section: starred inactive alpha among the other workstreams, beta among the active", async () => {
		const document = fullDocument({
			workstreams: [inactive("alpha", ["s-1"]), workstream("beta", ["s-2"])],
			tasks: [step("s-1", "alpha"), step("s-2", "beta")],
		});
		const { port } = await serve({
			document,
			stars: stubStars({ "/srv/one": ["alpha"] }),
		});
		const html = await pageOf(port, "/work/one");

		const active = sectionText(html, ACTIVE, OTHER);
		const other = sectionText(html, OTHER);

		expect(orderIn(other, "alpha")).toEqual(["alpha"]);
		expect(orderIn(active, "beta")).toEqual(["beta"]);
		expect(active).not.toMatch(/(^|\s)alpha(\s|$)/);
	});
});
