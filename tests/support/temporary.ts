import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directories: string[] = [];

export function temporaryDirectory(): string {
	const directory = realpathSync(
		mkdtempSync(join(tmpdir(), "dev-task-board-")),
	);
	directories.push(directory);
	return directory;
}

export function removeTemporaryDirectories(): void {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
}
