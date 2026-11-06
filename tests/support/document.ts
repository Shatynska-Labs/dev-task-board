// Builders of the carried tool's `--json` document and of a project's page
// from it, promoted from the tests of `show-a-tasks-kind-and-wait`.
import { renderProject } from "../../src/render.js";

export type Task = {
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
	// The keys the carried tool gives from ai-toolkit e0bc0c6 on; absent from a
	// document written by an older tool, so absent from the default task.
	kind?: string | null;
	need?: string | null;
	waits_for?: string | null;
	waits_for_type?: string[];
	parked_until?: string | null;
	waits_on_done?: string[];
	readiness?: string | null;
};

export const WRITTEN_AT = "2026-11-01T22:00:00Z";
export const THREE_DAYS_BEFORE = Date.parse(WRITTEN_AT) / 1000 - 3 * 86400;

export function task(name: string, fields: Partial<Task> = {}): Task {
	return {
		name,
		status: "recorded",
		stage: null,
		workstreams: [],
		unplaced: false,
		closed_workstream: null,
		parts: ["entry"],
		last_commit: THREE_DAYS_BEFORE,
		summary: null,
		priority: null,
		waits_on: [],
		body: null,
		merge_unchecked: false,
		warnings: [],
		...fields,
	};
}

export function step(
	name: string,
	stream: string,
	fields: Partial<Task> = {},
): Task {
	return task(name, { workstreams: [stream], parts: ["step"], ...fields });
}

export function workstream(
	name: string,
	steps: string[],
	summary: string | null = null,
) {
	return {
		name,
		summary,
		goal: `the goal of ${name}`,
		done_when: `the end of ${name}`,
		active: true,
		steps: steps.map((each) => ({
			name: each,
			description: `the step ${each}`,
		})),
		warnings: [],
	};
}

export function fullDocument(fields: Record<string, unknown> = {}) {
	return {
		schema_version: 1,
		project: "alpha",
		written_at: WRITTEN_AT,
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

export type ProjectState = Parameters<typeof renderProject>[2];

export function page(document: unknown): string {
	const state = {
		state: "read",
		document,
		readAt: "2026-11-01T22:18:00Z",
	} as unknown as ProjectState;
	return renderProject("work", "alpha", state);
}

// A page holding only the given tasks, in no workstream.
export function loosePage(...tasks: Task[]): string {
	return page(fullDocument({ tasks }));
}
