// A regression test from the code review of `star-workstreams`: a star whose
// client goes away before its body ends must not stop the board.
import { connect } from "node:net";
import { describe, expect, it } from "vitest";
import { startServer } from "../src/server.js";
import { fullDocument, step, workstream } from "./support/document.js";

const document = fullDocument({
	workstreams: [workstream("alpha", ["s-1"])],
	tasks: [step("s-1", "alpha")],
});

function statusOf(port: number, path: string): Promise<number> {
	return fetch(`http://127.0.0.1:${port}${path}`).then(({ status }) => status);
}

describe("A star whose client goes away", () => {
	it("leaves the board answering", async () => {
		const port = await startServer(
			{
				workspaces: [
					{ name: "work", projects: [{ name: "one", path: "/srv/one" }] },
				],
				reads: {
					get: () => ({
						state: "read",
						document,
						readAt: "2026-11-01T22:18:00Z",
					}),
					quick: async () => undefined,
					refresh: async () => {},
				},
			},
			0,
		);
		const host = `127.0.0.1:${port}`;
		await new Promise<void>((resolve, reject) => {
			const socket = connect(port, "127.0.0.1", () => {
				socket.write(
					`POST /work/one HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nSec-Fetch-Site: same-origin\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 100\r\n\r\nstar=al`,
				);
				setTimeout(() => {
					socket.destroy();
					resolve();
				}, 50);
			});
			socket.on("error", reject);
		});
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(await statusOf(port, "/work")).toBe(200);
	});
});
