import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIndex, renderOverview, renderProject } from "../src/render.js";

type ProjectState = Parameters<typeof renderProject>[2];

function task(name: string, fields: Record<string, unknown> = {}) {
	return {
		name,
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
		...fields,
	};
}

function workstream(name: string, active: boolean, steps: string[]) {
	return {
		name,
		summary: null,
		goal: `the goal of ${name}`,
		done_when: `the end of ${name}`,
		active,
		steps: steps.map((step) => ({
			name: step,
			description: `the step ${step}`,
		})),
		warnings: [],
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

function sectionsDocument() {
	return fullDocument({
		workstreams: [
			workstream("later-goal", false, ["later-step"]),
			workstream("active-goal", true, ["first-step"]),
		],
		tasks: [
			task("loose-task"),
			task("later-step", { workstreams: ["later-goal"], parts: ["step"] }),
			task("first-step", { workstreams: ["active-goal"], parts: ["step"] }),
			task("stray-task", { workstreams: ["active-goal"], unplaced: true }),
			task("working-task", {
				status: "in_flight",
				stage: "build:applying 15/18",
			}),
		],
	});
}

const readAt = "2026-11-01T22:18:05.123Z";
const shownTime = "2026-11-01 22:18:05 UTC";

function read(document: unknown): ProjectState {
	return { state: "read", document, readAt } as unknown as ProjectState;
}

function failed(reason: string): ProjectState {
	return { state: "failed", reason };
}

function page(document: unknown): string {
	return renderProject("work", "alpha", read(document));
}

function overview(projects: Record<string, ProjectState>): string {
	return renderOverview(
		{
			name: "work",
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

function textOf(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}

function smallestDetailsHolding(html: string, ...texts: string[]): string {
	const blocks: string[] = [];
	const open: number[] = [];
	for (const match of html.matchAll(/<details\b|<\/details>/g)) {
		if (match[0] === "</details>") {
			const start = open.pop();
			if (start !== undefined) {
				blocks.push(html.slice(start, match.index + match[0].length));
			}
		} else {
			open.push(match.index);
		}
	}
	const [block] = blocks
		.filter((candidate) => texts.every((text) => candidate.includes(text)))
		.sort((a, b) => a.length - b.length);
	if (block === undefined) {
		throw new Error(`no <details> holds ${texts.join(", ")}`);
	}
	return block;
}

function expectInOrder(text: string, names: string[]): void {
	const positions = names.map((name) => text.indexOf(name));
	expect(positions).not.toContain(-1);
	expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("The overview shows each project's state", () => {
	describe("Mixed states", () => {
		function mixed(): string {
			return textOf(
				overview({
					alpha: read(
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
					),
					gamma: failed("the tool refused"),
				}),
			);
		}

		it("shows the read project's counts and the time of its read", () => {
			const text = mixed();
			const first = text.slice(text.indexOf("alpha"), text.indexOf("gamma"));

			expect(first).toMatch(/\b3\b/);
			expect(first).toMatch(/\b7\b/);
			expect(first).toContain(`Read ${shownTime}`);
		});

		it("shows the failed project's reason, and no time of a read", () => {
			const text = mixed();
			const second = text.slice(text.indexOf("gamma"));

			expect(second).toContain("the tool refused");
			expect(second).not.toContain("UTC");
		});
	});
});

describe("A project's page shows its document", () => {
	describe("The sections", () => {
		it("keeps the sections in order, with the written and read times", () => {
			const text = textOf(page(sectionsDocument()));

			expectInOrder(text, [
				"working-task",
				"active-goal",
				"later-goal",
				"loose-task",
			]);
			expect(text).toMatch(/2026-11-01.22:17/);
			expect(text).toContain(`Read ${shownTime}`);
		});

		it("keeps the steps and the marked unplaced task inside <details>", () => {
			const html = page(sectionsDocument());

			const block = smallestDetailsHolding(html, "active-goal", "first-step");
			expect(block).toContain("first-step");
			expect(block).toContain("stray-task");
			expect(textOf(block)).toMatch(/unplaced/i);
		});
	});

	describe("A project with no workstreams", () => {
		it("shows its tasks and the read time, and no workstream section", () => {
			const text = textOf(page(fullDocument({ tasks: [task("loose-task")] })));

			expect(text).toContain("loose-task");
			expect(text).toContain(`Read ${shownTime}`);
			expect(text).not.toMatch(/active workstreams/i);
			expect(text).not.toMatch(/other workstreams/i);
		});
	});

	describe("The time of the read", () => {
		it("shows it to the second, in UTC", () => {
			expect(textOf(page(fullDocument()))).toContain(shownTime);
		});

		it("words it as the design does", () => {
			expect(textOf(page(fullDocument()))).toContain(`Read ${shownTime}`);
		});

		it("does not take the machine's time zone", () => {
			vi.stubEnv("TZ", "Pacific/Auckland");
			expect(new Date(readAt).getTimezoneOffset()).not.toBe(0);

			expect(textOf(page(fullDocument()))).toContain(shownTime);
		});
	});
});

describe("A page shows what was read for it", () => {
	describe("No script", () => {
		it("sends no script on any page", () => {
			const document = sectionsDocument();

			for (const html of [
				page(document),
				renderProject("work", "alpha", failed("the tool refused")),
				overview({ alpha: read(document) }),
				renderIndex([{ name: "work", projects: [] }]),
			]) {
				expect(html).not.toMatch(/<script/i);
			}
		});
	});
});
