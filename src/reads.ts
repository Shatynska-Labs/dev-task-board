import { spawn } from "node:child_process";
import type { Project, Workspace } from "./settings.js";

export type ProjectDocument = {
	schema_version: number;
	[field: string]: unknown;
};

// A later read that did not replace the document held.
export type LatestRead =
	| { at: string; reason: string }
	| { at: string; missed: string[] };

type Held = {
	state: "read";
	document: ProjectDocument;
	readAt: string;
	latest?: LatestRead;
};

type Failed = { state: "failed"; reason: string };

export type ProjectState = { state: "reading" } | Held | Failed;

type Outcome = Held | Failed;

export type ReadOptions = {
	toolPath: string;
	limitMs: number;
	graceMs: number;
};

export type Reads = {
	get(workspace: string, project: string): ProjectState | undefined;
	refresh(workspace: string, project?: string): Promise<void>;
	start(): Promise<void>;
	stop(): Promise<void>;
};

const KNOWN_SCHEMA = 1;
const POLL_MS = 20;
const DRAIN_MS = 1000;

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

export function isFull(document: ProjectDocument): boolean {
	return document.forge === "full";
}

export function whatMissed(document: ProjectDocument): string[] {
	const trunk = document.trunk as
		| { branch?: string; state?: string }
		| undefined;
	const missed: string[] = [];
	if (!isFull(document)) {
		missed.push(`The forge read was ${document.forge}: statuses may be wrong.`);
	}
	if (trunk?.state === "fetch_failed") {
		missed.push("The trunk may be stale: the fetch failed.");
	}
	if (trunk?.state === "no_origin") {
		missed.push(
			`No remote named origin: read the current branch, ${trunk.branch}.`,
		);
	}
	if (document.remote_branches_read === false) {
		missed.push("Remote branches not read.");
	}
	return missed;
}

// What a read leaves a project holding: only a full read is sure to replace a
// document, and a degraded one replaces anything but a full one.
export function settle(
	previous: ProjectState | undefined,
	outcome: Outcome,
	at: string,
): ProjectState {
	if (previous?.state !== "read") {
		return outcome;
	}
	if (outcome.state === "failed") {
		return { ...previous, latest: { at, reason: outcome.reason } };
	}
	if (isFull(previous.document) && !isFull(outcome.document)) {
		return {
			...previous,
			latest: { at, missed: whatMissed(outcome.document) },
		};
	}
	return outcome;
}

function outcomeFromOutput(stdout: string): Outcome {
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
	const inFlight = new Map<string, Promise<void>>();
	let stopped = false;
	let finished: Promise<unknown> = Promise.resolve();

	const key = (workspace: string, project: string) =>
		JSON.stringify([workspace, project]);

	function readProject(path: string): Promise<Outcome> {
		return new Promise((resolve) => {
			const child = spawn("bash", [options.toolPath, "--json", path], {
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});
			let stdout = "";
			let stderr = "";
			let limitPassed = false;
			let exited = false;
			let stopping: Promise<void> | undefined;
			child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
				stdout += chunk;
			});
			child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
				stderr += chunk;
			});
			const stop = () => {
				if (!exited && child.pid !== undefined) {
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
			const closed = new Promise((closes) => child.once("close", closes));
			const finish = (state: Outcome) => {
				clearTimeout(timer);
				if (child.pid !== undefined) {
					running.delete(child.pid);
				}
				resolve(state);
			};
			child.on("error", (error) => {
				finish({ state: "failed", reason: error.message });
			});
			// Not "close": a process that left the group can hold the pipes open
			// for as long as it likes, and neither the limit nor a stop may wait
			// for it.
			child.on("exit", async (code, signal) => {
				exited = true;
				clearTimeout(timer);
				await stopping;
				await Promise.race([closed, delay(DRAIN_MS)]);
				child.stdout.destroy();
				child.stderr.destroy();
				if (limitPassed) {
					finish({
						state: "failed",
						reason: `the read passed its limit of ${options.limitMs / 1000} seconds`,
					});
				} else if (code === 0) {
					finish(outcomeFromOutput(stdout));
				} else {
					finish({
						state: "failed",
						reason: reasonFromReport(stderr, code, signal),
					});
				}
			});
		});
	}

	// One read per project: whoever asks during a read waits for that read.
	function readOnce(workspace: Workspace, project: Project): Promise<void> {
		const id = key(workspace.name, project.name);
		const current = inFlight.get(id);
		if (current !== undefined) {
			return current;
		}
		const read = readProject(project.path).then((outcome) => {
			states.set(id, settle(states.get(id), outcome, new Date().toISOString()));
			inFlight.delete(id);
		});
		inFlight.set(id, read);
		return read;
	}

	async function readWorkspace(workspace: Workspace): Promise<void> {
		for (const project of workspace.projects) {
			if (stopped) {
				return;
			}
			await readOnce(workspace, project);
		}
	}

	for (const workspace of workspaces) {
		for (const project of workspace.projects) {
			states.set(key(workspace.name, project.name), { state: "reading" });
		}
	}

	return {
		get: (workspace, project) => states.get(key(workspace, project)),
		async refresh(workspaceName, projectName) {
			const workspace = workspaces.find(({ name }) => name === workspaceName);
			if (stopped || workspace === undefined) {
				return;
			}
			const projects = workspace.projects.filter(
				({ name }) => projectName === undefined || name === projectName,
			);
			await Promise.all(
				projects.map((project) => readOnce(workspace, project)),
			);
		},
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
			await Promise.all([finished, ...inFlight.values()]);
		},
	};
}
