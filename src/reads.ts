import { spawn } from "node:child_process";
import type { Workspace } from "./settings.js";

export type ProjectDocument = {
	schema_version: number;
	[field: string]: unknown;
};

export type ProjectState =
	| { state: "reading" }
	| { state: "read"; document: ProjectDocument; readAt: string }
	| { state: "failed"; reason: string };

export type ReadOptions = {
	toolPath: string;
	limitMs: number;
	graceMs: number;
};

export type Reads = {
	get(workspace: string, project: string): ProjectState | undefined;
	start(): Promise<void>;
	stop(): Promise<void>;
};

const KNOWN_SCHEMA = 1;
const POLL_MS = 20;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
	try {
		process.kill(-pid, signal);
		return true;
	} catch {
		return false;
	}
}

// The tool's own process group holds whatever it started, so a signal to the
// group reaches them too, and the group is empty only once all are gone.
async function stopGroup(pid: number, graceMs: number): Promise<void> {
	signalGroup(pid, "SIGTERM");
	const deadline = Date.now() + graceMs;
	while (Date.now() < deadline) {
		if (!signalGroup(pid, 0)) {
			return;
		}
		await delay(POLL_MS);
	}
	signalGroup(pid, "SIGKILL");
}

function reasonFromReport(
	stderr: string,
	code: number | null,
	signal: NodeJS.Signals | null,
): string {
	const lines = stderr.split("\n").filter((line) => line.trim() !== "");
	const reason = lines.find((line) => line.startsWith("Reason:"));
	if (reason !== undefined) {
		return reason.slice("Reason:".length).trim();
	}
	return (
		lines.at(-1) ??
		(signal === null
			? `the tool exited with code ${code}`
			: `the tool was stopped by ${signal}`)
	);
}

function stateFromOutput(stdout: string): ProjectState {
	let document: unknown;
	try {
		document = JSON.parse(stdout);
	} catch {
		return { state: "failed", reason: "the tool's output could not be read" };
	}
	const version = (document as { schema_version?: unknown } | null)
		?.schema_version;
	if (version !== KNOWN_SCHEMA) {
		return {
			state: "failed",
			reason: `the tool's schema version ${JSON.stringify(version)} is not known`,
		};
	}
	return {
		state: "read",
		document: document as ProjectDocument,
		readAt: new Date().toISOString(),
	};
}

export function createReads(
	workspaces: Workspace[],
	options: ReadOptions,
): Reads {
	const states = new Map<string, ProjectState>();
	const running = new Map<number, () => Promise<void>>();
	let stopped = false;
	let finished: Promise<unknown> = Promise.resolve();

	const key = (workspace: string, project: string) =>
		JSON.stringify([workspace, project]);

	function readProject(path: string): Promise<ProjectState> {
		return new Promise((resolve) => {
			const child = spawn("bash", [options.toolPath, "--json", path], {
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});
			let stdout = "";
			let stderr = "";
			let limitPassed = false;
			let stopping: Promise<void> | undefined;
			child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
				stdout += chunk;
			});
			child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
				stderr += chunk;
			});
			const stop = () => {
				if (child.pid !== undefined) {
					stopping ??= stopGroup(child.pid, options.graceMs);
				}
				return stopping ?? Promise.resolve();
			};
			const timer = setTimeout(() => {
				limitPassed = true;
				void stop();
			}, options.limitMs);
			if (child.pid !== undefined) {
				running.set(child.pid, stop);
			}
			const finish = (state: ProjectState) => {
				clearTimeout(timer);
				if (child.pid !== undefined) {
					running.delete(child.pid);
				}
				resolve(state);
			};
			child.on("error", (error) => {
				finish({ state: "failed", reason: error.message });
			});
			child.on("close", async (code, signal) => {
				await stopping;
				if (limitPassed) {
					finish({
						state: "failed",
						reason: `the read passed its limit of ${options.limitMs / 1000} seconds`,
					});
				} else if (code === 0) {
					finish(stateFromOutput(stdout));
				} else {
					finish({
						state: "failed",
						reason: reasonFromReport(stderr, code, signal),
					});
				}
			});
		});
	}

	async function readWorkspace(workspace: Workspace): Promise<void> {
		for (const project of workspace.projects) {
			if (stopped) {
				return;
			}
			states.set(
				key(workspace.name, project.name),
				await readProject(project.path),
			);
		}
	}

	for (const workspace of workspaces) {
		for (const project of workspace.projects) {
			states.set(key(workspace.name, project.name), { state: "reading" });
		}
	}

	return {
		get: (workspace, project) => states.get(key(workspace, project)),
		start() {
			const reading = Promise.all(workspaces.map(readWorkspace)).then(
				() => undefined,
			);
			finished = reading;
			return reading;
		},
		async stop() {
			stopped = true;
			await Promise.all([...running.values()].map((stop) => stop()));
			await finished;
		},
	};
}
