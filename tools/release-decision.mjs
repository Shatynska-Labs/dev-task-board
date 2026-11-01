// Decides whether a merge publishes, for the release workflow.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

function fail(message) {
	console.error(`release-decision: ${message}`);
	process.exit(1);
}

function parts(version, source) {
	const match = VERSION.exec(version);
	if (!match) fail(`${source} version is not MAJOR.MINOR.PATCH: ${version}`);
	return match.slice(1).map(Number);
}

function compare(a, b) {
	const index = a.findIndex((part, i) => part !== b[i]);
	return index === -1 ? 0 : Math.sign(a[index] - b[index]);
}

const local = JSON.parse(readFileSync("package.json", "utf8")).version;
const localParts = parts(local, "package.json");

const view = spawnSync("npm", ["view", "dev-task-board", "version"], {
	encoding: "utf8",
});

if (view.error) fail(`npm could not run: ${view.error.message}`);

if (view.status !== 0) {
	if (!/^npm error code E404$/m.test(view.stderr)) {
		fail(`npm view failed: ${view.stderr.trim()}`);
	}
	console.error("release-decision: not on the registry, publishing nothing");
	console.log("publish=false");
	process.exit(0);
}

const published = view.stdout.trim();
const order = compare(localParts, parts(published, "registry"));

if (order < 0) fail(`${local} is lower than the published ${published}`);
console.log(`publish=${order > 0}`);
