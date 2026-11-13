import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Workstreams the operator has starred, by project path. A view preference
// kept on this machine, never written to a repository.
export type Stars = {
	starred(projectPath: string): Set<string>;
	set(projectPath: string, workstream: string, on: boolean): Promise<void>;
};

export class StarsError extends Error {}

const VERSION = 1;

export function starsPath(
	env: Record<string, string | undefined>,
	home: string,
): string {
	const base = env.XDG_STATE_HOME || join(home, ".local", "state");
	return join(base, "dev-task-board", "stars.json");
}

function isStringList(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((name) => typeof name === "string")
	);
}

function parse(path: string, text: string): Map<string, Set<string>> {
	let content: unknown;
	try {
		content = JSON.parse(text);
	} catch (error) {
		throw new StarsError(
			`${path}: not valid JSON: ${(error as Error).message}`,
		);
	}
	if (
		typeof content !== "object" ||
		content === null ||
		Array.isArray(content)
	) {
		throw new StarsError(`${path}: not an object`);
	}
	const { version, stars } = content as Record<string, unknown>;
	if (version !== VERSION) {
		throw new StarsError(
			`${path}: version ${JSON.stringify(version)} is not known; this board reads version ${VERSION}`,
		);
	}
	if (typeof stars !== "object" || stars === null || Array.isArray(stars)) {
		throw new StarsError(`${path}: "stars" is not an object`);
	}
	const held = new Map<string, Set<string>>();
	for (const [project, names] of Object.entries(stars)) {
		if (!isStringList(names)) {
			throw new StarsError(
				`${path}: the stars of ${project} are not a list of names`,
			);
		}
		held.set(project, new Set(names));
	}
	return held;
}

function serialise(held: Map<string, Set<string>>): string {
	const stars: Record<string, string[]> = {};
	for (const project of [...held.keys()].sort()) {
		const names = [...(held.get(project) ?? [])].sort();
		if (names.length > 0) {
			stars[project] = names;
		}
	}
	return `${JSON.stringify({ version: VERSION, stars }, null, 2)}\n`;
}

let written = 0;

// Written beside the file and renamed over it, so a crash leaves one or the
// other whole.
async function writeWhole(path: string, text: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	written += 1;
	const temporary = `${path}.${process.pid}.${written}.tmp`;
	try {
		await writeFile(temporary, text);
		await rename(temporary, path);
	} catch (error) {
		await rm(temporary, { force: true });
		throw error;
	}
}

export async function loadStars(path: string): Promise<Stars> {
	let text: string | undefined;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw new StarsError(
				`${path} could not be read: ${(error as Error).message}`,
			);
		}
	}
	let held =
		text === undefined ? new Map<string, Set<string>>() : parse(path, text);
	// Sets one at a time, each from the result of the last.
	let queue: Promise<unknown> = Promise.resolve();
	return {
		starred(projectPath) {
			return new Set(held.get(projectPath) ?? []);
		},
		set(projectPath, workstream, on) {
			const next = queue.then(async () => {
				const names = new Set(held.get(projectPath) ?? []);
				if (on) {
					names.add(workstream);
				} else {
					names.delete(workstream);
				}
				const changed = new Map(held);
				changed.set(projectPath, names);
				await writeWhole(path, serialise(changed));
				held = changed;
			});
			queue = next.catch(() => {});
			return next;
		},
	};
}
