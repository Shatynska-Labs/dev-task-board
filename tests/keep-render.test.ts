import { describe, expect, it } from "vitest";
import { whatMissed } from "../src/reads.js";
import { renderOverview, renderProject } from "../src/render.js";

type ProjectState = Parameters<typeof renderProject>[2];
type Latest = { at: string; reason?: string; missed?: string[] };

const staleTrunk = /may be stale/gi;
const unreadBranches = /remote branches (were )?not read/gi;
const noRemote = /no remote named origin/gi;
const wrongStatuses = /statuses may be wrong/gi;

const documentRead = "2026-11-01T22:18:05.000Z";
const documentReadShown = "2026-11-01 22:18:05 UTC";
const latestRead = "2026-11-01T22:48:10.000Z";
const latestReadShown = "2026-11-01 22:48:10 UTC";

function task(name: string, fields: Record<string, unknown> = {}) {
	return {
		name,
		status: "recorded",
		stage: null,
		workstreams: [],
		unplaced: false,
		closed_workstream: null,
		parts: ["entry"],
		// No age of a task's own to be mistaken for the age of a document.
		last_commit: null,
		summary: null,
		priority: null,
		waits_on: [],
		body: null,
		merge_unchecked: false,
		warnings: [],
		...fields,
	};
}

function fullDocument(fields: Record<string, unknown> = {}) {
	return {
		schema_version: 1,
		project: "alpha",
		written_at: "2026-11-01T22:17:44Z",
		trunk: {
			ref: "origin/main",
			branch: "main",
			commit: "2cc5bd8",
			state: "fetched",
		},
		remote_branches_read: true,
		forge: "full",
		forge_limit: 5000,
		warnings: 0,
		workstreams: [],
		tasks: [],
		...fields,
	};
}

function trunk(state: string, branch = "main") {
	return { ref: "origin/main", branch, commit: "2cc5bd8", state };
}

function read(document: unknown, latest?: Latest): ProjectState {
	return {
		state: "read",
		document,
		readAt: documentRead,
		...(latest === undefined ? {} : { latest }),
	} as unknown as ProjectState;
}

function keptPast(document: unknown, later: unknown): ProjectState {
	return read(document, {
		at: latestRead,
		missed: whatMissed(later as Parameters<typeof whatMissed>[0]),
	});
}

function page(state: ProjectState, workspace = "desk"): string {
	return renderProject(workspace, "alpha", state);
}

function overview(projects: Record<string, ProjectState>): string {
	return renderOverview(
		{
			name: "desk",
			projects: Object.keys(projects).map((name) => ({
				name,
				path: `/srv/${name}`,
			})),
		},
		{
			get: (_workspace: string, project: string) => projects[project],
		} as unknown as Parameters<typeof renderOverview>[1],
	);
}

// The overview's text from one project's row up to the next project's.
function row(state: ProjectState): string {
	const text = textOf(
		overview({ alpha: state, beta: read(fullDocument({ project: "beta" })) }),
	);
	return text.slice(text.indexOf("alpha"), text.indexOf("beta"));
}

function textOf(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}

function count(text: string, pattern: RegExp): number {
	return [...text.matchAll(pattern)].length;
}

function expectNoNotice(text: string): void {
	for (const pattern of [staleTrunk, unreadBranches, noRemote, wrongStatuses]) {
		expect(text).not.toMatch(pattern);
	}
}

describe("A partial forge read is noticed", () => {
	describe("No forge", () => {
		it("shows the notice once on the page and in the overview's row", () => {
			const state = read(fullDocument({ forge: "none" }));

			expect(count(textOf(page(state)), wrongStatuses)).toBe(1);
			expect(count(row(state), wrongStatuses)).toBe(1);
		});
	});

	describe("A full forge", () => {
		it("shows no notice for a document kept past no later read", () => {
			expect(textOf(page(read(fullDocument())))).not.toMatch(wrongStatuses);
		});
	});
});

describe("A page says what a read missed", () => {
	describe("A full read with a failed fetch", () => {
		const state = read(
			fullDocument({
				trunk: trunk("fetch_failed"),
				remote_branches_read: false,
			}),
		);

		it.each([
			["page", () => textOf(page(state))],
			["overview row", () => row(state)],
		])(
			"says what was missed on the %s, and not that statuses may be wrong",
			(_name, shown) => {
				const text = shown();

				expect(text).toMatch(staleTrunk);
				expect(text).toMatch(unreadBranches);
				expect(text).not.toMatch(wrongStatuses);
			},
		);
	});

	describe("No remote", () => {
		it.each(["work", "topic-branch"])(
			"says there is no remote named origin and that %s was read",
			(branch) => {
				const text = textOf(
					page(
						read(
							fullDocument({
								trunk: trunk("no_origin", branch),
								remote_branches_read: false,
							}),
						),
					),
				);

				expect(text).toMatch(noRemote);
				expect(text).toMatch(new RegExp(`\\b${branch}\\b`));
			},
		);

		it("says it on the overview's row", () => {
			const state = read(
				fullDocument({
					trunk: trunk("no_origin", "topic-branch"),
					remote_branches_read: false,
				}),
			);

			expect(row(state)).toMatch(noRemote);
			expect(row(state)).toContain("topic-branch");
		});
	});

	describe("Nothing missed", () => {
		it("shows no notice on the page or in the overview", () => {
			const state = read(fullDocument());

			expectNoNotice(textOf(page(state)));
			expectNoNotice(row(state));
		});
	});
});

describe("A page marks a kept document", () => {
	const reason = "<b>no";
	const keptThroughFailure = read(
		fullDocument({
			tasks: [
				task("in-work-1", { status: "in_flight" }),
				task("in-work-2", { status: "in_flight" }),
				task("in-work-3", { status: "in_flight" }),
				task("rest-1"),
				task("rest-2"),
				task("rest-3"),
				task("rest-4"),
			],
		}),
		{ at: latestRead, reason },
	);

	describe("Kept through a failure", () => {
		it("shows the tasks, both times, the age and the reason as text", () => {
			const html = page(keptThroughFailure);
			const text = textOf(html);

			expect(text).toContain("in-work-1");
			expect(text).toContain(documentReadShown);
			expect(text).toMatch(/\b30 min\b/);
			expect(text).toContain(latestReadShown);
			expect(html).toContain("&lt;b&gt;no");
			expect(html).not.toContain("<b>no");
		});
	});

	describe("Kept on the overview", () => {
		it("shows the counts, both times, the age and the reason in its row", () => {
			const shown = row(keptThroughFailure);

			expect(shown).toMatch(/\b3\b/);
			expect(shown).toMatch(/\b7\b/);
			expect(shown).toContain(documentReadShown);
			expect(shown).toMatch(/\b30 min\b/);
			expect(shown).toContain(latestReadShown);
			expect(shown).toContain("&lt;b&gt;no");
		});

		it("escapes the reason in its row", () => {
			expect(overview({ alpha: keptThroughFailure })).not.toContain("<b>no");
		});
	});

	describe("Kept through an outage", () => {
		it("shows the tasks, each of the three things missed, and no later mark", () => {
			const text = textOf(
				page(
					keptPast(
						fullDocument({
							tasks: [task("kept-task", { status: "in_flight" })],
						}),
						fullDocument({
							forge: "none",
							trunk: trunk("fetch_failed"),
							remote_branches_read: false,
							tasks: [
								task("later-task", {
									status: "in_flight",
									merge_unchecked: true,
								}),
							],
						}),
					),
				),
			);

			expect(text).toContain("kept-task");
			expect(text).not.toContain("later-task");
			expect(text).toMatch(wrongStatuses);
			expect(text).toMatch(staleTrunk);
			expect(text).toMatch(unreadBranches);
			expect(text.slice(text.indexOf("kept-task"))).not.toContain(
				"pull requests not checked",
			);
		});
	});

	describe("Missed by both", () => {
		function missedByBoth(): ProjectState {
			return keptPast(
				fullDocument({ trunk: trunk("fetch_failed") }),
				fullDocument({ forge: "none", trunk: trunk("fetch_failed") }),
			);
		}

		it("says once on the page that the trunk may be stale", () => {
			expect(count(textOf(page(missedByBoth())), staleTrunk)).toBe(1);
		});

		it("says it once in the overview's row", () => {
			expect(count(row(missedByBoth()), staleTrunk)).toBe(1);
		});
	});

	describe("Missed by the document shown alone", () => {
		it("still says it, with the latest read's reason", () => {
			const state = read(fullDocument({ trunk: trunk("fetch_failed") }), {
				at: latestRead,
				reason: "the tool refused",
			});
			const text = textOf(page(state));

			expect(text).toMatch(staleTrunk);
			expect(text).toContain("the tool refused");
		});
	});

	describe("What a latest read missed", () => {
		it("is escaped", () => {
			const html = page(
				read(fullDocument(), { at: latestRead, missed: ["<i>unread"] }),
			);

			expect(html).toContain("&lt;i&gt;unread");
			expect(html).not.toContain("<i>unread");
		});
	});

	describe("The units of an age", () => {
		const second = 1000;
		const minute = 60 * second;
		const hour = 60 * minute;
		const day = 24 * hour;

		function aged(ms: number): string {
			const at = new Date(new Date(documentRead).getTime() + ms).toISOString();
			return textOf(
				page(read(fullDocument(), { at, reason: "the tool refused" })),
			);
		}

		it.each([
			[20 * second, "under a minute"],
			[59 * minute, "59 min"],
			[3 * hour, "3 h"],
			[2 * day, "2 d"],
			[59 * second, "under a minute"],
			[minute, "1 min"],
			[59 * minute + 59 * second, "59 min"],
			[hour, "1 h"],
			[24 * hour - second, "23 h"],
			[day, "1 d"],
		])("shows %d ms as %s", (ms, shown) => {
			expect(aged(ms)).toMatch(new RegExp(`(^|[^\\d])${shown}\\b`));
		});

		it("does not floor an age at a minute", () => {
			expect(aged(20 * second)).not.toMatch(/\b1 min\b/);
		});
	});

	describe("A document shown new", () => {
		it("marks nothing as kept", () => {
			const text = textOf(page(read(fullDocument())));

			expect(text).not.toMatch(/under a minute|\d (min|h|d)\b/);
			expect(text).not.toMatch(/\bkept\b|latest read/i);
			expect(text).not.toContain(latestReadShown);
		});
	});
});
