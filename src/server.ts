import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Reads } from "./reads.js";
import {
	projectPageEnd,
	projectPageStart,
	quickPart,
	renderIndex,
	renderNotFound,
	renderOverview,
} from "./render.js";
import type { Workspace } from "./settings.js";

const HOST = "127.0.0.1";

export type BoardState = {
	workspaces: Workspace[];
	reads: Pick<Reads, "get" | "refresh"> & Partial<Pick<Reads, "quick">>;
};

const HEADERS = {
	"content-type": "text/html; charset=utf-8",
	"cache-control": "no-store",
};

function answer(response: ServerResponse, status: number, html: string): void {
	response.writeHead(status, HEADERS);
	response.end(html);
}

// A page sent in parts: a function that writes them as its reads end.
type Streamed = (response: ServerResponse) => Promise<void>;

function projectPage(
	workspace: string,
	project: string,
	names: string[],
	reads: BoardState["reads"],
): Streamed {
	return async (response) => {
		response.writeHead(200, HEADERS);
		response.write(projectPageStart(workspace, project, names));
		let fullEnded = false;
		const full = reads.refresh(workspace, project).then(() => {
			fullEnded = true;
		});
		const quick = reads.quick?.(workspace, project);
		if (quick !== undefined) {
			const document = await Promise.race([quick, full.then(() => undefined)]);
			if (document !== undefined && !fullEnded) {
				response.write(quickPart(document));
			}
		}
		await full;
		response.end(projectPageEnd(reads.get(workspace, project)));
	};
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
): Promise<string | Streamed | undefined> {
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
		return renderOverview(only, reads, names);
	}
	const workspace = workspaces.find(({ name }) => name === first);
	if (workspace === undefined) {
		return undefined;
	}
	if (project === undefined) {
		return renderOverview(workspace, reads, names);
	}
	if (!workspace.projects.some(({ name }) => name === project)) {
		return undefined;
	}
	return projectPage(workspace.name, project, names, reads);
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
		} else if (typeof page === "string") {
			answer(response, 200, page);
		} else {
			await page(response);
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
