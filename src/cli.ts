#!/usr/bin/env node
import { readFileSync } from "node:fs";

const DEFAULT_PORT = 8766;
const LOWEST_PORT = 1024;
const HIGHEST_PORT = 65535;

function requestedPort(args: string[]): number | undefined {
	if (args.length === 0) {
		return DEFAULT_PORT;
	}
	const [flag, value] = args;
	if (args.length !== 2 || flag !== "--port" || !/^\d+$/.test(value ?? "")) {
		return undefined;
	}
	const port = Number(value);
	return port >= LOWEST_PORT && port <= HIGHEST_PORT ? port : undefined;
}

const args = process.argv.slice(2);

if (args.length === 1 && args[0] === "--version") {
	const packageFile = new URL("../package.json", import.meta.url);
	const { version } = JSON.parse(readFileSync(packageFile, "utf8"));
	console.log(version);
} else {
	const port = requestedPort(args);
	if (port === undefined) {
		console.error(
			`usage: dev-task-board [--port ${LOWEST_PORT}-${HIGHEST_PORT}] | --version`,
		);
		process.exitCode = 1;
	} else {
		// Loaded here so that --version needs no dependency.
		const { startBoard } = await import("./board.js");
		await startBoard(port);
	}
}
