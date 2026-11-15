import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { bindPort, holderOf, PortRefused } from "./port.js";
import { createReads } from "./reads.js";
import { startServer } from "./server.js";
import {
	parseSettings,
	type Settings,
	SettingsError,
	settingsPath,
} from "./settings.js";
import { loadStars, type Stars, StarsError, starsPath } from "./stars.js";

const DEFAULT_PORT = 8766;
const READ_LIMIT_MS = 60_000;
const STOP_GRACE_MS = 5_000;
const REQUIRED_COMMANDS = ["bash", "git", "awk"];
const EXPECTED_SHAPE = `[workspaces.<name>]
projects = ["~/path/to/project"]`;

class StartRefused extends Error {}

function isExecutable(path: string): boolean {
	try {
		accessSync(path, constants.X_OK);
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function checkRequiredCommands(): void {
	const directories = (process.env.PATH ?? "").split(delimiter);
	const missing = REQUIRED_COMMANDS.filter(
		(command) =>
			!directories.some((directory) => isExecutable(join(directory, command))),
	);
	if (missing.length > 0) {
		throw new StartRefused(`not on PATH: ${missing.join(", ")}`);
	}
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function readSettings(file: string): Settings {
	const home = homedir();
	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		throw new StartRefused(
			`${file} could not be read. It holds:\n\n${EXPECTED_SHAPE}`,
		);
	}
	try {
		return parseSettings(text, { home, isDirectory });
	} catch (error) {
		if (error instanceof SettingsError) {
			throw new StartRefused(`${file}: ${error.message}`);
		}
		throw error;
	}
}

async function readStars(): Promise<Stars> {
	try {
		return await loadStars(starsPath(process.env, homedir()));
	} catch (error) {
		if (error instanceof StarsError) {
			throw new StartRefused(error.message);
		}
		throw error;
	}
}

// Asks on the terminal; an ended or interrupted input answers nothing.
function ask(question: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const lines = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		let answered = false;
		const finish = (answer: string | undefined) => {
			if (!answered) {
				answered = true;
				lines.close();
				resolve(answer);
			}
		};
		lines.on("SIGINT", () => finish(undefined));
		lines.on("close", () => finish(undefined));
		lines.question(question, finish);
	});
}

function refusalOfPort(port: number, error: NodeJS.ErrnoException): string {
	return error.code === "EADDRINUSE"
		? `port ${port} is in use`
		: `port ${port} cannot be bound: ${error.message}`;
}

export async function startBoard(requested?: number): Promise<void> {
	try {
		checkRequiredCommands();
		const file = settingsPath(process.env, homedir());
		const settings = readSettings(file);
		const { workspaces } = settings;
		const port = requested ?? settings.port ?? DEFAULT_PORT;
		const stars = await readStars();
		const reads = createReads(workspaces, {
			toolPath: fileURLToPath(new URL("../vendor/task-board", import.meta.url)),
			limitMs: READ_LIMIT_MS,
			graceMs: STOP_GRACE_MS,
		});
		const closing = new AbortController();
		let bound: number;
		try {
			bound = await bindPort(port, {
				bind: (each) =>
					startServer({ workspaces, reads, stars }, each, closing.signal),
				holderOf,
				signal: (pid, signal) => process.kill(pid, signal),
				...(process.stdin.isTTY && process.stdout.isTTY ? { ask } : {}),
				settingsFile: file,
				log: (...parts) => console.log(...parts),
			});
		} catch (error) {
			// Closes a port held for an offer that was declined.
			closing.abort();
			if (error instanceof PortRefused) {
				throw new StartRefused(error.message);
			}
			throw new StartRefused(
				refusalOfPort(port, error as NodeJS.ErrnoException),
			);
		}
		const stop = async () => {
			if (closing.signal.aborted) {
				return;
			}
			closing.abort();
			await reads.stop();
			process.exit(0);
		};
		process.on("SIGINT", stop);
		process.on("SIGTERM", stop);
		console.log(`http://127.0.0.1:${bound}`);
		await reads.start();
	} catch (error) {
		if (!(error instanceof StartRefused)) {
			throw error;
		}
		console.error(`dev-task-board: ${error.message}`);
		process.exitCode = 1;
	}
}
