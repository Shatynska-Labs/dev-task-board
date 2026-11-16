import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
	mkdir,
	readFile,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, stringify, TomlError } from "smol-toml";
import {
	parseSettings,
	projectsDirOf,
	type Settings,
	SettingsError,
	type SettingsOptions,
	writtenPath,
} from "./settings.js";

// One change the settings page asks for.
export type SettingsAction =
	| { kind: "add"; workspace: string; project: string }
	| { kind: "remove"; workspace: string; project: string }
	| { kind: "add_workspace"; workspace: string }
	| { kind: "remove_workspace"; workspace: string };

// A save refused for what it asks: answered 400, the file unchanged.
export class SaveRefused extends Error {}
// A save that could not read or write the file: answered 500.
export class SaveFailed extends Error {}

// The action a form's fields name, where they name exactly one.
export function actionOf(
	fields: [string, string][],
): SettingsAction | undefined {
	const named = new Map(fields);
	if (named.size !== fields.length) {
		return undefined;
	}
	const keys = [...named.keys()].sort().join(",");
	const workspace = named.get("workspace") ?? "";
	switch (keys) {
		case "add,workspace":
			return { kind: "add", workspace, project: named.get("add") ?? "" };
		case "remove,workspace":
			return { kind: "remove", workspace, project: named.get("remove") ?? "" };
		case "add_workspace":
			return {
				kind: "add_workspace",
				workspace: (named.get("add_workspace") ?? "").trim(),
			};
		case "remove_workspace":
			return {
				kind: "remove_workspace",
				workspace: named.get("remove_workspace") ?? "",
			};
		default:
			return undefined;
	}
}

function isTable(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The file's table with the action applied, every other key kept as read.
function applied(
	table: Record<string, unknown>,
	action: SettingsAction,
): Record<string, unknown> {
	const workspaces = table.workspaces ?? {};
	if (!isTable(workspaces)) {
		throw new SaveRefused("workspaces is not a table");
	}
	const held = workspaces[action.workspace];
	if (action.kind === "add_workspace") {
		if (action.workspace === "") {
			throw new SaveRefused("a workspace needs a name");
		}
		if (held !== undefined) {
			throw new SaveRefused(`workspace ${action.workspace} already exists`);
		}
		return {
			...table,
			workspaces: { ...workspaces, [action.workspace]: { projects: [] } },
		};
	}
	if (!isTable(held)) {
		throw new SaveRefused(`there is no workspace ${action.workspace}`);
	}
	const projects = Array.isArray(held.projects) ? held.projects : [];
	if (action.kind === "remove_workspace") {
		if (projects.length > 0) {
			throw new SaveRefused(
				`workspace ${action.workspace} still has projects: remove them first`,
			);
		}
		const { [action.workspace]: _removed, ...rest } = workspaces;
		return { ...table, workspaces: rest };
	}
	const project = action.project.trim();
	if (action.kind === "add") {
		if (project === "") {
			throw new SaveRefused("a project needs a name or a path");
		}
		if (projects.includes(project)) {
			throw new SaveRefused(
				`workspace ${action.workspace} already holds ${project}`,
			);
		}
		return {
			...table,
			workspaces: {
				...workspaces,
				[action.workspace]: { ...held, projects: [...projects, project] },
			},
		};
	}
	if (!projects.includes(project)) {
		throw new SaveRefused(
			`workspace ${action.workspace} does not hold ${project}`,
		);
	}
	return {
		...table,
		workspaces: {
			...workspaces,
			[action.workspace]: {
				...held,
				projects: projects.filter((each) => each !== project),
			},
		},
	};
}

// The file a save writes: the target of a link, so that the link stays.
async function targetOf(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return path;
		}
		throw new SaveFailed(
			`${path} could not be read: ${(error as Error).message}`,
		);
	}
}

async function textOf(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return "";
		}
		throw new SaveFailed(
			`${path} could not be read: ${(error as Error).message}`,
		);
	}
}

let written = 0;

// Written beside the file and renamed over it, so a crash leaves one or the
// other whole.
async function writeWhole(path: string, text: string): Promise<void> {
	written += 1;
	const temporary = `${path}.${process.pid}.${written}.tmp`;
	try {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(temporary, text);
		await rename(temporary, path);
	} catch (error) {
		await rm(temporary, { force: true });
		throw new SaveFailed(
			`${path} could not be written: ${(error as Error).message}`,
		);
	}
}

export type SettingsFile = {
	save(action: SettingsAction): Promise<Settings>;
};

// Saves applied one at a time, each reading the file the one before wrote.
export function settingsFile(
	path: string,
	options: SettingsOptions,
): SettingsFile {
	let queue: Promise<unknown> = Promise.resolve();
	return {
		save(action) {
			const next = queue.then(async () => {
				const target = await targetOf(path);
				let table: Record<string, unknown>;
				try {
					table = parse(await textOf(target));
				} catch (error) {
					if (error instanceof TomlError) {
						throw new SaveRefused(`not valid TOML: ${error.message}`);
					}
					throw error;
				}
				const text = `${stringify(applied(table, action))}\n`;
				let settings: Settings;
				try {
					settings = parseSettings(text, options);
				} catch (error) {
					if (error instanceof SettingsError) {
						throw new SaveRefused(error.message);
					}
					throw error;
				}
				await writeWhole(target, text);
				return settings;
			});
			queue = next.catch(() => {});
			return next;
		},
	};
}

// What the settings page shows: the file as written, and what it finds.
export type SettingsView = {
	projectsDir: string;
	// By name in the projects folder, and path; undefined where the folder
	// could not be read.
	found: { name: string; path: string }[] | undefined;
	workspaces: { name: string; projects: string[]; paths: string[] }[];
	// Why the file could not be shown, where it could not.
	fault?: string;
};

function isGitRepository(path: string): boolean {
	return existsSync(join(path, ".git"));
}

function isDirectoryAt(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function looked(name: string): boolean {
	return !name.startsWith(".") && name !== "node_modules";
}

// The git repositories a child or grandchild of the folder, by their names
// relative to it, sorted; undefined where the folder cannot be read.
export function findRepositories(folder: string): string[] | undefined {
	let children: string[];
	try {
		children = readdirSync(folder);
	} catch {
		return undefined;
	}
	const found: string[] = [];
	for (const child of children.filter(looked)) {
		const path = join(folder, child);
		if (!isDirectoryAt(path)) {
			continue;
		}
		if (isGitRepository(path)) {
			found.push(child);
			continue;
		}
		let grandchildren: string[] = [];
		try {
			grandchildren = readdirSync(path);
		} catch {
			continue;
		}
		for (const grandchild of grandchildren.filter(looked)) {
			const inner = join(path, grandchild);
			if (isDirectoryAt(inner) && isGitRepository(inner)) {
				found.push(`${child}/${grandchild}`);
			}
		}
	}
	return found.sort();
}

export function settingsView(path: string, home: string): SettingsView {
	let table: Record<string, unknown> = {};
	let fault: string | undefined;
	try {
		table = parse(readFileSync(path, "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			fault = `${path} could not be read: ${(error as Error).message}`;
		}
	}
	let projectsDir: string;
	try {
		projectsDir = projectsDirOf(table.projects_dir, home);
	} catch (error) {
		projectsDir = projectsDirOf(undefined, home);
		fault ??= (error as Error).message;
	}
	const tables = isTable(table.workspaces) ? table.workspaces : {};
	const workspaces = Object.entries(tables).map(([name, each]) => {
		const listed =
			isTable(each) && Array.isArray(each.projects) ? each.projects : [];
		const projects = listed.filter(
			(project): project is string => typeof project === "string",
		);
		return {
			name,
			projects,
			paths: projects.map((project) => writtenPath(project, projectsDir, home)),
		};
	});
	return {
		projectsDir,
		found: findRepositories(projectsDir)?.map((name) => ({
			name,
			path: join(projectsDir, name),
		})),
		workspaces,
		...(fault === undefined ? {} : { fault }),
	};
}
