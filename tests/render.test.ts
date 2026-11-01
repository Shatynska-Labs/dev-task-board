import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { renderIndex, renderOverview, renderProject } from "../src/render.js";
import {
	buildFixtureRepository,
	git,
	isolatedEnvironment,
} from "./support/fixture.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

type Task = {
	name: string;
	status: string;
	stage: string | null;
	workstreams: string[];
	unplaced: boolean;
	closed_workstream: string | null;
	parts: string[];
	last_commit: number | null;
	summary: string | null;
	priority: string | null;
	waits_on: string[];
	body: string | null;
	merge_unchecked: boolean;
	warnings: string[];
};

function task(name: string, fields: Partial<Task> = {}): Task {
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

function fullDocument(fields: Record<string, unknown> = {}): {
	tasks: Task[];
	[field: string]: unknown;
} {
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

// A document in which every section has something, and one workstream is listed
// before the other against the page's order.
function sectionsDocument() {
	return fullDocument({
		workstreams: [
			workstream("later-goal", false, ["later-step"]),
			workstream("active-goal", true, ["first-step", "second-step"]),
		],
		tasks: [
			task("loose-task"),
			task("later-step", { workstreams: ["later-goal"], parts: ["step"] }),
			task("first-step", {
				status: "done",
				workstreams: ["active-goal"],
				parts: ["step"],
			}),
			task("second-step", {
				status: "planned",
				workstreams: ["active-goal"],
				parts: ["step"],
			}),
			task("stray-task", { workstreams: ["active-goal"], unplaced: true }),
			task("working-task", {
				status: "in_flight",
				stage: "build:applying 15/18",
				parts: ["change", "branch"],
			}),
		],
	});
}

type ProjectState = Parameters<typeof renderProject>[2];

function read(document: unknown): ProjectState {
	return {
		state: "read",
		document,
		readAt: "2026-11-01T22:18:00Z",
	} as unknown as ProjectState;
}

const reading: ProjectState = { state: "reading" };

function failed(reason: string): ProjectState {
	return { state: "failed", reason };
}

function page(document: unknown): string {
	return renderProject("work", "alpha", read(document));
}

function overview(
	projects: Record<string, ProjectState | undefined>,
	workspace = "work",
): string {
	return renderOverview(
		{
			name: workspace,
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

// What a reader sees: inline CSS may carry any of these words as a class.
function textOf(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}

function detailsBlocks(html: string): string[] {
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
	return blocks;
}

function smallestDetailsHolding(html: string, ...texts: string[]): string {
	const holding = detailsBlocks(html)
		.filter((block) => texts.every((text) => block.includes(text)))
		.sort((a, b) => a.length - b.length);
	const [block] = holding;
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

function escapedLink(path: string): RegExp {
	const escaped = path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
	return new RegExp(`href=["']${escaped}["']`);
}

afterEach(removeTemporaryDirectories);

describe("Addresses reach workspaces and projects", () => {
	describe("Several workspaces", () => {
		it("links to each workspace", () => {
			const html = renderIndex([
				{ name: "a", projects: [] },
				{ name: "b", projects: [] },
			]);

			expect(html).toMatch(escapedLink("/a"));
			expect(html).toMatch(escapedLink("/b"));
		});

		it("percent-encodes names in links", () => {
			const html = renderIndex([{ name: 'my "work"#1', projects: [] }]);

			expect(html).toMatch(escapedLink("/my%20%22work%22%231"));
		});
	});
});

describe("The overview shows each project's state", () => {
	describe("Mixed states", () => {
		it("shows counts, being read and the reason, each in its project's row", () => {
			const document = fullDocument({
				tasks: [
					task("in-work-1", { status: "in_flight", stage: "plan:drafting" }),
					task("in-work-2", { status: "in_flight", stage: "plan:drafting" }),
					task("in-work-3", { status: "in_flight", stage: null }),
					task("rest-1"),
					task("rest-2", { status: "done" }),
					task("rest-3", { status: "planned" }),
					task("rest-4", { stage: "not-a-status" }),
				],
			});

			const html = overview({
				alpha: read(document),
				beta: reading,
				gamma: failed("the tool refused"),
			});

			const text = textOf(html);
			expectInOrder(text, ["alpha", "beta", "gamma"]);
			const first = text.slice(text.indexOf("alpha"), text.indexOf("beta"));
			const second = text.slice(text.indexOf("beta"), text.indexOf("gamma"));
			const third = text.slice(text.indexOf("gamma"));
			expect(first).toMatch(/\b3\b/);
			expect(first).toMatch(/\b7\b/);
			expect(first).not.toMatch(/being read/i);
			expect(second).toMatch(/being read/i);
			expect(second).not.toContain("the tool refused");
			expect(third).toContain("the tool refused");
			expect(third).not.toMatch(/being read/i);
		});

		it("links each project, whatever its state, percent-encoded", () => {
			const html = overview(
				{ alpha: reading, "b t#a": failed("no"), gamma: read(fullDocument()) },
				"my work",
			);

			expect(html).toMatch(escapedLink("/my%20work/alpha"));
			expect(html).toMatch(escapedLink("/my%20work/b%20t%23a"));
			expect(html).toMatch(escapedLink("/my%20work/gamma"));
		});
	});
});

describe("A project's page shows its document", () => {
	describe("The sections", () => {
		it("puts each in its section, in order", () => {
			expectInOrder(textOf(page(sectionsDocument())), [
				"working-task",
				"active-goal",
				"later-goal",
				"loose-task",
			]);
		});

		it("shows a task in work with its stage", () => {
			const text = textOf(page(sectionsDocument()));

			expect(text).toContain("build:applying 15/18");
			expect(text.indexOf("build:applying 15/18")).toBeLessThan(
				text.indexOf("active-goal"),
			);
		});

		it("opens a workstream with <details> to its steps", () => {
			const html = page(sectionsDocument());

			const active = smallestDetailsHolding(html, "active-goal", "first-step");
			expect(active).toContain("second-step");
			expect(active).not.toContain("later-goal");
			expect(active).not.toContain("loose-task");

			const later = smallestDetailsHolding(html, "later-goal", "later-step");
			expect(later).not.toContain("first-step");
		});

		it("puts the unplaced task inside its workstream, marked", () => {
			const html = page(sectionsDocument());

			const active = smallestDetailsHolding(html, "active-goal", "stray-task");
			expect(active).toContain("first-step");
			expect(textOf(active)).toMatch(/unplaced/i);
		});

		it("marks nothing unplaced in a document with no such task", () => {
			const document = sectionsDocument();
			document.tasks = document.tasks.map((entry) => ({
				...entry,
				unplaced: false,
				workstreams: [],
			}));

			expect(textOf(page(document))).not.toMatch(/unplaced/i);
		});

		it("shows the document's written_at", () => {
			expect(textOf(page(sectionsDocument()))).toMatch(/2026-11-01.22:17/);
		});
	});

	describe("Every task appears", () => {
		it("shows every task of a hand-written document of each kind", () => {
			const document = fullDocument({
				workstreams: [workstream("goal", true, ["in-a-step"])],
				tasks: [
					task("in-a-step", { workstreams: ["goal"], parts: ["step"] }),
					task("stray", { workstreams: ["goal"], unplaced: true }),
					task("stray-of-nothing-shown", {
						workstreams: ["no-such-workstream"],
						unplaced: true,
					}),
					task("closed", { closed_workstream: "finished-goal" }),
					task("flying", { status: "in_flight", stage: "plan:drafting" }),
					task("finished", { status: "done" }),
				],
			});

			const text = textOf(page(document));

			for (const { name } of document.tasks) {
				expect(text).toContain(name);
			}
		});

		it("shows every task of a document the carried tool printed", () => {
			const root = temporaryDirectory();
			const env = isolatedEnvironment(root);
			const project = join(root, "project");
			buildFixtureRepository(project, env, "docs/backlog/AGENTS.md");
			for (const entry of ["first-entry", "second-entry", "third-entry"]) {
				writeFileSync(
					join(project, "docs", "backlog", `${entry}.md`),
					`# ${entry}\n`,
				);
			}
			git(project, env, "add", ".");
			git(
				project,
				env,
				"-c",
				"user.name=Fixture",
				"-c",
				"user.email=fixture@example.invalid",
				"-c",
				"commit.gpgsign=false",
				"commit",
				"--quiet",
				"-m",
				"entries",
			);
			const printed = execFileSync(
				"bash",
				[join(repositoryRoot, "vendor", "task-board"), "--json", project],
				{ env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
			);
			const document = JSON.parse(printed) as { tasks: { name: string }[] };
			expect(document.tasks).toHaveLength(3);

			const text = textOf(page(document));

			for (const { name } of document.tasks) {
				expect(text).toContain(name);
			}
		});
	});

	describe("Status, stage and placement come from the document", () => {
		it("takes only an in_flight status as in work, whatever else a task holds", () => {
			const document = fullDocument({
				workstreams: [workstream("goal", true, ["held-step"])],
				tasks: [
					task("entry-only", { status: "in_flight", stage: "plan:drafting" }),
					task("change-and-branch", {
						parts: ["change", "branch"],
						last_commit: 1793569608,
					}),
					task("held-step", { workstreams: ["goal"], parts: ["step"] }),
				],
			});

			const text = textOf(page(document));

			expectInOrder(text, ["entry-only", "goal", "change-and-branch"]);
		});

		it("takes a workstream's activity from active, not from its tasks", () => {
			const document = fullDocument({
				workstreams: [
					workstream("inactive-with-work", false, ["busy-step"]),
					workstream("active-and-idle", true, ["idle-step"]),
				],
				tasks: [
					task("busy-step", {
						status: "in_flight",
						stage: "plan:drafting",
						workstreams: ["inactive-with-work"],
						parts: ["step", "change"],
					}),
					task("idle-step", {
						workstreams: ["active-and-idle"],
						parts: ["step"],
					}),
				],
			});

			// After the first section, whose rows name their workstream.
			const text = textOf(page(document));
			expectInOrder(text.slice(text.indexOf("Active workstreams")), [
				"active-and-idle",
				"inactive-with-work",
			]);
		});

		it("shows a stage as the document words it", () => {
			const document = fullDocument({
				tasks: [
					task("flying", {
						status: "in_flight",
						stage: "a stage no rule here knows",
					}),
				],
			});

			expect(textOf(page(document))).toContain("a stage no rule here knows");
		});
	});

	describe("A project with no workstreams", () => {
		it("shows its tasks, and no workstream section", () => {
			const document = fullDocument({
				tasks: [
					task("flying", { status: "in_flight", stage: "plan:drafting" }),
					task("loose-task"),
				],
			});

			const text = textOf(page(document));

			expect(text).toContain("flying");
			expect(text).toContain("loose-task");
			expect(text).not.toMatch(/active workstreams/i);
			expect(text).not.toMatch(/other workstreams/i);
		});

		it("names both workstream sections where there are workstreams", () => {
			const text = textOf(page(sectionsDocument()));

			expect(text).toMatch(/active workstreams/i);
			expect(text).toMatch(/other workstreams/i);
		});
	});

	describe("A page for a project not read", () => {
		it("says it is being read", () => {
			const html = renderProject("work", "alpha", reading);

			expect(textOf(html)).toMatch(/being read/i);
		});

		it("says it failed, with the reason", () => {
			const html = renderProject("work", "alpha", failed("the tool refused"));

			expect(textOf(html)).toContain("the tool refused");
			expect(textOf(html)).not.toMatch(/being read/i);
		});
	});
});

describe("The accepted layout", () => {
	it("says so where nothing is in flight", () => {
		const text = textOf(page(fullDocument({ tasks: [task("loose-task")] })));

		expect(text).toContain("In work (0)");
		expect(text).toContain("Nothing is in flight.");
	});

	it("takes a task's age from written_at", () => {
		const writtenAt = "2026-11-01T22:00:00Z";
		const twoHours = Date.parse(writtenAt) / 1000 - 2 * 3600;
		const threeDays = Date.parse(writtenAt) / 1000 - 3 * 86400;
		const text = textOf(
			page(
				fullDocument({
					written_at: writtenAt,
					tasks: [
						task("recent", { last_commit: twoHours }),
						task("older", { last_commit: threeDays }),
					],
				}),
			),
		);

		expect(text).toMatch(/recent.*2 h/);
		expect(text).toMatch(/older.*3 d/);
	});

	it.each([
		["plan:drafting", '<i class="on"></i><i></i><i></i>'],
		["build:applying", '<i class="past"></i><i class="on"></i><i></i>'],
		[
			"ship:merged",
			'<i class="past"></i><i class="past"></i><i class="on"></i>',
		],
		["unknown", "<i></i><i></i><i></i>"],
	])("lights the stages of %s", (stage, lit) => {
		const html = page(
			fullDocument({ tasks: [task("flying", { status: "in_flight", stage })] }),
		);

		expect(html).toContain(lit);
	});

	it("counts an unplaced task in flight as work in its workstream", () => {
		const text = textOf(
			page(
				fullDocument({
					workstreams: [workstream("goal", true, ["a-step", "b-step"])],
					tasks: [
						task("a-step", { workstreams: ["goal"] }),
						task("b-step", { workstreams: ["goal"] }),
						task("stray", {
							status: "in_flight",
							workstreams: ["goal"],
							unplaced: true,
						}),
					],
				}),
			),
		);

		expect(text).toContain("0 of 2 done, 1 in work");
	});

	it("orders tasks in no workstream in flight first and parked last", () => {
		const text = textOf(
			page(
				fullDocument({
					tasks: [
						task("a-parked", { priority: "parked", last_commit: 9 }),
						task("b-older", { last_commit: 1 }),
						task("c-newer", { last_commit: 2 }),
					],
				}),
			),
		);

		expectInOrder(text, ["c-newer", "b-older", "a-parked"]);
	});

	it("shows an in-flight task's summary, unplaced tag and unchecked forge", () => {
		const text = textOf(
			page(
				fullDocument({
					forge: "none",
					workstreams: [workstream("goal", true, [])],
					tasks: [
						task("flying", {
							status: "in_flight",
							stage: "plan:drafting",
							summary: "what it does",
							workstreams: ["goal"],
							unplaced: true,
						}),
					],
				}),
			),
		);
		const inWork = text.slice(0, text.indexOf("Active workstreams"));

		expect(inWork).toContain("what it does");
		expect(inWork).toContain("unplaced");
		expect(inWork).toContain("pull requests not checked");
	});
});

describe("A partial forge read is noticed", () => {
	const notice = /statuses may be wrong/i;

	describe("No forge", () => {
		it("shows the notice on the page and in the overview's row", () => {
			const document = fullDocument({ forge: "none" });

			expect(textOf(page(document))).toMatch(notice);

			const text = textOf(
				overview({ alpha: read(document), beta: read(fullDocument()) }),
			);
			expect(text.slice(0, text.indexOf("beta"))).toMatch(notice);
			expect(text.slice(text.indexOf("beta"))).not.toMatch(notice);
		});

		it.each(["partial", "limited"])("shows it for a forge of %s", (forge) => {
			expect(textOf(page(fullDocument({ forge })))).toMatch(notice);
		});
	});

	describe("A full forge", () => {
		it("shows no notice on the page or in the overview", () => {
			const document = fullDocument({ forge: "full" });

			expect(textOf(page(document))).not.toMatch(notice);
			expect(textOf(overview({ alpha: read(document) }))).not.toMatch(notice);
		});
	});
});

describe("Document text is escaped", () => {
	const markup = "<script>alert(1)</script>";
	const shownAsText = "&lt;script&gt;alert(1)&lt;/script&gt;";

	describe("Markup in a task", () => {
		it("appears as text on a project's page", () => {
			const html = page(
				fullDocument({
					workstreams: [workstream("goal", true, [markup])],
					tasks: [
						task(markup, { workstreams: ["goal"], parts: ["step"] }),
						task("flying", { status: "in_flight", stage: markup }),
					],
				}),
			);

			expect(html).toContain(shownAsText);
			expect(html).not.toContain(markup);
		});

		it("escapes every text field of a document", () => {
			const raw = "<b>marker</b>";
			const html = page(
				fullDocument({
					project: raw,
					written_at: raw,
					trunk: { ref: raw, commit: raw },
					workstreams: [
						{
							...workstream(raw, true, [raw]),
							goal: raw,
							done_when: raw,
							summary: raw,
						},
					],
					tasks: [
						task(raw, {
							status: raw,
							stage: raw,
							workstreams: [raw],
							summary: raw,
							body: raw,
							priority: raw,
							closed_workstream: raw,
						}),
						task(`${raw}2`, { workstreams: [raw], unplaced: true }),
						task(`${raw}3`, {
							status: "in_flight",
							stage: raw,
							summary: raw,
							workstreams: [raw],
							parts: [raw],
							waits_on: [raw],
							warnings: [raw],
						}),
					],
				}),
			);

			expect(html).not.toContain("<b>marker");
		});

		it("escapes names from settings", () => {
			const raw = '<b>"name"';

			expect(renderIndex([{ name: raw, projects: [] }])).not.toContain("<b>");
			expect(overview({ [raw]: reading }, raw)).not.toContain("<b>");
			expect(renderProject(raw, raw, reading)).not.toContain("<b>");
		});
	});

	describe("Markup in a reason", () => {
		it("appears as text on a project's page and in the overview", () => {
			const reason = "refused <b>loudly</b>";
			const shown = "refused &lt;b&gt;loudly&lt;/b&gt;";

			const onPage = renderProject("work", "alpha", failed(reason));
			const onOverview = overview({ alpha: failed(reason) });

			expect(onPage).toContain(shown);
			expect(onPage).not.toContain("<b>");
			expect(onOverview).toContain(shown);
			expect(onOverview).not.toContain("<b>");
		});
	});
});
