import { describe, expect, it } from "vitest";
import { whatMissed } from "../src/reads.js";
import { renderOverview, renderProject } from "../src/render.js";

type ProjectState = Parameters<typeof renderProject>[2];

const wrongStatuses = /statuses may be wrong/gi;
const documentRead = "2026-11-01T22:18:05.000Z";
const documentReadShown = "2026-11-01 22:18:05 UTC";
const latestRead = "2026-11-01T22:48:10.000Z";

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

function noToken(account: string, fields: Record<string, unknown> = {}) {
	return fullDocument({ forge: "none", no_token_for: account, ...fields });
}

function task(name: string) {
	return {
		name,
		status: "in_flight",
		stage: null,
		workstreams: [],
		unplaced: false,
		closed_workstream: null,
		parts: ["entry"],
		last_commit: null,
		summary: null,
		priority: null,
		waits_on: [],
		body: null,
		merge_unchecked: false,
		warnings: [],
	};
}

function missedBy(document: unknown): string[] {
	return whatMissed(document as Parameters<typeof whatMissed>[0]);
}

function read(
	document: unknown,
	latest?: { at: string; missed?: string[] },
): ProjectState {
	return {
		state: "read",
		document,
		readAt: documentRead,
		...(latest === undefined ? {} : { latest }),
	} as unknown as ProjectState;
}

function keptPast(document: unknown, later: unknown): ProjectState {
	return read(document, { at: latestRead, missed: missedBy(later) });
}

function page(state: ProjectState): string {
	return renderProject("desk", "alpha", state);
}

function row(state: ProjectState): string {
	const text = textOf(
		renderOverview(
			{
				name: "desk",
				projects: [
					{ name: "alpha", path: "/srv/alpha" },
					{ name: "beta", path: "/srv/beta" },
				],
			},
			{
				get: (_workspace: string, project: string) =>
					project === "alpha" ? state : read(fullDocument({ project: "beta" })),
			} as unknown as Parameters<typeof renderOverview>[1],
		),
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

describe("A page names an account it could not use", () => {
	describe("What a document missed", () => {
		it("is a line naming the account, beside the forge line", () => {
			const missed = missedBy(noToken("someone"));

			expect(missed).toHaveLength(2);
			expect(missed.filter((line) => line.includes("someone"))).toHaveLength(1);
			expect(missed.join("\n")).toMatch(wrongStatuses);
		});

		it("names no account for a document with none", () => {
			expect(missedBy(fullDocument({ forge: "none" })).join("\n")).not.toMatch(
				/account/i,
			);
		});
	});

	describe("No token, nothing held before", () => {
		const state = read(noToken("someone"));

		it("names the account and says statuses may be wrong on the page", () => {
			const text = textOf(page(state));

			expect(text).toContain("someone");
			expect(count(text, wrongStatuses)).toBe(1);
		});

		it("names the account and says statuses may be wrong in the overview's row", () => {
			const text = row(state);

			expect(text).toContain("someone");
			expect(count(text, wrongStatuses)).toBe(1);
		});

		it("names the account where the document shown still reached the forge", () => {
			const text = textOf(page(read(noToken("someone", { forge: "full" }))));

			expect(text).toContain("someone");
			expect(text).not.toMatch(wrongStatuses);
		});
	});

	describe("No token, a full document held", () => {
		const state = keptPast(
			fullDocument({ tasks: [task("kept-task")] }),
			noToken("someone"),
		);

		it("shows the kept document's tasks, its age and the account on the page", () => {
			const text = textOf(page(state));

			expect(text).toContain("kept-task");
			expect(text).toContain(documentReadShown);
			expect(text).toMatch(/\b30 min\b/);
			expect(text).toContain("someone");
		});

		it("names the account in the overview's row", () => {
			expect(row(state)).toContain("someone");
		});
	});

	describe("The line of what was missed", () => {
		const both = keptPast(noToken("someone"), noToken("someone"));

		it("appears once on the page, missed by both documents", () => {
			expect(count(textOf(page(both)), /someone/g)).toBe(1);
		});

		it("appears once in the overview's row, missed by both documents", () => {
			expect(count(row(both), /someone/g)).toBe(1);
		});
	});

	describe("An account's name needing care", () => {
		const state = read(noToken("<b>"));

		it("appears as text on the page", () => {
			const html = page(state);

			expect(html).toContain("&lt;b&gt;");
			expect(html).not.toContain("<b>");
		});

		it("appears as text in the overview's row", () => {
			const text = row(state);

			expect(text).toContain("&lt;b&gt;");
			expect(text).not.toContain("<b>");
		});
	});
});
