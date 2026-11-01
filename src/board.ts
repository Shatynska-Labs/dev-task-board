import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createReads } from "./reads.js";
import { startServer } from "./server.js";
import {
	parseSettings,
	SettingsError,
	settingsPath,
	type Workspace,
} from "./settings.js";

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
	return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function readSettings(): Workspace[] {
	const home = homedir();
	const file = settingsPath(process.env, home);
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

function refusalOfPort(port: number, error: NodeJS.ErrnoException): string {
	return error.code === "EADDRINUSE"
		? `port ${port} is in use`
		: `port ${port} cannot be bound: ${error.message}`;
}

export async function startBoard(port: number): Promise<void> {
	try {
		checkRequiredCommands();
		const workspaces = readSettings();
		const reads = createReads(workspaces, {
			toolPath: fileURLToPath(new URL("../vendor/task-board", import.meta.url)),
			limitMs: READ_LIMIT_MS,
			graceMs: STOP_GRACE_MS,
		});
		const closing = new AbortController();
		let bound: number;
		try {
			bound = await startServer({ workspaces, reads }, port, closing.signal);
		} catch (error) {
			throw new StartRefused(
				refusalOfPort(port, error as NodeJS.ErrnoException),
			);
		}
		const stop = async () => {
			closing.abort();
			await reads.stop();
			process.exit(0);
		};
		process.once("SIGINT", stop);
		process.once("SIGTERM", stop);
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
