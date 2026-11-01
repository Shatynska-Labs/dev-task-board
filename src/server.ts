import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Reads } from "./reads.js";
import {
	renderIndex,
	renderNotFound,
	renderOverview,
	renderProject,
} from "./render.js";
import type { Workspace } from "./settings.js";

const HOST = "127.0.0.1";

export type BoardState = {
	workspaces: Workspace[];
	reads: Pick<Reads, "get">;
};

function answer(response: ServerResponse, status: number, html: string): void {
	response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
	response.end(html);
}

function decodedSegments(url: string): string[] | undefined {
	const [path = ""] = url.split("?");
	try {
		return path.split("/").slice(1).map(decodeURIComponent);
	} catch {
		return undefined;
	}
}

function pageFor(url: string, state: BoardState): string | undefined {
	const segments = decodedSegments(url);
	const { workspaces, reads } = state;
	if (segments === undefined || segments.length > 2) {
		return undefined;
	}
	const [first = "", project] = segments;
	if (first === "" && project === undefined) {
		const [only, ...others] = workspaces;
		return only !== undefined && others.length === 0
			? renderOverview(only, reads)
			: renderIndex(workspaces);
	}
	const workspace = workspaces.find(({ name }) => name === first);
	if (workspace === undefined) {
		return undefined;
	}
	if (project === undefined) {
		return renderOverview(workspace, reads);
	}
	return workspace.projects.some(({ name }) => name === project)
		? renderProject(workspace.name, project, reads.get(workspace.name, project))
		: undefined;
}

export function startServer(
	state: BoardState,
	port: number,
	signal?: AbortSignal,
): Promise<number> {
	const server = createServer((request, response) => {
		const { port: bound } = server.address() as AddressInfo;
		const { host } = request.headers;
		if (host !== `127.0.0.1:${bound}` && host !== `localhost:${bound}`) {
			answer(response, 403, renderNotFound());
			return;
		}
		const page =
			request.method === "GET" ? pageFor(request.url ?? "", state) : undefined;
		if (page === undefined) {
			answer(response, 404, renderNotFound());
		} else {
			answer(response, 200, page);
		}
	});
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen({ port, host: HOST, signal }, () => {
			server.off("error", reject);
			resolve((server.address() as AddressInfo).port);
		});
	});
}
