// Tests derived from the delta specs of `hold-the-page-while-reading`
// (openspec/changes/hold-the-page-while-reading/specs/board-pages/spec.md and
// specs/project-reads/spec.md), before its implementation. Run through the
// server: with a stub of the `reads` port where what the project holds must be
// set exactly, and otherwise with `createReads` over a stub tool, as
// tests/held-document-first.test.ts and tests/open-pages-at-once.test.ts do.
// Each assertion's classification, and the scenario each test covers, is in
// that change's test-plan.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type ClientRequest, request as httpRequest } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReads } from "../src/reads.js";
import { startServer } from "../src/server.js";
import { fullDocument, step, workstream } from "./support/document.js";
import { isolatedEnvironment } from "./support/fixture.js";
import {
	attribute,
	type Compound,
	decode,
	type Element,
	enclosing,
	expectInOrder,
	matches,
	selectorsDeclaring,
	takesRule,
	textNodeAt,
	textOf,
} from "./support/page.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 30_000 });

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".

const documentRead = "2026-11-01T22:18:05.000Z";
const documentReadShown = "2026-11-01 22:18:05 UTC";
const unset = "<unset>";

// The `Stars` port as star-workstreams' design.md D10 gives it, in memory.
function stubStars(initial: Record<string, string[]> = {}) {
	const held = new Map<string, Set<string>>(
		Object.entries(initial).map(([path, names]) => [path, new Set(names)]),
	);
	return {
		starred: (projectPath: string) => new Set(held.get(projectPath) ?? []),
		set: async (projectPath: string, name: string, on: boolean) => {
			const names = held.get(projectPath) ?? new Set<string>();
			if (on) names.add(name);
			else names.delete(name);
			held.set(projectPath, names);
		},
	};
}

// The `reads` port holding `state` for every project, whose reads never end.
function heldReads(state: unknown) {
	const never = () => new Promise<never>(() => {});
	return { get: () => state, quick: never, refresh: never };
}

// The `reads` port holding `document` for every project, whose reads end at
// once with no quick document, so that the page ends.
function settledReads(document: unknown) {
	return {
		get: () => ({ state: "read", document, readAt: documentRead }),
		quick: async () => undefined,
		refresh: async () => {},
	};
}

function alphaDocument(taskName: string, forge: "full" | "none" = "full") {
	return fullDocument({
		forge,
		workstreams: [workstream("alpha", [taskName])],
		tasks: [step(taskName, "alpha")],
	});
}

const heldAlpha = {
	state: "read",
	document: alphaDocument("held-task"),
	readAt: documentRead,
};

const oneWorkspace = [
	{ name: "work", projects: [{ name: "one", path: "/srv/one" }] },
];

const twoWorkspaces = [
	{ name: "work", projects: [{ name: "one", path: "/srv/one" }] },
	{ name: "other", projects: [{ name: "two", path: "/srv/two" }] },
];

async function serve(
	reads: unknown,
	starred: string[] = [],
	workspaces: unknown = oneWorkspace,
) {
	return startServer(
		{
			workspaces,
			reads,
			stars: stubStars({ "/srv/one": starred }),
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
}

const outgoing: ClientRequest[] = [];

type Opened = {
	received(): string;
	ended(): boolean;
	end: Promise<string>;
};

// Opens a page and reads its body as it arrives.
function open(port: number, path: string): Opened {
	let text = "";
	let done = false;
	const end = new Promise<string>((resolve, reject) => {
		const sent = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}` },
				agent: false,
				timeout: 25_000,
			},
			(response) => {
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					done = true;
					resolve(text);
				});
			},
		);
		sent.on("timeout", () => {
			sent.destroy(new Error(`no end for ${path}`));
		});
		sent.on("error", reject);
		sent.end();
		outgoing.push(sent);
	});
	end.catch(() => {});
	return { received: () => text, ended: () => done, end };
}

const phaseTag =
	/<section\b[^>]*\bclass=["'](?:[^"']*\s)?phase(?:\s[^"']*)?["'][^>]*>/g;

function phaseStarts(html: string): number[] {
	return [...html.matchAll(phaseTag)].map((match) => match.index ?? 0);
}

function phases(html: string): string[] {
	const starts = phaseStarts(html);
	return starts.map((start, i) => html.slice(start, starts[i + 1]));
}

function beforePhases(html: string): string {
	const first = html.search(phaseTag);
	return first === -1 ? html : html.slice(0, first);
}

// What a reader sees, with no space left before punctuation that markup
// around a time may have put there.
function shown(html: string): string {
	return textOf(html).replace(/\s+([;.,])/g, "$1");
}

function tagsWithId(html: string, id: string): number[] {
	return [...html.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)]
		.filter((match) => attribute(match[1] ?? "", "id") === id)
		.map((match) => match.index ?? 0);
}

function starButtons(html: string): string[] {
	return [...html.matchAll(/<button\b([^>]*)>/gi)]
		.map((match) => match[1] ?? "")
		.filter((attributes) =>
			["star", "unstar"].includes(attribute(attributes, "name") ?? ""),
		);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function waitUntil(condition: () => boolean, ms = 8000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error("timed out waiting");
		}
		await delay(20);
	}
}

// The page of a project whose reads never end, as far as it has arrived: its
// first part, and a moment more for anything still on its way.
async function firstPartOf(port: number, path = "/work/one") {
	const opened = open(port, path);
	await waitUntil(() => phases(opened.received()).length >= 1);
	await delay(300);
	const received = opened.received();
	return { opened, received, first: phases(received)[0] ?? "" };
}

function utc(at: string): string {
	return `${new Date(at).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

// The update mark: an element holding `↻` alone, named by its aria-label or,
// failing that, its title.
type Mark = { name: string | null; classes: string[]; at: number };

function marksIn(html: string): Mark[] {
	const pattern =
		/<([a-zA-Z][\w-]*)\b([^>]*)>\s*(?:↻|&#x21bb;|&#8635;)\s*<\/\1\s*>/gi;
	return [...html.matchAll(pattern)].map((match) => {
		const attributes = match[2] ?? "";
		return {
			name:
				attribute(attributes, "aria-label") ?? attribute(attributes, "title"),
			classes: (attribute(attributes, "class") ?? "")
				.split(/\s+/)
				.filter(Boolean),
			at: match.index ?? 0,
		};
	});
}

function markNames(html: string): (string | null)[] {
	return marksIn(html).map((mark) => mark.name);
}

function hasMark(html: string): boolean {
	return decode(html).includes("↻");
}

// The page's own style, its <style> elements joined.
function stylesOf(html: string): string {
	return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
		.map((match) => match[1] ?? "")
		.join("\n");
}

// The at-rule blocks of `css` whose prelude matches `prelude`, as their
// bodies, and `css` with every @media block taken out.
function atBlocks(css: string, prelude: RegExp): string[] {
	const found: string[] = [];
	for (const match of css.matchAll(/@[\w-]+[^{;]*\{/g)) {
		if (!prelude.test(match[0])) continue;
		const open = (match.index ?? 0) + match[0].length;
		let depth = 1;
		let at = open;
		while (at < css.length && depth > 0) {
			if (css[at] === "{") depth++;
			if (css[at] === "}") depth--;
			at++;
		}
		found.push(css.slice(open, at - 1));
	}
	return found;
}

function withoutMedia(css: string): string {
	let rest = css;
	for (;;) {
		const match = /@media[^{]*\{/.exec(rest);
		if (match === null) return rest;
		let depth = 1;
		let at = match.index + match[0].length;
		while (at < rest.length && depth > 0) {
			if (rest[at] === "{") depth++;
			if (rest[at] === "}") depth--;
			at++;
		}
		rest = rest.slice(0, match.index) + rest.slice(at);
	}
}

function asStyle(css: string): string {
	return `<style>${css}</style>`;
}

const sticky =
	/^(?=[\s\S]*position\s*:\s*sticky)(?=[\s\S]*(?:^|[;\s])top\s*:\s*0(?:px)?\s*(?:;|$))/;
const fixed = /position\s*:\s*fixed/;

// Whether the element open at `at` is held at the top of the window: one of
// the elements enclosing it takes a rule, at every width, declaring
// `position: sticky` and `top: 0`.
function heldAtTop(html: string, at: number): boolean {
	const css = withoutMedia(stylesOf(html));
	return takesRule(
		enclosing(html, at),
		selectorsDeclaring(asStyle(css), sticky),
		sticky,
	);
}

// Whether the text at `at` sits in an element fixed to the window at every
// width: an enclosing element takes `position: fixed` outside any @media
// block, and no @media block gives that element another position.
function fixedAt(html: string, at: number): boolean {
	const css = stylesOf(html);
	const stack = enclosing(html, at);
	const fixedSelectors = selectorsDeclaring(asStyle(withoutMedia(css)), fixed);
	const first = stack.findIndex((_, index) =>
		takesRule(stack.slice(0, index + 1), fixedSelectors, fixed),
	);
	if (first === -1) return false;
	const other = /position\s*:\s*(?!fixed)[a-z]/;
	const overriding = atBlocks(css, /^@media/).flatMap((body) =>
		selectorsDeclaring(asStyle(body), other),
	);
	const element = stack.slice(0, first + 1);
	const before = stack.slice(0, first);
	return !(
		takesRule(element, overriding, other) &&
		!takesRule(before, overriding, other)
	);
}

// The ids of the page's elements that take no non-zero `scroll-margin-top`
// at every width, from a `[id]` rule or a rule of their own tag or class.
function idsWithoutScrollMargin(html: string): string[] {
	const css = withoutMedia(stylesOf(html));
	const nonZero =
		/scroll-margin-top\s*:\s*(?!0(?:\.0+)?(?:px|rem|em)?\s*(?:;|$|!))[^;}\s]/;
	const ruleSelectors: string[] = [];
	for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		if (!nonZero.test(rule[2] ?? "")) continue;
		ruleSelectors.push(...(rule[1] ?? "").split(",").map((s) => s.trim()));
	}
	const compounds: Compound[][] = selectorsDeclaring(asStyle(css), nonZero);
	const missing: string[] = [];
	for (const match of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
		const id = attribute(match[2] ?? "", "id");
		if (id === null) continue;
		const tag = (match[1] ?? "").toLowerCase();
		const element: Element = {
			tag,
			classes: (attribute(match[2] ?? "", "class") ?? "")
				.split(/\s+/)
				.filter(Boolean),
			title: null,
			style: attribute(match[2] ?? "", "style") ?? "",
		};
		const byId = ruleSelectors.some((selector) => {
			const found = /^(\*|[a-zA-Z][\w-]*)?\[id\]$/.exec(selector);
			return (
				found !== null &&
				(found[1] === undefined || found[1] === "*" || found[1] === tag)
			);
		});
		const byOwnRule = compounds.some((compound) => {
			const subject = compound[compound.length - 1];
			return subject !== undefined && matches(element, subject);
		});
		if (!byId && !byOwnRule && !nonZero.test(element.style)) missing.push(id);
	}
	return missing;
}

function classRule(classes: string[]): RegExp {
	const names = classes.map((name) => name.replace(/[-]/g, "\\-")).join("|");
	return new RegExp(`\\.(?:${names})(?![\\w-])`);
}

// Whether the style turns an element of one of `classes`: a rule for it, at
// every width, gives it an animation, and a @keyframes rotates.
function turns(css: string, classes: string[]): boolean {
	if (classes.length === 0) return false;
	const ofMark = classRule(classes);
	const animated = [
		...withoutMedia(css).matchAll(/([^{}]+)\{([^{}]*)\}/g),
	].some(
		(rule) =>
			ofMark.test(rule[1] ?? "") &&
			/animation(?:-name)?\s*:\s*(?!none\b)[\w-]/.test(rule[2] ?? ""),
	);
	const rotates = atBlocks(css, /^@keyframes/).some((body) =>
		/rotate/.test(body),
	);
	return animated && rotates;
}

// Whether the style, under `prefers-reduced-motion: reduce`, stops an element
// of one of `classes` from turning.
function stopsUnderReducedMotion(css: string, classes: string[]): boolean {
	if (classes.length === 0) return false;
	const ofMark = classRule(classes);
	return atBlocks(css, /prefers-reduced-motion\s*:\s*reduce/).some((body) =>
		[...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(
			(rule) =>
				ofMark.test(rule[1] ?? "") &&
				/animation(?:-name)?\s*:\s*none\b|animation-play-state\s*:\s*paused/.test(
					rule[2] ?? "",
				),
		),
	);
}

// Whether a script of the page sets an element's position or top, or names
// `sticky` or `fixed` as a value.
function scriptPlaces(html: string): boolean {
	const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
		.map((match) => match[1] ?? "")
		.join("\n");
	return /\.style\.(?:position|top)\b|setProperty\(\s*["'](?:position|top)["']|["'](?:sticky|fixed)["']/.test(
		scripts,
	);
}

// The position, in `html`, of the read time's `Read` from `from` on.
function readTimeAt(html: string, from = 0): number {
	const pattern = />(\s*)Read\b/g;
	pattern.lastIndex = from;
	const match = pattern.exec(html);
	if (match === null) return -1;
	return match.index + 1 + (match[1] ?? "").length;
}

type Reads = ReturnType<typeof createReads>;

const running: Reads[] = [];
const roots: string[] = [];

// A machine whose gh answers `auth token --user <account>` from the tokens it
// holds, and otherwise can use a login unless GH_CONFIG_DIR names a directory
// that cannot be made, so that a quick read and a full read can be told
// apart, as in tests/open-pages-at-once.test.ts; and a tool that prints
// <kind>.json, logs each start with the tokens it saw, holds a run while
// hold-<kind> exists until release-<kind> or release-all does, and fails a
// run while fail-<kind> exists. Bounded, so nothing outlives a test.
function machine() {
	const root = temporaryDirectory();
	roots.push(root);
	const env = isolatedEnvironment(root);
	for (const name of ["HOME", "XDG_CONFIG_HOME", "XDG_STATE_HOME", "PATH"]) {
		vi.stubEnv(name, env[name]);
	}
	for (const name of Object.keys(process.env)) {
		if (name.startsWith("GIT_")) {
			vi.stubEnv(name, undefined);
		}
	}
	for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR"]) {
		vi.stubEnv(name, undefined);
	}
	const tokens = join(root, "tokens");
	mkdirSync(tokens);
	const asked = join(root, "gh.log");
	writeFileSync(
		join(root, "stubs", "gh"),
		[
			"#!/bin/sh",
			`echo "$*" >> '${asked}'`,
			'if [ "$1 $2" = "auth token" ]; then',
			`  if [ -e '${tokens}'/"$4" ]; then cat '${tokens}'/"$4"; exit 0; fi`,
			"  echo 'no oauth token found' >&2",
			"  exit 1",
			"fi",
			'if [ -n "$GH_CONFIG_DIR" ] && ! mkdir -p "$GH_CONFIG_DIR" 2>/dev/null; then',
			"  echo 'failed to read configuration' >&2",
			"  exit 1",
			"fi",
			"exit 0",
			"",
		].join("\n"),
		{ mode: 0o755 },
	);
	const toolPath = join(root, "stub-tool");
	writeFileSync(
		toolPath,
		[
			`root='${root}'`,
			"if gh pr list >/dev/null 2>&1; then kind=full; else kind=quick; fi",
			`printf 'start %s %s %s %s\\n' "$kind" "$$" "\${GH_TOKEN-${unset}}" "\${GITHUB_TOKEN-${unset}}" >> "$root/tool.log"`,
			'if [ -e "$root/hold-$kind" ]; then',
			"  i=0",
			'  until [ -e "$root/release-$kind" ] || [ -e "$root/release-all" ] || [ "$i" -ge 1500 ]; do sleep 0.02; i=$((i + 1)); done',
			"fi",
			`printf 'end %s %s\\n' "$kind" "$$" >> "$root/tool.log"`,
			'if [ -e "$root/fail-$kind" ]; then echo "Reason: $kind-refused" >&2; exit 2; fi',
			'cat "$root/$kind.json"',
			"",
		].join("\n"),
		{ mode: 0o644 },
	);
	const project = join(root, "projects", "one");
	mkdirSync(project, { recursive: true });
	const touch = (name: string) => writeFileSync(join(root, name), "");
	const m = {
		toolPath,
		project,
		asked,
		holds(account: string) {
			writeFileSync(join(tokens, account), `token-of-${account}\n`);
		},
		prints(kind: "full" | "quick", document: unknown) {
			writeFileSync(join(root, `${kind}.json`), JSON.stringify(document));
		},
		hold: (kind: "full" | "quick") => touch(`hold-${kind}`),
		release: (kind: "full" | "quick") => touch(`release-${kind}`),
		fail: (kind: "full" | "quick") => touch(`fail-${kind}`),
		log(): string[] {
			const path = join(root, "tool.log");
			return existsSync(path)
				? readFileSync(path, "utf8").trim().split("\n").filter(Boolean)
				: [];
		},
	};
	m.prints("full", alphaDocument("full-task"));
	m.prints("quick", alphaDocument("quick-task", "none"));
	return m;
}

type Machine = ReturnType<typeof machine>;

type Run = { kind: string; ghToken?: string; githubToken?: string };

function started(m: Machine, kind?: "full" | "quick"): Run[] {
	return m
		.log()
		.filter((line) => line.startsWith("start "))
		.map((line) => {
			const [, runKind = "", , ghToken, githubToken] = line.split(" ");
			return { kind: runKind, ghToken, githubToken };
		})
		.filter((run) => kind === undefined || run.kind === kind);
}

function endedRuns(m: Machine, kind: "full" | "quick"): number {
	return m.log().filter((line) => line.startsWith(`end ${kind} `)).length;
}

function tokenRequests(path: string): string[] {
	return existsSync(path)
		? readFileSync(path, "utf8")
				.trim()
				.split("\n")
				.filter((line) => line.startsWith("auth "))
		: [];
}

// A board over the machine, its project `one` in workspace `work`.
async function board(m: Machine, githubAccount?: string) {
	const settings = [
		{
			name: "work",
			projects: [{ name: "one", path: m.project }],
			...(githubAccount === undefined ? {} : { githubAccount }),
		},
	];
	const reads = createReads(
		settings as unknown as Parameters<typeof createReads>[0],
		{ toolPath: m.toolPath, limitMs: 10_000, graceMs: 200 },
	);
	running.push(reads);
	const port = await startServer(
		{
			workspaces: settings,
			reads,
			stars: stubStars(),
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
	return { reads, port };
}

// A board whose project has been read once, holding a document whose one task
// is held-task; its next full read prints full-task, its next quick read
// quick-task.
async function boardHolding(m: Machine) {
	m.prints("full", alphaDocument("held-task"));
	const { reads, port } = await board(m);
	await reads.start();
	const held = reads.get("work", "one") as { state: string; readAt: string };
	expect(held.state).toBe("read");
	m.prints("full", alphaDocument("full-task"));
	return { reads, port, readAt: held.readAt };
}

afterEach(async () => {
	for (const sent of outgoing.splice(0)) {
		sent.destroy();
	}
	for (const root of roots.splice(0)) {
		writeFileSync(join(root, "release-all"), "");
	}
	await Promise.all(running.splice(0).map((reads) => reads.stop()));
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("A page being read says so", () => {
	describe("Held, then read", () => {
		it("marks the first part's read time Being read again, and the last part's read time not at all", async () => {
			const m = machine();
			const { reads, port } = await boardHolding(m);

			const body = await open(port, "/work/one").end;

			const parts = phases(body);
			expect(parts.length).toBeGreaterThanOrEqual(2);
			const first = parts[0] ?? "";
			const last = parts.at(-1) ?? "";
			expect(markNames(first)).toEqual(["Being read again"]);
			expect(shown(first)).toMatch(
				/↻ Read \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/,
			);
			const after = reads.get("work", "one") as { readAt: string };
			expect(textOf(last)).toContain("full-task");
			expect(shown(last)).toContain(`Read ${utc(after.readAt)}`);
			expect(hasMark(last)).toBe(false);
		});
	});

	describe("Nothing held", () => {
		it.each([
			["still on its first read", { state: "reading" }],
			[
				"whose reads have only failed",
				{ state: "failed", reason: "the-tool-refused" },
			],
		])(
			"marks the first part Being read, for a project %s whose reads do not end",
			async (_name, state) => {
				const port = await serve(heldReads(state));

				const { opened, first } = await firstPartOf(port);

				expect(opened.ended()).toBe(false);
				expect(markNames(first)).toEqual(["Being read"]);
			},
		);
	});

	describe("The quick part", () => {
		it("marks the quick part's read time GitHub still being read, reading Read from git alone; statuses may be wrong.", async () => {
			const m = machine();
			m.hold("full");
			const { port } = await board(m);

			const opened = open(port, "/work/one");
			await waitUntil(() => opened.received().includes("quick-task"));
			await delay(100);
			const quick = phases(opened.received())[1] ?? "";
			m.release("full");
			await opened.end;

			expect(textOf(quick)).toContain("quick-task");
			expect(markNames(quick)).toEqual(["GitHub still being read"]);
			expect(shown(quick)).toContain(
				"↻ Read from git alone; statuses may be wrong.",
			);
			expect(shown(quick)).not.toContain("GitHub still being read, so");
		});
	});

	describe("Reduced motion", () => {
		it("turns the mark in the page's style, and stops it under prefers-reduced-motion: reduce", async () => {
			const port = await serve(heldReads(heldAlpha));

			const { received, first } = await firstPartOf(port);

			const [mark] = marksIn(first);
			expect(mark).toBeDefined();
			const css = stylesOf(received);
			expect(turns(css, mark?.classes ?? [])).toBe(true);
			expect(stopsUnderReducedMotion(css, mark?.classes ?? [])).toBe(true);
		});
	});
});

describe("A project's page shows its document", () => {
	describe("The heading stays in view", () => {
		it.each([
			["under a workspace's link", oneWorkspace, ["/work"]],
			["under tabs", twoWorkspaces, ["/work", "/other"]],
		])(
			"holds the heading sticky at top 0, %s, and each part's read time fixed",
			async (_name, workspaces, links) => {
				const port = await serve(
					settledReads(alphaDocument("full-task")),
					[],
					workspaces,
				);

				const body = await open(port, "/work/one").end;

				const head = beforePhases(body);
				const name = textNodeAt(head, "one");
				expect(name).toBeGreaterThan(-1);
				expect(heldAtTop(body, name)).toBe(true);
				for (const link of links) {
					const at = head.search(
						new RegExp(`<a\\b[^>]*\\bhref=["']${link}["']`),
					);
					expect(at).toBeGreaterThan(-1);
					expect(heldAtTop(body, at)).toBe(true);
				}
				const starts = phaseStarts(body);
				expect(starts.length).toBeGreaterThanOrEqual(2);
				for (const start of starts) {
					const at = readTimeAt(body, start);
					expect(at).toBeGreaterThan(-1);
					expect(fixedAt(body, at)).toBe(true);
				}
			},
		);

		it("holds no script placing the heading or the read time", async () => {
			const port = await serve(settledReads(alphaDocument("full-task")));

			const body = await open(port, "/work/one").end;

			expect(scriptPlaces(body)).toBe(false);
		});
	});

	describe("A link lands below the heading", () => {
		it("gives every element with an id a non-zero scroll-margin-top", async () => {
			const port = await serve(settledReads(alphaDocument("full-task")));

			const body = await open(port, "/work/one").end;

			expect(tagsWithId(phases(body).at(-1) ?? "", "alpha")).toHaveLength(1);
			expect(idsWithoutScrollMargin(body)).toEqual([]);
		});
	});
});

describe("A project's page shows each read as it arrives", () => {
	describe("Quick, then full", () => {
		it("holds, for a project holding no document, the first part, then the quick document marked as from git alone, then the full document", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);
			m.release("quick");
			await waitUntil(() => opened.received().includes("quick-task"));
			expect(opened.ended()).toBe(false);
			m.release("full");
			const body = await opened.end;

			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(3);
			expect(parts[0]).toMatch(/being read/i);
			expect(parts[0]).not.toContain("quick-task");
			expect(parts[1]).toContain("quick-task");
			expect(parts[1]).toMatch(/git alone/i);
			expect(parts[1]).toMatch(/statuses may be wrong/i);
			expect(parts[2]).toContain("full-task");
			expect(parts[2]).not.toContain("quick-task");
		});
	});

	describe("Full first", () => {
		it("holds, for a project holding no document, the first part and then the full document, and no quick part", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);
			m.release("full");
			const body = await opened.end;
			m.release("quick");

			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(2);
			expect(parts[0]).toMatch(/being read/i);
			expect(parts[1]).toContain("full-task");
			expect(body).not.toContain("quick-task");
			expect(shown(body)).not.toMatch(/git alone/i);
		});
	});

	describe("A quick read that fails", () => {
		it("adds, for a project holding no document, no part saying the quick read failed", async () => {
			const m = machine();
			m.hold("full");
			m.fail("quick");
			const { port } = await board(m);

			const opened = open(port, "/work/one");
			await waitUntil(() => endedRuns(m, "quick") === 1);
			await delay(200);
			m.release("full");
			const body = await opened.end;

			expect(body).not.toContain("quick-refused");
			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(2);
			expect(parts[1]).toContain("full-task");
		});
	});

	describe("A held document, no quick part", () => {
		it("holds the first part and then the full document, and no part marked as from git alone, where a quick read would have ended first", async () => {
			const m = machine();
			const { port } = await boardHolding(m);
			m.hold("full");

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m, "full").length === 2);
			await delay(600);
			m.release("full");
			const body = await opened.end;

			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(2);
			expect(parts[0]).toContain("held-task");
			expect(parts[1]).toContain("full-task");
			expect(body).not.toContain("quick-task");
			expect(shown(body)).not.toMatch(/git alone/i);
		});
	});
});

describe("The first part shows what is held", () => {
	describe("A held document", () => {
		it("sends, before the reads end, a first part holding the document's tasks, alpha starred, Read and its time marked Being read again, and no id alpha, after the stars form", async () => {
			const port = await serve(heldReads(heldAlpha), ["alpha"]);

			const { opened, received, first } = await firstPartOf(port);

			expect(opened.ended()).toBe(false);
			expect(phases(received)).toHaveLength(1);
			expect(textOf(first)).toContain("held-task");
			expect(shown(first)).toContain(`↻ Read ${documentReadShown}`);
			expect(markNames(first)).toEqual(["Being read again"]);
			expect(shown(first)).not.toMatch(/Shown as read/i);
			const alpha = starButtons(first).filter(
				(button) => attribute(button, "value") === "alpha",
			);
			expect(alpha).toHaveLength(1);
			expect(attribute(alpha[0] ?? "", "name")).toBe("unstar");
			expect(attribute(alpha[0] ?? "", "form")).toBe("stars");
			expect(tagsWithId(first, "alpha")).toEqual([]);
			const form = tagsWithId(received, "stars");
			expect(form).toHaveLength(1);
			expect(form[0]).toBeLessThan(phaseStarts(received)[0] ?? -1);
		});
	});

	describe("Nothing held", () => {
		it.each([
			["still on its first read", { state: "reading" }],
			[
				"whose reads have only failed",
				{ state: "failed", reason: "the-tool-refused" },
			],
		])(
			"says in the first part, for a project %s, that it is being read, marked Being read, and shows no document",
			async (_name, state) => {
				const port = await serve(heldReads(state));

				const { opened, first } = await firstPartOf(port);

				expect(opened.ended()).toBe(false);
				expect(shown(first)).toMatch(/being read/i);
				expect(markNames(first)).toEqual(["Being read"]);
				expect(shown(first)).not.toMatch(/Shown as read/i);
				expect(first).not.toMatch(/<li\b/i);
				expect(first).not.toContain("the-tool-refused");
			},
		);
	});

	describe("Held, then the reads", () => {
		it("holds the held part and then the full document, in that order, and no quick part", async () => {
			const m = machine();
			const { port, readAt } = await boardHolding(m);
			m.hold("full");

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m, "full").length === 2);
			await delay(600);
			m.release("full");
			const body = await opened.end;

			const parts = phases(body).map(shown);
			expect(parts).toHaveLength(2);
			expectInOrder(shown(body), [
				`Read ${utc(readAt)}`,
				"held-task",
				"full-task",
			]);
			expect(parts[0]).toContain("held-task");
			expect(parts[0]).toContain(`↻ Read ${utc(readAt)}`);
			expect(parts[1]).toContain("full-task");
			expect(parts[1]).not.toContain("held-task");
			expect(body).not.toContain("quick-task");
		});
	});
});

describe("A project's page starts a quick read beside the full one", () => {
	describe("Both reads start", () => {
		it("runs the tool twice, overlapping, once with gh unable to log in, for a project holding no document", async () => {
			const m = machine();
			vi.stubEnv("GH_TOKEN", "the-boards-own");
			vi.stubEnv("GITHUB_TOKEN", "also-the-boards-own");
			m.hold("full");
			m.hold("quick");
			const { port } = await board(m);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);

			expect(endedRuns(m, "full") + endedRuns(m, "quick")).toBe(0);
			expect(started(m, "full")).toHaveLength(1);
			expect(started(m, "quick")).toHaveLength(1);
			expect(started(m, "full")[0]).toMatchObject({
				ghToken: "the-boards-own",
				githubToken: "also-the-boards-own",
			});
			expect(started(m, "quick")[0]).toMatchObject({
				ghToken: unset,
				githubToken: unset,
			});
			m.release("full");
			m.release("quick");
			await opened.end;
		});
	});

	describe("A quick read is not held", () => {
		it("holds what it held before, for a project holding no document, once its quick read ends and its full read has not", async () => {
			const m = machine();
			m.hold("full");
			m.hold("quick");
			const { reads, port } = await board(m);

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m).length === 2);
			const before = reads.get("work", "one");
			m.release("quick");
			await waitUntil(() => opened.received().includes("quick-task"));

			expect(reads.get("work", "one")).toEqual(before);
			expect(JSON.stringify(reads.get("work", "one"))).not.toContain(
				"quick-task",
			);
			m.release("full");
			await opened.end;
		});
	});

	describe("No account is used", () => {
		it("asks gh for a token once, by the full read, for a project holding no document in a workspace with a github_account", async () => {
			const m = machine();
			m.holds("someone");
			const { port } = await board(m, "someone");

			await open(port, "/work/one").end;
			await delay(300);

			expect(tokenRequests(m.asked)).toEqual(["auth token --user someone"]);
			expect(started(m, "full").map((run) => run.ghToken)).toEqual([
				"token-of-someone",
			]);
			expect(started(m, "quick")).toHaveLength(1);
			expect(started(m, "quick")[0]?.ghToken).toBe(unset);
		});
	});

	describe("A held document starts no quick read", () => {
		it("runs the tool once, as the full read, for a project holding a document", async () => {
			const m = machine();
			const { port } = await boardHolding(m);
			m.hold("full");

			const opened = open(port, "/work/one");
			await waitUntil(() => started(m, "full").length === 2);
			await delay(600);
			expect(started(m, "quick")).toEqual([]);
			m.release("full");
			await opened.end;
			await delay(200);

			expect(started(m).map((run) => run.kind)).toEqual(["full", "full"]);
		});
	});
});

// The style checks above read the page's CSS without running a browser, so
// each is run here over a style the test supplies, once without the property
// it asserts and once with it, to establish that it can fail.
describe("the style checks discriminate", () => {
	const heading =
		'<header class="project"><a href="/work">work</a><h1>one</h1></header>';
	const at = (html: string) => textNodeAt(html, "one");

	it("finds no held heading where the heading is not sticky, and finds it where it is", () => {
		const plain = `<style>header.project { position: relative; top: 0 }</style>${heading}`;
		const stuckLow = `<style>header.project { position: sticky; top: 10px }</style>${heading}`;
		const narrowOnly = `<style>@media (max-width: 600px) { header.project { position: sticky; top: 0 } }</style>${heading}`;
		const held = `<style>header.project { position: sticky; top: 0; z-index: 2 }</style>${heading}`;
		expect(heldAtTop(plain, at(plain))).toBe(false);
		expect(heldAtTop(stuckLow, at(stuckLow))).toBe(false);
		expect(heldAtTop(narrowOnly, at(narrowOnly))).toBe(false);
		expect(heldAtTop(held, at(held))).toBe(true);
	});

	it("finds no fixed read time where it is placed absolutely or only on a wide page, and finds it where it is fixed", () => {
		const stamp =
			'<section class="phase"><p class="stamp">Read 2026</p></section>';
		const absolute = `<style>.stamp { position: absolute; top: 0 }</style>${stamp}`;
		const wideOnly = `<style>.stamp { position: fixed } @media (max-width: 600px) { .stamp { position: static } }</style>${stamp}`;
		const fixedStamp = `<style>.stamp { position: fixed; top: 43.5px } @media (prefers-reduced-motion: reduce) { .spin { animation: none } }</style>${stamp}`;
		expect(fixedAt(absolute, readTimeAt(absolute))).toBe(false);
		expect(fixedAt(wideOnly, readTimeAt(wideOnly))).toBe(false);
		expect(fixedAt(fixedStamp, readTimeAt(fixedStamp))).toBe(true);
	});

	it("names an id with no scroll-margin-top, or a zero one, and none where [id] has one", () => {
		const page = '<details id="alpha"></details><form id="stars"></form>';
		expect(
			idsWithoutScrollMargin(`<style>p { margin: 0 }</style>${page}`),
		).toEqual(["alpha", "stars"]);
		expect(
			idsWithoutScrollMargin(
				`<style>[id] { scroll-margin-top: 0 }</style>${page}`,
			),
		).toEqual(["alpha", "stars"]);
		expect(
			idsWithoutScrollMargin(
				`<style>[id] { scroll-margin-top: 120px }</style>${page}`,
			),
		).toEqual([]);
	});

	it("finds a script placing the heading where one sets its position, and none where the script only scrolls", () => {
		const placing =
			'<script>document.querySelector("header").style.position = "sticky";</script>';
		const scrolling =
			'<script>window.scrollTo(0, Number(sessionStorage.getItem("y")));</script>';
		expect(scriptPlaces(placing)).toBe(true);
		expect(scriptPlaces(scrolling)).toBe(false);
	});

	it("finds no turning mark without an animation or with no stop under reduced motion, and finds both where they are", () => {
		const still = ".spin { display: inline-block }";
		const spinning =
			".spin { display: inline-block; animation: spin 1.2s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }";
		const stopped = `${spinning} @media (prefers-reduced-motion: reduce) { .spin { animation: none } }`;
		expect(turns(still, ["spin"])).toBe(false);
		expect(turns(spinning, ["spin"])).toBe(true);
		expect(stopsUnderReducedMotion(spinning, ["spin"])).toBe(false);
		expect(stopsUnderReducedMotion(stopped, ["spin"])).toBe(true);
		expect(turns(spinning, [])).toBe(false);
	});
});
