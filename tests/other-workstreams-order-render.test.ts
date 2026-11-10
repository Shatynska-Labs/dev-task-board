// Tests derived from the delta spec of `order-other-workstreams-by-last-commit`
// (openspec/changes/order-other-workstreams-by-last-commit/specs/board-pages/spec.md).
// Each assertion's classification is in that change's test-plan.md.
import { describe, expect, it } from "vitest";
import {
	fullDocument,
	page,
	step,
	type Task,
	task,
	workstream,
} from "./support/document.js";
import { escapeRegExp, textOf } from "./support/page.js";

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".

// An inactive workstream: the shared builder always gives `active: true`.
function inactive(name: string, steps: string[]) {
	return { ...workstream(name, steps), active: false };
}

// A task with no `last_commit` key at all, as distinct from `null`.
function withoutCommit(value: Task): Task {
	const { last_commit: _, ...rest } = value;
	return rest as Task;
}

// The text of a workstream section: from its heading to the next of the
// page's later headings, or to the end of the page.
function sectionText(html: string, heading: RegExp, next?: RegExp): string {
	const text = textOf(html);
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

function otherOrder(document: unknown, ...names: string[]): string[] {
	return orderIn(sectionText(page(document), OTHER), ...names);
}

describe("Other workstreams are ordered by their latest commit", () => {
	it("Newest first: beta, at 200, before alpha, at 100", () => {
		const document = fullDocument({
			workstreams: [inactive("alpha", ["s-1"]), inactive("beta", ["s-2"])],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				step("s-2", "beta", { last_commit: 200 }),
			],
		});

		expect(otherOrder(document, "alpha", "beta")).toEqual(["beta", "alpha"]);
	});

	it("The latest of several tasks: alpha, at 100 and 300, before beta, at 200", () => {
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

		expect(otherOrder(document, "alpha", "beta")).toEqual(["alpha", "beta"]);
	});

	it("An unplaced task counts: alpha's unplaced 300 puts it before beta's 200", () => {
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

		expect(otherOrder(document, "alpha", "beta")).toEqual(["alpha", "beta"]);
	});

	it("No commit comes last: beta, at 100, before alpha, at null", () => {
		const document = fullDocument({
			workstreams: [inactive("alpha", ["s-1"]), inactive("beta", ["s-2"])],
			tasks: [
				step("s-1", "alpha", { last_commit: null }),
				step("s-2", "beta", { last_commit: 100 }),
			],
		});

		expect(otherOrder(document, "alpha", "beta")).toEqual(["beta", "alpha"]);
	});

	it("an absent last_commit also counts as none and comes last", () => {
		const document = fullDocument({
			workstreams: [inactive("alpha", ["s-1"]), inactive("beta", ["s-2"])],
			tasks: [
				withoutCommit(step("s-1", "alpha")),
				step("s-2", "beta", { last_commit: 100 }),
			],
		});

		expect(otherOrder(document, "alpha", "beta")).toEqual(["beta", "alpha"]);
	});

	it("Equal commits by name: alpha before beta, both at 100, beta first in the document", () => {
		const document = fullDocument({
			workstreams: [inactive("beta", ["s-1"]), inactive("alpha", ["s-2"])],
			tasks: [
				step("s-1", "beta", { last_commit: 100 }),
				step("s-2", "alpha", { last_commit: 100 }),
			],
		});

		expect(otherOrder(document, "alpha", "beta")).toEqual(["alpha", "beta"]);
	});

	it("No commits by name: alpha before beta, neither with a commit, beta first in the document", () => {
		const document = fullDocument({
			workstreams: [inactive("beta", ["s-1"]), inactive("alpha", ["s-2"])],
			tasks: [
				withoutCommit(step("s-1", "beta")),
				step("s-2", "alpha", { last_commit: null }),
			],
		});

		expect(otherOrder(document, "alpha", "beta")).toEqual(["alpha", "beta"]);
	});

	it("Active workstreams keep the document's order: alpha, at 100, before beta, at 200", () => {
		const document = fullDocument({
			workstreams: [workstream("alpha", ["s-1"]), workstream("beta", ["s-2"])],
			tasks: [
				step("s-1", "alpha", { last_commit: 100 }),
				step("s-2", "beta", { last_commit: 200 }),
			],
		});

		expect(
			orderIn(sectionText(page(document), ACTIVE, OTHER), "alpha", "beta"),
		).toEqual(["alpha", "beta"]);
	});
});
