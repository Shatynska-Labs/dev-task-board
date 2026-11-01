import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

export function isolatedEnvironment(root: string): NodeJS.ProcessEnv {
	const home = join(root, "home");
	const stubs = join(root, "stubs");
	mkdirSync(home, { recursive: true });
	mkdirSync(stubs, { recursive: true });
	writeFileSync(
		join(stubs, "gh"),
		"#!/bin/sh\necho 'gh stub: not available' >&2\nexit 1\n",
		{ mode: 0o755 },
	);
	const inherited = Object.entries(process.env).filter(
		([name]) => !name.startsWith("GIT_"),
	);
	return {
		...Object.fromEntries(inherited),
		HOME: home,
		XDG_CONFIG_HOME: join(home, ".config"),
		PATH: `${stubs}${delimiter}${process.env.PATH ?? ""}`,
	};
}

export function git(
	cwd: string,
	env: NodeJS.ProcessEnv,
	...args: string[]
): string {
	return execFileSync("git", args, {
		cwd,
		env,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

export function buildFixtureRepository(
	directory: string,
	env: NodeJS.ProcessEnv,
	committedFile: string,
): void {
	mkdirSync(dirname(join(directory, committedFile)), { recursive: true });
	git(dirname(directory), env, "init", "--quiet", "-b", "main", directory);
	writeFileSync(join(directory, committedFile), "fixture\n");
	git(directory, env, "add", ".");
	git(
		directory,
		env,
		"-c",
		"user.name=Fixture",
		"-c",
		"user.email=fixture@example.invalid",
		"-c",
		"commit.gpgsign=false",
		"commit",
		"--quiet",
		"-m",
		"fixture",
	);
}
