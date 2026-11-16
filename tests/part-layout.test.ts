// The parts of a project's page start their document at the same height, so a
// position restored in one part shows the same rows in the next.
import { describe, expect, it } from "vitest";
import { quickPart } from "../src/render.js";
import { STYLE } from "../src/style.js";
import { fullDocument, workstream } from "./support/document.js";

describe("the parts of a project's page", () => {
	it("marks the quick part as from git alone in a stamp, not a block above the document", () => {
		const part = quickPart(
			fullDocument({ workstreams: [workstream("alpha", [])] }),
		);
		expect(part).toMatch(/<p class="stamp">[^<]*git alone[^<]*<\/p>/i);
		expect(part).not.toMatch(/<div class="notice">/);
	});

	it("still says what the quick read missed, beside its stamp", () => {
		const part = quickPart(
			fullDocument({
				trunk: {
					ref: "origin/main",
					branch: "main",
					commit: "2cc5bd8",
					state: "fetch_failed",
				},
			}),
		);
		expect(part).toMatch(/<p class="stamp">[^<]*git alone/i);
		expect(part).toMatch(
			/<div class="notice"><span>The trunk may be stale: the fetch failed\.<\/span><\/div>/,
		);
	});

	it("gives every stamp one fixed height, so no part's document starts lower", () => {
		expect(STYLE).toMatch(/\.stamp \{[^}]*min-height: 36px/);
		expect(STYLE).toMatch(/position: absolute;[^}]*[^-]height: 36px/);
	});
});
