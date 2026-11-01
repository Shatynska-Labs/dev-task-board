#!/usr/bin/env node
import { readFileSync } from "node:fs";

const packageFile = new URL("../package.json", import.meta.url);
const args = process.argv.slice(2);

if (args.length === 1 && args[0] === "--version") {
	const { version } = JSON.parse(readFileSync(packageFile, "utf8"));
	console.log(version);
} else {
	console.error("usage: dev-task-board --version");
	process.exitCode = 1;
}
