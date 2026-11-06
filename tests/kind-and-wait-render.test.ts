// Tests derived from the delta spec of `show-a-tasks-kind-and-wait`
// (openspec/changes/show-a-tasks-kind-and-wait/specs/board-pages/spec.md).
// Each assertion's classification is in that change's test-plan.md.
import { describe, expect, it } from "vitest";
import {
	fullDocument,
	loosePage,
	page,
	step,
	type Task,
	task,
	workstream,
} from "./support/document.js";
import {
	blocks,
	expectInOrder,
	rowOf,
	rowText,
	rowUpToName,
	streamHead,
	struckThrough,
	textOf,
	titlesAround,
	titlesIn,
} from "./support/page.js";

const KINDS = /\b(fix|change)\b/;
const NEEDS = /\b(must|should|could)\b/;
const READY = /\bready\b/;
const COUNTS =
	/\d+ (must left|ready|blocked by a task|wait for your decision|wait for someone else|parked)/;

describe("A task's row shows its kind and need", () => {
	describe("Kind and need", () => {
		const fields: Partial<Task> = {
			status: "recorded",
			kind: "fix",
			need: "must",
			readiness: "ready",
			waits_on_done: [],
			waits_for: null,
			waits_for_type: [],
		};

		it.each([
			["in no workstream", loosePage(task("task-t", fields))],
			[
				"in a workstream",
				page(
					fullDocument({
						workstreams: [workstream("goal", ["task-t"])],
						tasks: [step("task-t", "goal", fields)],
					}),
				),
			],
		])("shows fix and must in the row of a task %s", (_, html) => {
			const text = rowText(html, "task-t");

			expect(text).toMatch(/\bfix\b/);
			expect(text).toMatch(/\bmust\b/);
		});

		it.each([
			["in no workstream", loosePage(task("task-t", fields))],
			[
				"in a workstream",
				page(
					fullDocument({
						workstreams: [workstream("goal", ["task-t"])],
						tasks: [step("task-t", "goal", fields)],
					}),
				),
			],
		])(
			"heads the rows of a task %s with Kind, Need and Waits between Task and Last commit",
			(_, html) => {
				const heads = blocks(html, "li")
					.map((block) => textOf(html.slice(block.start, block.end)))
					.filter(
						(text) => text.includes("Last commit") && text.includes("Task"),
					)
					.sort((a, b) => a.length - b.length);

				expect(heads.length).toBeGreaterThan(0);
				expectInOrder(heads[0] ?? "", [
					"Task",
					"Kind",
					"Need",
					"Waits",
					"Last commit",
				]);
			},
		);

		it("puts kind, need and waits between the task and its last commit", () => {
			const text = rowText(loosePage(task("task-t", fields)), "task-t");

			expectInOrder(text, ["task-t", "fix", "must", "ready", "3 d"]);
		});
	});

	describe("A done task", () => {
		it("shows no kind, no need and nothing under Waits", () => {
			const html = loosePage(
				task("live-task", {
					kind: "change",
					need: "should",
					readiness: "ready",
					waits_on_done: [],
					waits_for_type: [],
				}),
				task("done-task", {
					status: "done",
					kind: "change",
					need: "should",
					readiness: null,
					waits_on_done: [],
					waits_for_type: [],
				}),
			);
			const text = rowText(html, "done-task");

			// The same kind and need on an open task show.
			expect(rowText(html, "live-task")).toMatch(/\bchange\b/);
			expect(rowText(html, "live-task")).toMatch(/\bshould\b/);
			expect(text).not.toMatch(KINDS);
			expect(text).not.toMatch(NEEDS);
			expect(text).not.toMatch(READY);
		});

		it("shows nothing under Waits even where it named a wait", () => {
			const text = rowText(
				loosePage(
					task("done-task", {
						status: "done",
						kind: "change",
						need: "should",
						waits_on: ["dep-x"],
						waits_on_done: ["dep-x"],
						waits_for: "an answer from someone",
						waits_for_type: ["answer"],
						priority: "parked",
						parked_until: "a later time",
						readiness: null,
					}),
				),
				"done-task",
			);

			expect(text).not.toContain("dep-x");
			expect(text).not.toContain("an answer from someone");
			expect(text).not.toMatch(/\banswer\b/);
			expect(text).not.toMatch(/\bparked\b/);
			expect(text).not.toMatch(READY);
		});
	});

	describe("A null kind or need", () => {
		it("shows no kind and no need", () => {
			const html = loosePage(
				task("live-task", {
					kind: "change",
					need: "should",
					readiness: "ready",
					waits_on_done: [],
					waits_for_type: [],
				}),
				task("null-task", {
					kind: null,
					need: null,
					readiness: "ready",
					waits_on_done: [],
					waits_for_type: [],
				}),
			);
			const text = rowText(html, "null-task");

			expect(rowText(html, "live-task")).toMatch(/\bchange\b/);
			expect(text).not.toMatch(KINDS);
			expect(text).not.toMatch(NEEDS);
		});
	});

	describe("A could task", () => {
		const as = (need: string, status = "recorded") =>
			loosePage(
				task("task-c", {
					status,
					kind: "change",
					need,
					readiness: status === "done" ? null : "ready",
					waits_on_done: [],
					waits_for_type: [],
				}),
			);

		it("marks the row dimmed, where a should row is not", () => {
			expect(rowUpToName(as("could"), "task-c")).not.toEqual(
				rowUpToName(as("should"), "task-c"),
			);
		});

		it("does not mark a done could task's row", () => {
			// Where an open could row is marked, a done one is not.
			expect(rowUpToName(as("could"), "task-c")).not.toEqual(
				rowUpToName(as("should"), "task-c"),
			);
			expect(rowUpToName(as("could", "done"), "task-c")).toEqual(
				rowUpToName(as("should", "done"), "task-c"),
			);
		});
	});
});

describe("A task's row shows what it waits on", () => {
	describe("A ready task", () => {
		it("shows ready", () => {
			const text = rowText(
				loosePage(
					task("task-r", {
						kind: "change",
						need: "should",
						readiness: "ready",
						waits_on: [],
						waits_on_done: [],
						waits_for: null,
						waits_for_type: [],
					}),
				),
				"task-r",
			);

			expect(text).toMatch(READY);
		});
	});

	describe("Waits on names, one done", () => {
		const html = loosePage(
			task("held-task", {
				kind: "change",
				need: "should",
				waits_on: ["dep-a", "dep-b"],
				waits_on_done: ["dep-a"],
				waits_for: null,
				waits_for_type: [],
				readiness: "blocked",
			}),
		);

		it("shows dep-a struck through and dep-b not", () => {
			expect(struckThrough(html, "held-task", "dep-a")).toBe(true);
			expect(struckThrough(html, "held-task", "dep-b")).toBe(false);
		});

		it("shows no ready, and no note reading Waits on", () => {
			const text = rowText(html, "held-task");

			expect(text).not.toMatch(READY);
			expect(text).not.toMatch(/Waits on/i);
		});

		it("strikes a name by waits_on_done, not by a done task of that name on the page", () => {
			const page = loosePage(
				task("dep-a", { status: "done" }),
				task("held-task", {
					waits_on: ["dep-a"],
					waits_on_done: [],
					waits_for_type: [],
					readiness: "blocked",
				}),
			);

			expect(struckThrough(page, "held-task", "dep-a")).toBe(false);
		});
	});

	describe("A typed condition", () => {
		const condition = "the operator's choice of model";
		const html = loosePage(
			task("typed-task", {
				kind: "change",
				need: "should",
				waits_for: condition,
				waits_for_type: ["decision", "access"],
				waits_on_done: [],
				readiness: "waiting",
			}),
		);

		it("shows your decision, access and the condition", () => {
			const text = rowText(html, "typed-task");

			expect(text).toContain("your decision");
			expect(text).toMatch(/\baccess\b/);
			expect(text).toContain(condition);
		});

		it("gives the condition in full as a title, escaped", () => {
			expect(titlesIn(rowOf(html, "typed-task").html)).toContain(condition);
		});
	});

	describe("An untyped condition", () => {
		const condition = "the head's answer";
		const html = loosePage(
			task("untyped-task", {
				kind: "change",
				need: "should",
				waits_for: condition,
				waits_for_type: [],
				waits_on_done: [],
				readiness: "waiting",
			}),
		);

		it("shows one mark for the wait, reading waits for", () => {
			const text = rowText(html, "untyped-task");

			expect(text.match(/waits for/gi) ?? []).toHaveLength(1);
		});

		it("shows the condition, and gives it in full as a title", () => {
			expect(rowText(html, "untyped-task")).toContain(condition);
			expect(titlesIn(rowOf(html, "untyped-task").html)).toContain(condition);
		});
	});

	describe("Markup in a wait", () => {
		const html = loosePage(
			task("markup-task", {
				waits_on: ["<b>x</b>"],
				waits_on_done: [],
				waits_for: "<i>y</i>",
				waits_for_type: [],
				readiness: "blocked",
			}),
		);

		it("shows both as text", () => {
			const row = rowOf(html, "markup-task").html;

			expect(row).toContain("&lt;b&gt;x&lt;/b&gt;");
			expect(row).toContain("&lt;i&gt;y&lt;/i&gt;");
			expect(html).not.toContain("<b>x");
			expect(html).not.toContain("<i>y");
		});
	});
});

describe("A wait already met stays visible", () => {
	describe("A wait already met", () => {
		it("shows ready and dep-a struck through", () => {
			const html = loosePage(
				task("met-task", {
					kind: "change",
					need: "should",
					waits_on: ["dep-a"],
					waits_on_done: ["dep-a"],
					waits_for: null,
					waits_for_type: [],
					readiness: "ready",
				}),
			);

			expect(rowText(html, "met-task")).toMatch(READY);
			expect(struckThrough(html, "met-task", "dep-a")).toBe(true);
		});
	});
});

describe("A wait is shown once", () => {
	describe("A parked task", () => {
		const html = loosePage(
			task("task-p", {
				kind: "change",
				need: "should",
				priority: "parked",
				parked_until: "the API is public",
				waits_on_done: [],
				waits_for: null,
				waits_for_type: [],
				readiness: "parked",
			}),
		);

		it("shows parked under Waits, with the API is public as its title", () => {
			const text = rowText(html, "task-p");

			expectInOrder(text, ["task-p", "change", "should", "parked"]);
			expect(titlesAround(html, "task-p", "parked")).toContain(
				"the API is public",
			);
		});

		it("shows no parked tag beside its name", () => {
			const text = rowText(html, "task-p");
			const beforeKind = text.slice(0, text.indexOf("change"));

			expect(text.indexOf("change")).toBeGreaterThan(-1);
			expect(beforeKind).not.toMatch(/\bparked\b/);
			expect(text.match(/\bparked\b/g) ?? []).toHaveLength(1);
		});
	});

	describe("A high task", () => {
		it("keeps a high tag beside its name", () => {
			const text = rowText(
				loosePage(
					task("task-h", {
						kind: "change",
						need: "should",
						priority: "high",
						waits_on_done: [],
						waits_for_type: [],
						readiness: "ready",
					}),
				),
				"task-h",
			);

			expectInOrder(text, ["task-h", "change", "should"]);
			expect(text.indexOf("high")).toBeLessThan(text.indexOf("change"));
		});
	});

	describe("A document from an older tool", () => {
		it("renders, with no kind, no need and no ready", () => {
			const html = loosePage(task("old-task"));
			const text = rowText(html, "old-task");
			// The same task, given the new keys, shows them.
			const given = rowText(
				loosePage(
					task("old-task", {
						kind: "fix",
						need: "must",
						readiness: "ready",
						waits_on_done: [],
						waits_for_type: [],
					}),
				),
				"old-task",
			);

			expect(given).toMatch(KINDS);
			expect(given).toMatch(NEEDS);
			expect(given).toMatch(READY);
			expect(text).not.toMatch(KINDS);
			expect(text).not.toMatch(NEEDS);
			expect(text).not.toMatch(READY);
		});

		it("still shows its waits_on and parked marks", () => {
			const html = loosePage(
				task("old-held", { waits_on: ["dep-old"] }),
				task("old-parked", { priority: "parked" }),
			);

			expect(rowText(html, "old-held")).toContain("dep-old");
			expect(rowText(html, "old-held")).not.toMatch(/Waits on/i);
			expect(rowText(html, "old-parked").replace("old-parked", "")).toMatch(
				/\bparked\b/,
			);
		});
	});
});

describe("A workstream counts its open steps", () => {
	describe("Mixed steps", () => {
		const names = ["s-done", "s-ready", "s-blocked", "s-decision", "s-answer"];
		const html = page(
			fullDocument({
				workstreams: [workstream("goal", names, "the summary s")],
				tasks: [
					step("s-done", "goal", {
						status: "done",
						need: "must",
						readiness: null,
					}),
					step("s-ready", "goal", { need: "must", readiness: "ready" }),
					step("s-blocked", "goal", {
						need: "should",
						waits_on: ["s-ready"],
						readiness: "blocked",
					}),
					step("s-decision", "goal", {
						need: "should",
						waits_for: "a choice",
						waits_for_type: ["decision"],
						readiness: "waiting",
					}),
					step("s-answer", "goal", {
						need: "should",
						waits_for: "a reply",
						waits_for_type: ["answer"],
						readiness: "waiting",
					}),
				],
			}),
		);

		it("shows the summary, then each count in order, and no parked count", () => {
			const head = streamHead(html, "goal", "s-done");

			expectInOrder(head, [
				"the summary s",
				"1 must left",
				"1 ready",
				"1 blocked by a task",
				"1 wait for your decision",
				"1 wait for someone else",
			]);
			expect(head).not.toMatch(/\d+ parked/);
		});
	});

	describe("A blocked step with a decision type", () => {
		it("counts it once, as blocked", () => {
			const html = page(
				fullDocument({
					workstreams: [workstream("goal", ["s-one"])],
					tasks: [
						step("s-one", "goal", {
							need: "should",
							waits_on: ["elsewhere"],
							waits_for: "a choice",
							waits_for_type: ["decision"],
							readiness: "blocked",
						}),
					],
				}),
			);
			const head = streamHead(html, "goal", "s-one");

			expect(head).toContain("1 blocked by a task");
			expect(head).not.toMatch(/wait for your decision/);
			expect(head).not.toMatch(/wait for someone else/);
		});
	});

	describe("Parked steps", () => {
		it("counts them last", () => {
			const html = page(
				fullDocument({
					workstreams: [workstream("goal", ["s-one", "s-two", "s-three"])],
					tasks: [
						step("s-one", "goal", { need: "must", readiness: "ready" }),
						step("s-two", "goal", {
							need: "should",
							priority: "parked",
							readiness: "parked",
						}),
						step("s-three", "goal", {
							need: "should",
							priority: "parked",
							readiness: "parked",
						}),
					],
				}),
			);
			const head = streamHead(html, "goal", "s-one");

			expectInOrder(head, ["1 must left", "1 ready", "2 parked"]);
		});
	});

	describe("Nothing open", () => {
		it("shows no count", () => {
			const html = page(
				fullDocument({
					workstreams: [
						workstream("stream-one", ["s-one", "s-two"], "the summary s"),
						workstream("stream-two", ["s-open"]),
					],
					tasks: [
						step("s-one", "stream-one", {
							status: "done",
							need: "must",
							readiness: null,
						}),
						step("s-two", "stream-one", {
							status: "done",
							need: "must",
							readiness: null,
						}),
						step("s-open", "stream-two", { need: "must", readiness: "ready" }),
					],
				}),
			);
			const head = streamHead(html, "stream-one", "s-one");

			// A workstream with an open step on the same page counts it.
			expect(streamHead(html, "stream-two", "s-open")).toContain("1 must left");
			expect(head).toContain("the summary s");
			expect(head).not.toMatch(COUNTS);
		});
	});
});
