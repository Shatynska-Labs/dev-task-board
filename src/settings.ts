import { basename, isAbsolute, join, resolve } from "node:path";
import { parse, TomlError } from "smol-toml";

export type Project = { name: string; path: string };
export type Workspace = {
	name: string;
	projects: Project[];
	githubAccount?: string;
};
export type Settings = { workspaces: Workspace[]; port?: number };
export type SettingsOptions = {
	home: string;
	isDirectory: (path: string) => boolean;
};

// Where names relative to the projects folder are resolved from.
type Resolving = SettingsOptions & { projectsDir: string };

export class SettingsError extends Error {}

const UNUSABLE_NAMES = new Set(["", ".", "..", "api", "settings"]);

export const DEFAULT_PROJECTS_DIR = "~/projects";

function isTable(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function settingsPath(
	env: Record<string, string | undefined>,
	home: string,
): string {
	const base = env.XDG_CONFIG_HOME || join(home, ".config");
	return join(base, "dev-task-board", "config.toml");
}

function parseToml(text: string): Record<string, unknown> {
	try {
		return parse(text);
	} catch (error) {
		if (error instanceof TomlError) {
			throw new SettingsError(`not valid TOML: ${error.message}`);
		}
		throw error;
	}
}

function expandHome(written: string, home: string): string {
	return written.startsWith("~/") ? join(home, written.slice(2)) : written;
}

// A name relative to the projects folder: no leading / or ~, and no empty,
// . or .. segment, so it stays inside the folder.
function isFolderName(written: string): boolean {
	return (
		!written.startsWith("/") &&
		!written.startsWith("~") &&
		written
			.split("/")
			.every((segment) => segment !== "" && segment !== "." && segment !== "..")
	);
}

// Where a project as written lies, before any check that it is there.
export function writtenPath(
	written: string,
	projectsDir: string,
	home: string,
): string {
	return resolve(
		isFolderName(written)
			? join(projectsDir, written)
			: written.startsWith("~/")
				? join(home, written.slice(2))
				: written,
	);
}

function resolvePath(
	written: string,
	workspace: string,
	options: Resolving,
): string {
	const expanded = isFolderName(written)
		? join(options.projectsDir, written)
		: expandHome(written, options.home);
	if (!isAbsolute(expanded)) {
		throw new SettingsError(
			`workspace ${workspace}: ${written} is not an absolute path, one beginning ~/, or a name in the projects folder`,
		);
	}
	const path = resolve(expanded);
	if (basename(path) === "") {
		throw new SettingsError(
			`workspace ${workspace}: ${written} has no directory name to address it by`,
		);
	}
	if (!options.isDirectory(path)) {
		throw new SettingsError(
			`workspace ${workspace}: ${written} is not a directory`,
		);
	}
	return path;
}

function parseWorkspace(
	name: string,
	table: unknown,
	options: Resolving,
): Workspace {
	if (UNUSABLE_NAMES.has(name) || name.includes("/")) {
		throw new SettingsError(`the name "${name}" cannot be a workspace's`);
	}
	if (!isTable(table)) {
		throw new SettingsError(`workspace ${name} is not a table`);
	}
	const { projects, github_account: githubAccount } = table;
	if (
		"github_account" in table &&
		(typeof githubAccount !== "string" || githubAccount === "")
	) {
		throw new SettingsError(
			`workspace ${name}: github_account must be a non-empty string`,
		);
	}
	if (
		!Array.isArray(projects) ||
		!projects.every((project) => typeof project === "string")
	) {
		throw new SettingsError(
			`workspace ${name}: projects must be a list of paths or names`,
		);
	}
	const paths = projects.map((path) => resolvePath(path, name, options));
	const named = new Set<string>();
	for (const path of paths) {
		const project = basename(path);
		if (named.has(project)) {
			throw new SettingsError(
				`workspace ${name}: two projects are named ${project}`,
			);
		}
		named.add(project);
	}
	return {
		name,
		projects: paths.map((path) => ({ name: basename(path), path })),
		...(typeof githubAccount === "string" ? { githubAccount } : {}),
	};
}

export const LOWEST_PORT = 1024;
export const HIGHEST_PORT = 65535;

export function isUsablePort(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= LOWEST_PORT &&
		value <= HIGHEST_PORT
	);
}

// The projects folder as written, `~/projects` where absent.
export function projectsDirOf(value: unknown, home: string): string {
	if (value === undefined) {
		return expandHome(DEFAULT_PROJECTS_DIR, home);
	}
	if (
		typeof value !== "string" ||
		!(value.startsWith("/") || value.startsWith("~/"))
	) {
		throw new SettingsError("projects_dir is not a path beginning / or ~/");
	}
	return resolve(expandHome(value, home));
}

export function parseSettings(
	text: string,
	options: SettingsOptions,
): Settings {
	const { workspaces = {}, port, projects_dir: projectsDir } = parseToml(text);
	if (port !== undefined && !isUsablePort(port)) {
		throw new SettingsError(
			`port is not a whole number from ${LOWEST_PORT} to ${HIGHEST_PORT}`,
		);
	}
	const resolving = {
		...options,
		projectsDir: projectsDirOf(projectsDir, options.home),
	};
	if (!isTable(workspaces)) {
		throw new SettingsError("workspaces is not a table");
	}
	return {
		workspaces: Object.entries(workspaces).map(([name, table]) =>
			parseWorkspace(name, table, resolving),
		),
		...(port === undefined ? {} : { port }),
	};
}
