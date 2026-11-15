// Derived from the change `replace-a-running-board`, board-pages delta. The
// terminal is hard to drive from a test, so the scenarios answered in one are
// tested here against `bindPort` (design.md decision 6) with fakes; the
// scenarios without a terminal are tested against the built command in
// replace-board.test.ts.
//
// How the fakes stand in for each dependency is an assumption recorded in the
// change's test-plan.md: `bind(port)` resolves the bound port or rejects with an
// error whose `code` is "EADDRINUSE"; `ask(question)` resolves the line
// answered, or undefined where the input ended, and is absent where standard
// input and output are not both a terminal; `log(...)` writes to standard
// output; `bindPort` resolves the port bound, and refuses the start by
// rejecting with an error whose message is the refusal.
import { describe, expect, it } from "vitest";
import { bindPort } from "../src/port.js";

type Holder = { pid: number; command: string; isBoard: boolean };

const SETTINGS_FILE = "/home/someone/.config/dev-task-board/config.toml";

const otherProgram: Holder = {
	pid: 4242,
	command: "python3 -m http.server",
	isBoard: false,
};

function inUse(port: number): Error {
	return Object.assign(
		new Error(`listen EADDRINUSE: address already in use 127.0.0.1:${port}`),
		{ code: "EADDRINUSE" },
	);
}

type Arrangement = {
	held: number[];
	holder: Holder | undefined;
	terminal: boolean;
	answer?: string | undefined;
	// Ports the holder lets go of once it is sent SIGTERM.
	freedOnTerm?: number[];
};

function arrange(arrangement: Arrangement) {
	const held = new Set(arrangement.held);
	const events: string[] = [];
	const signals: Array<[number, string]> = [];
	const questions: string[] = [];
	const lines: string[] = [];
	const dependencies = {
		bind: async (port: number): Promise<number> => {
			if (held.has(port)) {
				events.push(`refused ${port}`);
				throw inUse(port);
			}
			events.push(`bound ${port}`);
			return port;
		},
		holderOf: async (port: number): Promise<Holder | undefined> =>
			held.has(port) ? arrangement.holder : undefined,
		signal: (pid: number, signal: string): void => {
			signals.push([pid, String(signal)]);
			if (signal === "SIGTERM") {
				for (const port of arrangement.freedOnTerm ?? []) held.delete(port);
			}
		},
		ask: arrangement.terminal
			? async (question: string): Promise<string | undefined> => {
					questions.push(question);
					events.push("asked");
					return arrangement.answer;
				}
			: undefined,
		settingsFile: SETTINGS_FILE,
		log: (...parts: unknown[]): void => {
			lines.push(parts.map(String).join(" "));
		},
	};
	return { dependencies, events, signals, questions, lines };
}

async function outcome(
	port: number,
	dependencies: ReturnType<typeof arrange>["dependencies"],
): Promise<{ port?: number; error?: Error }> {
	try {
		// biome-ignore lint/suspicious/noExplicitAny: the module does not exist yet, and its option type is the implementation's.
		const bound = await bindPort(port, dependencies as any);
		return { port: bound as number };
	} catch (error) {
		return { error: error as Error };
	}
}

function range(from: number, to: number): number[] {
	return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

describe("In a terminal, another port is offered", () => {
	describe("Another program, answered yes", () => {
		it("listens on n+1, prints the settings file and port = <n+1>, and the holder is sent no signal", async () => {
			const n = 40000;
			const { dependencies, signals, lines } = arrange({
				held: [n],
				holder: otherProgram,
				terminal: true,
				answer: "y",
			});

			const result = await outcome(n, dependencies);

			expect(result.error).toBeUndefined();
			expect(result.port).toBe(n + 1);
			expect(signals).toEqual([]);
			const printed = lines.join("\n");
			expect(printed).toContain(SETTINGS_FILE);
			expect(printed).toContain(`port = ${n + 1}`);
		});

		it("asks naming the port, the port offered, and the holder's command and process id", async () => {
			const n = 40000;
			const { dependencies, questions } = arrange({
				held: [n],
				holder: otherProgram,
				terminal: true,
				answer: "y",
			});

			await outcome(n, dependencies);

			expect(questions).toHaveLength(1);
			const [question = ""] = questions;
			expect(question).toContain(String(n));
			expect(question).toContain(String(n + 1));
			expect(question).toContain(otherProgram.command);
			expect(question).toContain(String(otherProgram.pid));
		});

		it.each([
			["yes", "yes"],
			["Y", "Y"],
			["YES with surrounding space", "  YES \n"],
			["y with surrounding space", " y\t"],
		])("takes %s as yes", async (_name, answer) => {
			const n = 40000;
			const { dependencies, signals } = arrange({
				held: [n],
				holder: otherProgram,
				terminal: true,
				answer,
			});

			const result = await outcome(n, dependencies);

			expect(result.port).toBe(n + 1);
			expect(signals).toEqual([]);
		});
	});

	describe("Another program, answered no", () => {
		it.each([
			["an empty line", ""],
			["its input ending", undefined],
			["n", "n"],
			["no", "no"],
		])(
			"refuses the start on %s, binding nothing once answered and signalling nothing",
			async (_name, answer) => {
				const n = 40000;
				const { dependencies, events, signals } = arrange({
					held: [n],
					holder: otherProgram,
					terminal: true,
					answer,
				});

				const result = await outcome(n, dependencies);

				expect(result.port).toBeUndefined();
				expect(result.error).toBeInstanceOf(Error);
				expect(signals).toEqual([]);
				expect(events).toContain("asked");
				const afterAnswer = events.slice(events.indexOf("asked") + 1);
				expect(
					afterAnswer.filter((event) => event.startsWith("bound")),
				).toEqual([]);
			},
		);
	});

	describe("A holder that cannot be found", () => {
		it("still asks, naming the port, and signals nothing", async () => {
			const n = 40000;
			const { dependencies, questions, signals } = arrange({
				held: [n],
				holder: undefined,
				terminal: true,
				answer: "",
			});

			const result = await outcome(n, dependencies);

			expect(result.error).toBeInstanceOf(Error);
			expect(questions).toHaveLength(1);
			expect(questions[0]).toContain(String(n));
			expect(signals).toEqual([]);
		});
	});
});

describe("The offered port", () => {
	it("offers the nearest port above that binds", async () => {
		const n = 40000;
		const { dependencies, questions } = arrange({
			held: [n, n + 1, n + 2],
			holder: otherProgram,
			terminal: true,
			answer: "y",
		});

		const result = await outcome(n, dependencies);

		expect(result.port).toBe(n + 3);
		expect(questions[0]).toContain(String(n + 3));
	});

	it("asks nothing in a terminal where no port up to 100 above binds", async () => {
		const n = 40000;
		const { dependencies, questions, signals } = arrange({
			held: range(n, n + 100),
			holder: otherProgram,
			terminal: true,
			answer: "y",
		});

		const result = await outcome(n, dependencies);

		expect(result.port).toBeUndefined();
		expect(result.error?.message).toContain(String(n));
		expect(result.error?.message).not.toContain("--port");
		expect(questions).toEqual([]);
		expect(signals).toEqual([]);
	});

	it("asks nothing in a terminal where the port held is 65535", async () => {
		const { dependencies, questions } = arrange({
			held: [65535],
			holder: otherProgram,
			terminal: true,
			answer: "y",
		});

		const result = await outcome(65535, dependencies);

		expect(result.port).toBeUndefined();
		expect(result.error?.message).toContain("65535");
		expect(questions).toEqual([]);
	});
});

describe("Another program's port is not taken", () => {
	it("refuses, without a terminal, a holder that cannot be found, advising --port <m> and the setting, and signals nothing", async () => {
		const n = 40000;
		const { dependencies, signals } = arrange({
			held: [n],
			holder: undefined,
			terminal: false,
		});

		const result = await outcome(n, dependencies);

		expect(result.port).toBeUndefined();
		const message = result.error?.message ?? "";
		expect(message).toContain(String(n));
		expect(message).toContain(`--port ${n + 1}`);
		expect(message).toContain("port =");
		expect(signals).toEqual([]);
	});
});

describe("A running board is replaced", () => {
	it("in a terminal too, sends the board SIGTERM and takes the port without asking", async () => {
		const n = 40000;
		const board: Holder = {
			pid: 5151,
			command: "node /opt/dev-task-board/dist/cli.js",
			isBoard: true,
		};
		const { dependencies, questions, signals } = arrange({
			held: [n],
			holder: board,
			terminal: true,
			answer: "",
			freedOnTerm: [n],
		});

		const result = await outcome(n, dependencies);

		expect(result.error).toBeUndefined();
		expect(result.port).toBe(n);
		expect(signals).toEqual([[board.pid, "SIGTERM"]]);
		expect(questions).toEqual([]);
	});
});
