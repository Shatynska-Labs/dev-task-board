import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The release workflow runs on GitHub Actions and cannot run here, so these
// checks read `.github/workflows/release.yml` statically. Each check is a
// function returning the problems it finds, run over the real workflow and,
// as a discriminator, over workflows this file writes itself.

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const releaseWorkflow = join(
	repositoryRoot,
	".github",
	"workflows",
	"release.yml",
);

// --- A reader for the subset of YAML a workflow uses -----------------------
//
// The project carries no YAML parser. This reads block mappings, block
// sequences, block scalars (`|`, `>`) and single-line scalars, and throws on
// anything else rather than guessing at it. Flow collections are kept as text.

type Yaml = string | null | Yaml[] | { [key: string]: Yaml };
type Line = { indent: number; text: string };

const KEY = /^("[^"]*"|'[^']*'|[^\s"'#-][^:#]*?|-[^\s:#][^:#]*?)\s*:(?:\s+|$)/;

function parseYaml(source: string): Yaml {
	const lines: Line[] = source
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((raw) => {
			const text = raw.replace(/^ +/, "");
			return { indent: raw.length - text.length, text: text.trimEnd() };
		});
	let at = 0;

	const isContent = (line: Line) =>
		line.text !== "" && !line.text.startsWith("#") && line.text !== "---";
	const isItem = (text: string) => text === "-" || text.startsWith("- ");
	const skip = () => {
		while (at < lines.length && !isContent(lines[at] as Line)) at++;
	};
	const current = () => lines[at] as Line;
	const unreadable = (why: string): never => {
		throw new Error(`release.yml line ${at + 1}: ${why}: ${current().text}`);
	};

	function block(indent: number): Yaml {
		skip();
		if (at >= lines.length) return null;
		const line = current();
		if (line.indent < indent) return null;
		return isItem(line.text) ? sequence(line.indent) : mapping(line.indent);
	}

	function nested(indent: number, allowSameIndentSequence: boolean): Yaml {
		skip();
		if (at >= lines.length) return null;
		const line = current();
		if (line.indent > indent) return block(line.indent);
		if (allowSameIndentSequence && line.indent === indent && isItem(line.text))
			return sequence(indent);
		return null;
	}

	function sequence(indent: number): Yaml[] {
		const items: Yaml[] = [];
		for (;;) {
			skip();
			if (at >= lines.length) break;
			const line = current();
			if (line.indent > indent) unreadable("unexpected indentation");
			if (line.indent < indent || !isItem(line.text)) break;
			const rest = line.text.slice(1).replace(/^ +/, "");
			if (rest === "") {
				at++;
				items.push(nested(indent, false));
				continue;
			}
			const column = indent + (line.text.length - rest.length);
			if (KEY.test(rest) || isItem(rest)) {
				lines[at] = { indent: column, text: rest };
				items.push(block(column));
			} else {
				at++;
				items.push(scalar(rest));
			}
		}
		return items;
	}

	function mapping(indent: number): { [key: string]: Yaml } {
		const map: { [key: string]: Yaml } = {};
		for (;;) {
			skip();
			if (at >= lines.length) break;
			const line = current();
			if (line.indent > indent) unreadable("unexpected indentation");
			if (line.indent < indent || isItem(line.text)) break;
			const match = KEY.exec(line.text);
			if (!match) return unreadable("not a key");
			const key = unquote((match[1] as string).trim());
			const rest = line.text.slice(match[0].length).trim();
			at++;
			map[key] = value(rest, indent);
		}
		return map;
	}

	function value(rest: string, indent: number): Yaml {
		if (rest === "" || rest.startsWith("#")) return nested(indent, true);
		const header = /^([|>])[+-]?\d*\s*(#.*)?$/.exec(rest);
		if (header) return blockScalar(indent, header[1] === ">");
		return scalar(rest);
	}

	function blockScalar(parent: number, folded: boolean): string {
		const taken: Line[] = [];
		while (at < lines.length) {
			const line = current();
			if (line.text !== "" && line.indent <= parent) break;
			taken.push(line);
			at++;
		}
		while (taken.length > 0 && (taken[taken.length - 1] as Line).text === "")
			taken.pop();
		const content = taken.filter((line) => line.text !== "");
		if (content.length === 0) return "";
		const base = Math.min(...content.map((line) => line.indent));
		const text = taken.map((line) =>
			line.text === "" ? "" : " ".repeat(line.indent - base) + line.text,
		);
		return text.join(folded ? " " : "\n");
	}

	const result = block(0);
	skip();
	if (at < lines.length) unreadable("not read");
	return result;
}

function scalar(text: string): string {
	const quote = text[0];
	if (quote === '"' || quote === "'") {
		const end = text.indexOf(quote, 1);
		if (end > 0) return unquote(text.slice(0, end + 1));
	}
	return text.replace(/\s+#.*$/, "").trim();
}

function unquote(text: string): string {
	if (text.length >= 2 && text.startsWith('"') && text.endsWith('"'))
		return text.slice(1, -1).replace(/\\"/g, '"');
	if (text.length >= 2 && text.startsWith("'") && text.endsWith("'"))
		return text.slice(1, -1).replace(/''/g, "'");
	return text;
}

// --- The workflow as steps -------------------------------------------------

type Mapping = { [key: string]: Yaml };
type Step = { job: string; run: string; conditions: string[] };
type Publish = "true" | "false";

function isMapping(value: Yaml | undefined): value is Mapping {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function workflowOf(source: string): Mapping {
	const workflow = parseYaml(source);
	if (!isMapping(workflow)) throw new Error("release.yml is not a mapping");
	return workflow;
}

function stepsOf(workflow: Mapping): Step[] {
	const jobs = workflow.jobs;
	if (!isMapping(jobs)) throw new Error("release.yml has no jobs");
	const steps: Step[] = [];
	for (const [name, job] of Object.entries(jobs)) {
		if (!isMapping(job)) continue;
		const jobCondition = typeof job.if === "string" ? [job.if] : [];
		for (const step of Array.isArray(job.steps) ? job.steps : []) {
			if (!isMapping(step)) continue;
			steps.push({
				job: name,
				run: typeof step.run === "string" ? step.run : "",
				conditions: [
					...jobCondition,
					...(typeof step.if === "string" ? [step.if] : []),
				],
			});
		}
	}
	return steps;
}

// A condition is read for what it says of the decision's `publish` output.
// A conjunct that does not mention it is taken as independent of the decision;
// one that mentions it in any form other than `<...>.outputs.publish == 'x'`
// or `!= 'x'` is not understood, and the check fails rather than guesses.
function holds(condition: string, publish: Publish): boolean {
	const text = condition
		.trim()
		.replace(/^\$\{\{\s*/, "")
		.replace(/\s*\}\}$/, "");
	return text.split("&&").every((conjunct) => {
		const part = conjunct
			.trim()
			.replace(/^\((.*)\)$/, "$1")
			.trim();
		if (!/\boutputs\.publish\b/.test(part)) return true;
		const match = /^[\w.-]+\.outputs\.publish\s*(==|!=)\s*'(true|false)'$/.exec(
			part,
		);
		if (!match || /\|\|/.test(part))
			throw new Error(`a condition not understood: ${condition}`);
		const equal = publish === match[2];
		return match[1] === "==" ? equal : !equal;
	});
}

function runsWhen(steps: Step[], publish: Publish): Step[] {
	return steps.filter((step) =>
		step.conditions.every((condition) => holds(condition, publish)),
	);
}

function commandsOf(run: string): string[] {
	return run
		.split(/\n|&&|\|\||;/)
		.map((command) => command.trim())
		.filter((command) => command !== "");
}

const NPM_CI = /^npm\s+ci(\s|$)/;
const NPM_RUN_BUILD = /^npm\s+run\s+build(\s|$)/;
const NPM_STAGE_PUBLISH = /^npm\s+stage\s+publish(\s|$)/;
const PROVENANCE = /(^|\s)--provenance(\s|$)/;
const NPM_PUBLISH = /(^|[^\w-])npm\s+publish\b/;

// --- The checks ------------------------------------------------------------

function raisedVersionProblems(source: string): string[] {
	const workflow = workflowOf(source);
	const steps = stepsOf(workflow);
	const problems: string[] = [];

	if (!steps.some((step) => /tools\/release-decision\.mjs/.test(step.run)))
		problems.push("no step runs tools/release-decision.mjs");

	const commands = runsWhen(steps, "true").flatMap((step) =>
		commandsOf(step.run),
	);
	const ci = commands.findIndex((command) => NPM_CI.test(command));
	const build = commands.findIndex(
		(command, index) => index > ci && NPM_RUN_BUILD.test(command),
	);
	const stage = commands.findIndex(
		(command, index) =>
			index > build &&
			NPM_STAGE_PUBLISH.test(command) &&
			PROVENANCE.test(command),
	);
	if (ci < 0) problems.push("npm ci does not run where publish=true");
	else if (build < 0)
		problems.push("npm run build does not run after npm ci where publish=true");
	else if (stage < 0)
		problems.push(
			"npm stage publish --provenance does not run after npm run build where publish=true",
		);

	for (const step of steps) {
		if (NPM_PUBLISH.test(step.run))
			problems.push(`a step runs npm publish: ${step.run}`);
	}
	return problems;
}

function unchangedVersionProblems(source: string): string[] {
	const steps = stepsOf(workflowOf(source));
	const problems: string[] = [];
	for (const command of runsWhen(steps, "false").flatMap((step) =>
		commandsOf(step.run),
	)) {
		if (
			NPM_CI.test(command) ||
			NPM_RUN_BUILD.test(command) ||
			NPM_STAGE_PUBLISH.test(command)
		)
			problems.push(`runs where publish=false: ${command}`);
	}
	return problems;
}

function storedTokenProblems(source: string): string[] {
	const workflow = workflowOf(source);
	const problems: string[] = [];

	const permissions: Yaml[] = [workflow.permissions];
	if (isMapping(workflow.jobs))
		for (const job of Object.values(workflow.jobs))
			if (isMapping(job)) permissions.push(job.permissions);
	if (
		!permissions.some(
			(granted) => isMapping(granted) && granted["id-token"] === "write",
		)
	)
		problems.push("grants no id-token: write");

	const named = new Set<string>();
	const visit = (value: Yaml | undefined) => {
		if (typeof value === "string") {
			for (const match of value.matchAll(/\b(NODE_AUTH_TOKEN|NPM_TOKEN)\b/gi))
				named.add((match[1] as string).toUpperCase());
		} else if (Array.isArray(value)) value.forEach(visit);
		else if (isMapping(value))
			for (const [key, inner] of Object.entries(value)) {
				visit(key);
				visit(inner);
			}
	};
	visit(workflow);
	for (const name of named) problems.push(`names ${name}`);
	return problems;
}

// --- Workflows written here, to show each check can fail -------------------

type Variant = {
	permissions?: string;
	jobIf?: string;
	decision?: string;
	ci?: string;
	build?: string | null;
	stage?: string;
	stageIf?: string;
	buildIf?: string;
	ciIf?: string;
	stageEnv?: string;
	order?: "ci-build-stage" | "ci-stage-build";
	commented?: string;
};

function expression(inner: string): string {
	return `\${{ ${inner} }}`;
}

const PUBLISH_TRUE = expression("steps.decision.outputs.publish == 'true'");

function workflow(variant: Variant = {}): string {
	const step = (name: string, run: string, condition?: string, env?: string) =>
		[
			`      - name: ${name}`,
			...(condition === "" ? [] : [`        if: ${condition ?? PUBLISH_TRUE}`]),
			...(env ? ["        env:", `          ${env}`] : []),
			`        run: ${run}`,
		].join("\n");
	const ci = step("Install", variant.ci ?? "npm ci", variant.ciIf);
	const build =
		variant.build === null
			? ""
			: step("Build", variant.build ?? "npm run build", variant.buildIf);
	const stage = step(
		"Stage",
		variant.stage ?? "npm stage publish --provenance",
		variant.stageIf,
		variant.stageEnv,
	);
	const tail =
		variant.order === "ci-stage-build"
			? [ci, stage, build]
			: [ci, build, stage];
	return [
		"name: Release",
		"",
		"on:",
		"  push:",
		"    branches: [main]",
		"",
		...(variant.permissions === ""
			? []
			: [
					"permissions:",
					variant.permissions ?? "  contents: read\n  id-token: write",
				]),
		"",
		"jobs:",
		"  release:",
		"    runs-on: ubuntu-latest",
		...(variant.jobIf ? [`    if: ${variant.jobIf}`] : []),
		"    steps:",
		"      - uses: actions/checkout@v6",
		"      - uses: actions/setup-node@v6",
		"        with:",
		"          node-version-file: .nvmrc",
		"          registry-url: https://registry.npmjs.org",
		"      - name: Decide",
		"        id: decision",
		"        run: |",
		`          ${variant.decision ?? 'node tools/release-decision.mjs >> "$GITHUB_OUTPUT"'}`,
		...(variant.commented ? [`      # ${variant.commented}`] : []),
		...tail.filter((part) => part !== ""),
		"",
	].join("\n");
}

describe("A raised version is staged for approval", () => {
	const source = () => readFileSync(releaseWorkflow, "utf8");

	describe("A raised version", () => {
		it("runs npm ci, then npm run build, then npm stage publish --provenance, and no npm publish", () => {
			expect(raisedVersionProblems(source())).toEqual([]);
		});

		describe("the check", () => {
			it("passes a workflow that stages after building", () => {
				expect(raisedVersionProblems(workflow())).toEqual([]);
			});

			it("passes the commands in one multi-line step", () => {
				const oneStep = workflow({
					ci: "|\n          npm ci\n          npm run build\n          npm stage publish --provenance",
					build: null,
					stage: "echo staged",
				});
				expect(raisedVersionProblems(oneStep)).toEqual([]);
			});

			it.each<[string, Variant]>([
				["publishes directly", { stage: "npm publish --provenance" }],
				["stages without provenance", { stage: "npm stage publish" }],
				["does not build", { build: null }],
				["builds after staging", { order: "ci-stage-build" }],
				["does not install", { ci: "echo install" }],
				[
					"installs only where publish=false",
					{ ciIf: expression("steps.decision.outputs.publish == 'false'") },
				],
				[
					"does not run the decision",
					{ decision: 'echo publish=true >> "$GITHUB_OUTPUT"' },
				],
			])("fails a workflow that %s", (_name, variant) => {
				expect(raisedVersionProblems(workflow(variant))).not.toEqual([]);
			});

			it("fails a workflow that stages and also publishes", () => {
				const both = workflow({
					stage: "npm stage publish --provenance && npm publish",
				});
				expect(raisedVersionProblems(both)).not.toEqual([]);
			});
		});
	});

	describe("An unchanged version", () => {
		it("runs none of npm ci, npm run build or npm stage publish", () => {
			expect(unchangedVersionProblems(source())).toEqual([]);
		});

		describe("the check", () => {
			it("passes a workflow gating each step on publish == 'true'", () => {
				expect(unchangedVersionProblems(workflow())).toEqual([]);
			});

			it("passes a workflow gating the whole job on publish == 'true'", () => {
				const gatedJob = workflow({
					jobIf: "needs.decide.outputs.publish == 'true'",
					ciIf: "",
					buildIf: "",
					stageIf: "",
				});
				expect(unchangedVersionProblems(gatedJob)).toEqual([]);
			});

			it.each<[string, Variant]>([
				["installs ungated", { ciIf: "" }],
				["builds ungated", { buildIf: "" }],
				["stages ungated", { stageIf: "" }],
				[
					"builds on a condition that does not read the decision",
					{ buildIf: expression("github.ref == 'refs/heads/main'") },
				],
				[
					"stages where publish != 'true' is false only",
					{ stageIf: expression("steps.decision.outputs.publish != 'true'") },
				],
			])("fails a workflow that %s", (_name, variant) => {
				expect(unchangedVersionProblems(workflow(variant))).not.toEqual([]);
			});

			it("refuses a condition on the decision it cannot read", () => {
				const unread = workflow({
					stageIf: expression(
						"steps.decision.outputs.publish == 'true' || always()",
					),
				});
				expect(() => unchangedVersionProblems(unread)).toThrow(
					/condition not understood/,
				);
			});
		});
	});

	describe("No stored token", () => {
		it("grants id-token: write, and names no NODE_AUTH_TOKEN or NPM_TOKEN secret", () => {
			expect(storedTokenProblems(source())).toEqual([]);
		});

		describe("the check", () => {
			it("passes a workflow granting id-token: write and naming no token", () => {
				expect(storedTokenProblems(workflow())).toEqual([]);
			});

			it("passes id-token: write granted on the job", () => {
				const onJob = workflow({ permissions: "" }).replace(
					"    runs-on: ubuntu-latest",
					"    runs-on: ubuntu-latest\n    permissions:\n      id-token: write",
				);
				expect(storedTokenProblems(onJob)).toEqual([]);
			});

			it("ignores a comment mentioning a token", () => {
				expect(
					storedTokenProblems(
						workflow({ commented: "no NPM_TOKEN is stored" }),
					),
				).toEqual([]);
			});

			it.each<[string, Variant]>([
				["grants no permissions", { permissions: "" }],
				["grants id-token: read only", { permissions: "  id-token: read" }],
				[
					"sets NODE_AUTH_TOKEN",
					{ stageEnv: `NODE_AUTH_TOKEN: ${expression("secrets.NPM_TOKEN")}` },
				],
				[
					"reads an npm_token secret",
					{ stageEnv: `TOKEN: ${expression("secrets.npm_token")}` },
				],
			])("fails a workflow that %s", (_name, variant) => {
				expect(storedTokenProblems(workflow(variant))).not.toEqual([]);
			});
		});
	});
});
