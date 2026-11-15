import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { HIGHEST_PORT } from "./settings.js";

// What listens on a port: a process, its command line, and whether it is a
// dev-task-board this board may replace.
export type Holder = { pid: number; command: string; isBoard: boolean };

const WAIT_MS = 10_000;
const RETRY_MS = 100;
const OFFER_RANGE = 100;

// A board is `dist/cli.js` in a package named dev-task-board, run as the
// script of its interpreter by an absolute path. Every doubt is "no".
function isBoardScript(script: string | undefined): boolean {
	if (script === undefined || !isAbsolute(script)) {
		return false;
	}
	try {
		const real = realpathSync(script);
		if (basename(real) !== "cli.js" || basename(dirname(real)) !== "dist") {
			return false;
		}
		const manifest = join(dirname(dirname(real)), "package.json");
		return JSON.parse(readFileSync(manifest, "utf8")).name === "dev-task-board";
	} catch {
		return false;
	}
}

function holder(pid: number, argv: string[]): Holder {
	return { pid, command: argv.join(" "), isBoard: isBoardScript(argv[1]) };
}

// Linux: the listening socket's inode and owner from /proc/net/tcp{,6}, then
// the process holding that inode among this user's processes.
function linuxHolder(port: number): Holder | undefined {
	const hexPort = port.toString(16).toUpperCase().padStart(4, "0");
	const listening = new Map<string, number>();
	for (const table of ["/proc/net/tcp", "/proc/net/tcp6"]) {
		let text: string;
		try {
			text = readFileSync(table, "utf8");
		} catch {
			continue;
		}
		for (const line of text.split("\n").slice(1)) {
			const fields = line.trim().split(/\s+/);
			const [, local, , state, , , , uid, , inode] = fields;
			if (local?.endsWith(`:${hexPort}`) && state === "0A" && inode) {
				listening.set(inode, Number(uid));
			}
		}
	}
	const own = process.getuid?.();
	for (const pid of readdirSync("/proc").filter((name) => /^\d+$/.test(name))) {
		let descriptors: string[];
		try {
			descriptors = readdirSync(`/proc/${pid}/fd`);
		} catch {
			continue;
		}
		for (const descriptor of descriptors) {
			let target: string;
			try {
				target = readlinkSync(`/proc/${pid}/fd/${descriptor}`);
			} catch {
				continue;
			}
			const inode = /^socket:\[(\d+)\]$/.exec(target)?.[1];
			if (inode === undefined || !listening.has(inode)) {
				continue;
			}
			const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8")
				.split("\0")
				.filter((part) => part !== "");
			const found = holder(Number(pid), argv);
			return listening.get(inode) === own
				? found
				: { ...found, isBoard: false };
		}
	}
	return undefined;
}

// macOS: lsof names the listening process, ps its owner and command line.
function macHolder(port: number): Holder | undefined {
	const lsof = spawnSync(
		"lsof",
		["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"],
		{ encoding: "utf8" },
	);
	const pid = Number(/^p(\d+)$/m.exec(lsof.stdout ?? "")?.[1]);
	if (!Number.isInteger(pid) || pid <= 0) {
		return undefined;
	}
	const ps = spawnSync(
		"ps",
		["-ww", "-o", "uid=,command=", "-p", String(pid)],
		{
			encoding: "utf8",
		},
	);
	const [uid, ...argv] = (ps.stdout ?? "").trim().split(/\s+/);
	if (uid === undefined || argv.length === 0) {
		return undefined;
	}
	const found = holder(pid, argv);
	return Number(uid) === process.getuid?.()
		? found
		: { ...found, isBoard: false };
}

export async function holderOf(port: number): Promise<Holder | undefined> {
	try {
		return process.platform === "linux" ? linuxHolder(port) : macHolder(port);
	} catch {
		return undefined;
	}
}

export type BindDependencies = {
	bind(port: number): Promise<number>;
	holderOf(port: number): Promise<Holder | undefined>;
	signal(pid: number, signal: NodeJS.Signals): void;
	// Absent where standard input and output are not both a terminal; resolves
	// undefined where the input ended.
	ask?: (question: string) => Promise<string | undefined>;
	settingsFile: string;
	log(...parts: unknown[]): void;
};

export class PortRefused extends Error {}

function isInUse(error: unknown): boolean {
	return (error as NodeJS.ErrnoException)?.code === "EADDRINUSE";
}

async function tryBind(
	port: number,
	bind: BindDependencies["bind"],
): Promise<number | undefined> {
	try {
		return await bind(port);
	} catch (error) {
		if (isInUse(error)) {
			return undefined;
		}
		throw error;
	}
}

// The nearest port above `port` that binds, left bound so it is not lost
// while the user is asked.
async function offered(
	port: number,
	bind: BindDependencies["bind"],
): Promise<number | undefined> {
	const last = Math.min(port + OFFER_RANGE, HIGHEST_PORT);
	for (let candidate = port + 1; candidate <= last; candidate++) {
		const bound = await tryBind(candidate, bind);
		if (bound !== undefined) {
			return bound;
		}
	}
	return undefined;
}

async function replace(
	port: number,
	board: Holder,
	dependencies: BindDependencies,
): Promise<number> {
	dependencies.signal(board.pid, "SIGTERM");
	const deadline = Date.now() + WAIT_MS;
	for (;;) {
		const bound = await tryBind(port, dependencies.bind);
		if (bound !== undefined) {
			dependencies.log(
				`replaced the dev-task-board on port ${port} (pid ${board.pid})`,
			);
			return bound;
		}
		if (Date.now() >= deadline) {
			throw new PortRefused(
				`port ${port} is still held by the dev-task-board it was asked to stop (pid ${board.pid})`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
	}
}

function isYes(answer: string | undefined): boolean {
	return /^(y|yes)$/i.test((answer ?? "").trim());
}

// Binds `port`; where a board holds it, replaces that board; where anything
// else does, offers the nearest free port above or refuses. A refusal is a
// rejected PortRefused; any other bind failure is rethrown as it came.
export async function bindPort(
	port: number,
	dependencies: BindDependencies,
): Promise<number> {
	const bound = await tryBind(port, dependencies.bind);
	if (bound !== undefined) {
		return bound;
	}
	const found = await dependencies.holderOf(port);
	if (found?.isBoard) {
		return replace(port, found, dependencies);
	}
	const by =
		found === undefined ? "" : ` by ${found.command} (pid ${found.pid})`;
	const alternative = await offered(port, dependencies.bind);
	if (alternative === undefined) {
		throw new PortRefused(
			`port ${port} is used${by}, and no port up to ${Math.min(port + OFFER_RANGE, HIGHEST_PORT)} is free`,
		);
	}
	if (dependencies.ask === undefined) {
		throw new PortRefused(
			`port ${port} is used${by}. Start with --port ${alternative}, or add port = ${alternative} to ${dependencies.settingsFile}`,
		);
	}
	const answer = await dependencies.ask(
		`port ${port} is used${by}. Start on ${alternative} instead? [y/N] `,
	);
	if (!isYes(answer)) {
		throw new PortRefused(`port ${port} is used${by}`);
	}
	dependencies.log(
		`to keep port ${alternative}, add port = ${alternative} to ${dependencies.settingsFile}`,
	);
	return alternative;
}
