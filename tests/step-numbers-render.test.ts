// Tests derived from the delta spec of `number-a-workstreams-steps`
// (openspec/changes/number-a-workstreams-steps/specs/board-pages/spec.md).
// Each assertion's classification is in that change's test-plan.md.
import { describe, expect, it } from "vitest";
import {
	fullDocument,
	page,
	step,
	task,
	workstream,
} from "./support/document.js";
import { blocks, escapeRegExp, textOf } from "./support/page.js";

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".

type Region = { start: number; end: number };

// The smallest block of `tag` within the region whose text holds `name` as a
// whole word.
function smallestHolding(
	html: string,
	tag: string,
	region: Region,
	...names: string[]
): Region & { html: string } {
	const found = blocks(html, tag)
		.filter((block) => block.start >= region.start && block.end <= region.end)
		.filter((block) => {
			const text = textOf(html.slice(block.start, block.end));
			return names.every((name) =>
				new RegExp(`(^|\\s)${escapeRegExp(name)}(\\s|$)`).test(text),
			);
		})
		.sort((a, b) => a.end - a.start - (b.end - b.start));
	const [block] = found;
	if (block === undefined) {
		throw new Error(`no <${tag}> in the region holds ${names.join(", ")}`);
	}
	return { ...block, html: html.slice(block.start, block.end) };
}

// Where the workstream sections begin: everything before is the tasks-in-work
// section (see tests/render.test.ts, "The sections").
function workstreamsStart(html: string): number {
	const at = html.indexOf("Active workstreams");
	if (at === -1) throw new Error("the page shows no Active workstreams");
	return at;
}

// The row of `name` among the steps of workstream `stream`: the smallest <li>
// holding it within the smallest <details> after the workstream sections
// begin that holds both names.
function streamRowText(html: string, stream: string, name: string): string {
	const stream_ = smallestHolding(
		html,
		"details",
		{ start: workstreamsStart(html), end: html.length },
		stream,
		name,
	);
	return textOf(smallestHolding(html, "li", stream_, name).html);
}

// The row of `name` in the tasks-in-work section, whose rows are not <li>:
// the smallest <div> before the workstream sections holding the name and the
// task's stage.
function inWorkRowText(html: string, name: string, stage: string): string {
	return textOf(
		smallestHolding(
			html,
			"div",
			{ start: 0, end: workstreamsStart(html) },
			name,
			stage,
		).html,
	);
}

// The row of `name` anywhere on the page.
function anyRowText(html: string, name: string): string {
	return textOf(
		smallestHolding(html, "li", { start: 0, end: html.length }, name).html,
	);
}

const NUMBER = /(?:^|\s)(\d+)\.(?=\s|$)/g;

// The numbers `N.` a row shows before the name.
function numbersBefore(rowText: string, name: string): string[] {
	const at = rowText.search(new RegExp(`(^|\\s)${escapeRegExp(name)}(\\s|$)`));
	expect(at).toBeGreaterThan(-1);
	return [...rowText.slice(0, at + 1).matchAll(NUMBER)].map(
		(match) => match[1] ?? "",
	);
}

// The numbers `N.` a row shows anywhere.
function numbersIn(rowText: string): string[] {
	return [...rowText.matchAll(NUMBER)].map((match) => match[1] ?? "");
}

describe("A workstream's steps are numbered", () => {
	describe("Numbered steps", () => {
		const html = page(
			fullDocument({
				workstreams: [workstream("stream-w", ["step-a", "step-b", "step-c"])],
				tasks: [
					step("step-a", "stream-w"),
					step("step-b", "stream-w"),
					step("step-c", "stream-w"),
				],
			}),
		);

		it.each([
			["step-a", "1"],
			["step-b", "2"],
			["step-c", "3"],
		])("shows %s's position, %s., before its name", (name, number) => {
			expect(
				numbersBefore(streamRowText(html, "stream-w", name), name),
			).toEqual([number]);
		});

		it("numbers by the order of steps, not of the document's tasks", () => {
			const shuffled = page(
				fullDocument({
					workstreams: [workstream("stream-w", ["step-a", "step-b", "step-c"])],
					tasks: [
						step("step-c", "stream-w"),
						step("step-a", "stream-w"),
						step("step-b", "stream-w"),
					],
				}),
			);

			expect(
				["step-a", "step-b", "step-c"].map((name) =>
					numbersBefore(streamRowText(shuffled, "stream-w", name), name),
				),
			).toEqual([["1"], ["2"], ["3"]]);
		});
	});

	describe("A step with no task", () => {
		const html = page(
			fullDocument({
				workstreams: [workstream("stream-w", ["step-a", "step-b"])],
				tasks: [step("step-b", "stream-w")],
			}),
		);

		it("shows 1. in the row of step-a, which has no task", () => {
			expect(
				numbersBefore(streamRowText(html, "stream-w", "step-a"), "step-a"),
			).toEqual(["1"]);
		});

		it("shows 2. in the row of step-b", () => {
			expect(
				numbersBefore(streamRowText(html, "stream-w", "step-b"), "step-b"),
			).toEqual(["2"]);
		});
	});

	describe("An unplaced task", () => {
		const html = page(
			fullDocument({
				workstreams: [workstream("stream-w", ["step-a"])],
				tasks: [
					step("step-a", "stream-w"),
					task("task-u", { workstreams: ["stream-w"], unplaced: true }),
				],
			}),
		);

		it("shows 1. in step-a's row", () => {
			expect(
				numbersBefore(streamRowText(html, "stream-w", "step-a"), "step-a"),
			).toEqual(["1"]);
		});

		it("shows no number in task-u's row, marked unplaced", () => {
			const text = streamRowText(html, "stream-w", "task-u");

			expect(text).toMatch(/unplaced/i);
			expect(numbersIn(text)).toEqual([]);
		});
	});

	describe("A step in work", () => {
		const html = page(
			fullDocument({
				workstreams: [workstream("stream-w", ["step-a", "step-b"])],
				tasks: [
					step("step-a", "stream-w"),
					step("step-b", "stream-w", {
						status: "in_flight",
						stage: "plan:drafting",
					}),
				],
			}),
		);

		it("shows 1. before step-a and 2. before step-b in the workstream", () => {
			expect(
				numbersBefore(streamRowText(html, "stream-w", "step-a"), "step-a"),
			).toEqual(["1"]);
			expect(
				numbersBefore(streamRowText(html, "stream-w", "step-b"), "step-b"),
			).toEqual(["2"]);
		});

		it("shows no number in step-b's row in the tasks-in-work section", () => {
			expect(numbersIn(inWorkRowText(html, "step-b", "plan:drafting"))).toEqual(
				[],
			);
		});
	});

	describe("A done step", () => {
		it("keeps its number", () => {
			const html = page(
				fullDocument({
					workstreams: [workstream("stream-w", ["step-a", "step-b"])],
					tasks: [
						step("step-a", "stream-w", { status: "done" }),
						step("step-b", "stream-w"),
					],
				}),
			);

			expect(
				numbersBefore(streamRowText(html, "stream-w", "step-a"), "step-a"),
			).toEqual(["1"]);
		});
	});

	describe("A task in no workstream", () => {
		it("shows no number in task-t's row", () => {
			const html = page(
				fullDocument({
					workstreams: [workstream("stream-w", ["step-a"])],
					tasks: [step("step-a", "stream-w"), task("task-t")],
				}),
			);

			// A step on the same page is numbered.
			expect(
				numbersBefore(streamRowText(html, "stream-w", "step-a"), "step-a"),
			).toEqual(["1"]);
			expect(numbersIn(anyRowText(html, "task-t"))).toEqual([]);
		});
	});
});
