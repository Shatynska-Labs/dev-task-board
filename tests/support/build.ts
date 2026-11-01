import { execFileSync } from "node:child_process";

export function setup(): void {
	execFileSync("npm", ["run", "--silent", "build"], { stdio: "inherit" });
}
