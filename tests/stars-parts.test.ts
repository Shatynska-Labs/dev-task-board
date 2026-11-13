// Tests derived from the delta spec of `star-workstreams`
// (openspec/changes/star-workstreams/specs/board-pages/spec.md), for a
// project's page sent in a quick part and a full part, read by `createReads`
// through a stub tool as tests/open-pages-at-once.test.ts reads. Each
// assertion's classification is in that change's test-plan.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReads } from "../src/reads.js";
import { startServer } from "../src/server.js";
import { fullDocument, step, workstream } from "./support/document.js";
import { isolatedEnvironment } from "./support/fixture.js";
import { attribute, textOf } from "./support/page.js";
import {
	removeTemporaryDirectories,
	temporaryDirectory,
} from "./support/temporary.js";

vi.setConfig({ testTimeout: 30_000 });

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".

type Reads = ReturnType<typeof createReads>;

const running: Reads[] = [];

// The `Stars` port as design.md D10 gives it, held in memory.
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

function documentOf(forge: "full" | "none", taskName: string) {
	return fullDocument({
		forge,
		workstreams: [workstream("alpha", [taskName])],
		tasks: [step(taskName, "alpha")],
	});
}

// A machine whose gh can use a login unless GH_CONFIG_DIR names a directory
// that cannot be made, so that a quick read and a full read can be told
// apart, as in tests/open-pages-at-once.test.ts; and a tool whose full read
// waits until the quick one has printed its document, so the page is sent in
// a quick part and then a full part. Bounded, so nothing outlives a test.
function machine() {
	const root = temporaryDirectory();
	const env = isolatedEnvironment(root);
	for (const name of ["HOME", "XDG_CONFIG_HOME", "PATH"]) {
		vi.stubEnv(name, env[name]);
	}
	vi.stubEnv("XDG_STATE_HOME", join(root, "state"));
	for (const name of Object.keys(process.env)) {
		if (name.startsWith("GIT_")) {
			vi.stubEnv(name, undefined);
		}
	}
	for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR"]) {
		vi.stubEnv(name, undefined);
	}
	writeFileSync(
		join(root, "stubs", "gh"),
		[
			"#!/bin/sh",
			'if [ -n "$GH_CONFIG_DIR" ] && ! mkdir -p "$GH_CONFIG_DIR" 2>/dev/null; then',
			"  echo 'failed to read configuration' >&2",
			"  exit 1",
			"fi",
			"exit 0",
			"",
		].join("\n"),
		{ mode: 0o755 },
	);
	writeFileSync(
		join(root, "quick.json"),
		JSON.stringify(documentOf("none", "quick-task")),
	);
	writeFileSync(
		join(root, "full.json"),
		JSON.stringify(documentOf("full", "full-task")),
	);
	const toolPath = join(root, "stub-tool");
	writeFileSync(
		toolPath,
		[
			`root='${root}'`,
			"if gh pr list >/dev/null 2>&1; then kind=full; else kind=quick; fi",
			'if [ "$kind" = full ]; then',
			"  i=0",
			'  until [ -e "$root/quick-done" ] || [ "$i" -ge 500 ]; do sleep 0.02; i=$((i + 1)); done',
			"  sleep 0.5",
			"fi",
			'cat "$root/$kind.json"',
			'if [ "$kind" = quick ]; then : > "$root/quick-done"; fi',
			"",
		].join("\n"),
		{ mode: 0o644 },
	);
	const project = join(root, "projects", "one");
	mkdirSync(project, { recursive: true });
	return { root, toolPath, project };
}

async function board(starred: string[] = []) {
	const m = machine();
	const settings = [
		{ name: "work", projects: [{ name: "one", path: m.project }] },
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
			stars: stubStars({ [m.project]: starred }),
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
	return port;
}

function get(port: number, path: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { Host: `127.0.0.1:${port}` },
				agent: false,
				timeout: 25_000,
			},
			(response) => {
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					body += chunk;
				});
				response.on("end", () => {
					resolve(body);
				});
			},
		);
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no end for ${path}`));
		});
		outgoing.on("error", reject);
		outgoing.end();
	});
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

// The page in its quick and full parts, checked to be so.
async function quickThenFull(starred: string[] = []) {
	const port = await board(starred);
	const html = await get(port, "/work/one");
	const parts = phases(html);
	expect(parts).toHaveLength(3);
	expect(textOf(parts[1] ?? "")).toContain("quick-task");
	expect(textOf(parts[2] ?? "")).toContain("full-task");
	return { html, quick: parts[1] ?? "", full: parts[2] ?? "" };
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

afterEach(async () => {
	await Promise.all(running.splice(0).map((reads) => reads.stop()));
	vi.unstubAllEnvs();
	removeTemporaryDirectories();
});

describe("Only the last part carries workstream ids", () => {
	describe("Quick and full parts", () => {
		it("gives exactly one element the id alpha, in the full part", async () => {
			const { html } = await quickThenFull();

			const found = tagsWithId(html, "alpha");

			expect(found).toHaveLength(1);
			expect(found[0]).toBeGreaterThan(phaseStarts(html)[2] ?? Infinity);
		});
	});
});

describe("A workstream shows its star", () => {
	describe("One form for every part", () => {
		it("holds exactly one form with id stars, and every star button in either part names it", async () => {
			const { html, quick, full } = await quickThenFull();

			expect(tagsWithId(html, "stars")).toHaveLength(1);
			const forms = [...html.matchAll(/<form\b([^>]*)>/gi)].filter(
				(match) => attribute(match[1] ?? "", "id") === "stars",
			);
			expect(forms).toHaveLength(1);
			expect(starButtons(quick).length).toBeGreaterThan(0);
			expect(starButtons(full).length).toBeGreaterThan(0);
			for (const button of starButtons(html)) {
				expect(attribute(button, "form")).toBe("stars");
			}
			expect(html).not.toMatch(/<script\b/i);
		});

		it("shows alpha starred in both parts", async () => {
			const { quick, full } = await quickThenFull(["alpha"]);

			for (const part of [quick, full]) {
				const alpha = starButtons(part).filter(
					(button) => attribute(button, "value") === "alpha",
				);
				expect(alpha).toHaveLength(1);
				expect(attribute(alpha[0] ?? "", "name")).toBe("unstar");
			}
		});
	});
});
