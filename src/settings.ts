import { basename, isAbsolute, join, resolve } from "node:path";
import { parse, TomlError } from "smol-toml";

export type Project = { name: string; path: string };
export type Workspace = { name: string; projects: Project[] };
export type SettingsOptions = {
	home: string;
	isDirectory: (path: string) => boolean;
};

export class SettingsError extends Error {}

const UNUSABLE_NAMES = new Set(["", ".", "..", "api"]);

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

function resolvePath(
	written: string,
	workspace: string,
	options: SettingsOptions,
): string {
	const expanded = written.startsWith("~/")
		? join(options.home, written.slice(2))
		: written;
	if (!isAbsolute(expanded)) {
		throw new SettingsError(
			`workspace ${workspace}: ${written} is not an absolute path or one beginning ~/`,
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
	options: SettingsOptions,
): Workspace {
	if (UNUSABLE_NAMES.has(name) || name.includes("/")) {
		throw new SettingsError(`the name "${name}" cannot be a workspace's`);
	}
	if (!isTable(table)) {
		throw new SettingsError(`workspace ${name} is not a table`);
	}
	if ("github_account" in table) {
		throw new SettingsError(
			`workspace ${name}: github_account is not yet supported`,
		);
	}
	const { projects } = table;
	if (
		!Array.isArray(projects) ||
		projects.length === 0 ||
		!projects.every((project) => typeof project === "string")
	) {
		throw new SettingsError(
			`workspace ${name}: projects must be a non-empty list of paths`,
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
	};
}

export function parseSettings(
	text: string,
	options: SettingsOptions,
): Workspace[] {
	const { workspaces } = parseToml(text);
	if (!isTable(workspaces) || Object.keys(workspaces).length === 0) {
		throw new SettingsError("it names no workspace");
	}
	return Object.entries(workspaces).map(([name, table]) =>
		parseWorkspace(name, table, options),
	);
}
