import { describe, expect, it } from "vitest";
import { renderProject } from "../src/render.js";

// Derived from openspec/changes/show-only-the-read-time, board-pages,
// "A project's page shows its document", scenario "Only the time of the read".

type ProjectState = Parameters<typeof renderProject>[2];

// Local arrangement: tests/support/ holds no document or project-state builder.
function documentWrittenBeforeTheRead() {
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
	};
}

function readAt(document: unknown, at: string): ProjectState {
	return { state: "read", document, readAt: at } as unknown as ProjectState;
}

// What a reader sees: inline CSS may carry any word as a class.
function textOf(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}

function shownPage(): string {
	return textOf(
		renderProject(
			"work",
			"alpha",
			readAt(documentWrittenBeforeTheRead(), "2026-11-01T22:18:05.123Z"),
		),
	);
}

describe("A project's page shows its document", () => {
	describe("Only the time of the read", () => {
		it("shows Read and the time of the read", () => {
			expect(shownPage()).toContain("Read 2026-11-01 22:18:05 UTC");
		});

		it("does not show the document's written_at", () => {
			expect(shownPage()).not.toContain("22:17");
		});

		it("does not say written", () => {
			expect(shownPage()).not.toContain("written");
		});

		it("does not show the trunk's ref", () => {
			expect(shownPage()).not.toContain("origin/main");
		});

		it("does not show the trunk's commit", () => {
			expect(shownPage()).not.toContain("2cc5bd8");
		});
	});
});
