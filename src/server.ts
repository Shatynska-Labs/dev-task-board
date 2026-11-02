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
	reads: Pick<Reads, "get" | "refresh">;
};

function answer(response: ServerResponse, status: number, html: string): void {
	response.writeHead(status, {
		"content-type": "text/html; charset=utf-8",
		"cache-control": "no-store",
	});
	response.end(html);
}

function decodedSegments(url: string): string[] | undefined {
	const [path = ""] = url.split("?");
	if (!path.startsWith("/")) {
		return undefined;
	}
	try {
		return path.split("/").slice(1).map(decodeURIComponent);
	} catch {
		return undefined;
	}
}

// A page's request starts reads, so a page on another site must not be able to
// make one. The Host check stops only DNS rebinding.
function fromAnotherSite(site: string | string[] | undefined): boolean {
	return site === "cross-site" || site === "same-site";
}

async function pageFor(
	url: string,
	state: BoardState,
): Promise<string | undefined> {
	const segments = decodedSegments(url);
	const { workspaces, reads } = state;
	const names = workspaces.map(({ name }) => name);
	if (segments === undefined || segments.length > 2) {
		return undefined;
	}
	const [first = "", project] = segments;
	if (first === "" && project === undefined) {
		const [only, ...others] = workspaces;
		if (only === undefined || others.length > 0) {
			return renderIndex(workspaces);
		}
		await reads.refresh(only.name);
		return renderOverview(only, reads, names);
	}
	const workspace = workspaces.find(({ name }) => name === first);
	if (workspace === undefined) {
		return undefined;
	}
	if (project === undefined) {
		await reads.refresh(workspace.name);
		return renderOverview(workspace, reads, names);
	}
	if (!workspace.projects.some(({ name }) => name === project)) {
		return undefined;
	}
	await reads.refresh(workspace.name, project);
	return renderProject(
		workspace.name,
		project,
		reads.get(workspace.name, project),
		names,
	);
}

export function startServer(
	state: BoardState,
	port: number,
	signal?: AbortSignal,
): Promise<number> {
	let bound = port;
	const server = createServer(async (request, response) => {
		const { host } = request.headers;
		if (
			(host !== `127.0.0.1:${bound}` && host !== `localhost:${bound}`) ||
			fromAnotherSite(request.headers["sec-fetch-site"])
		) {
			answer(response, 403, renderNotFound());
			return;
		}
		const page =
			request.method === "GET"
				? await pageFor(request.url ?? "", state)
				: undefined;
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
			bound = (server.address() as AddressInfo).port;
			resolve(bound);
		});
	});
}
