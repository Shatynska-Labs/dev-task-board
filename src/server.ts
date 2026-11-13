import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { Reads } from "./reads.js";
import {
	projectPageEnd,
	projectPageStart,
	quickPart,
	renderIndex,
	renderNotFound,
	renderOverview,
	renderStarFailed,
} from "./render.js";
import type { Workspace } from "./settings.js";
import type { Stars } from "./stars.js";

const HOST = "127.0.0.1";

export type BoardState = {
	workspaces: Workspace[];
	reads: Pick<Reads, "get" | "refresh" | "quick">;
	// Absent, nothing is starred and no star can be kept.
	stars?: Stars;
};

const NO_STARS: Stars = {
	starred: () => new Set(),
	set: async () => {
		throw new Error("this board keeps no stars");
	},
};

const BODY_LIMIT = 4096;

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
	starred: Set<string>,
): Streamed {
	return async (response) => {
		response.writeHead(200, HEADERS);
		response.write(projectPageStart(workspace, project, names));
		let fullEnded = false;
		const full = reads.refresh(workspace, project).then(() => {
			fullEnded = true;
		});
		const quick = reads.quick(workspace, project);
		const document = await Promise.race([quick, full.then(() => undefined)]);
		if (document !== undefined && !fullEnded) {
			response.write(quickPart(document, starred));
		}
		await full;
		response.end(projectPageEnd(reads.get(workspace, project), starred));
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
	const { workspaces, reads, stars = NO_STARS } = state;
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
	const found = workspace.projects.find(({ name }) => name === project);
	if (found === undefined) {
		return undefined;
	}
	return projectPage(
		workspace.name,
		project,
		names,
		reads,
		stars.starred(found.path),
	);
}

// The workspace and project a POST's address names, where it names one.
function projectAt(url: string, workspaces: Workspace[]) {
	const segments = decodedSegments(url);
	if (segments === undefined || segments.length !== 2) {
		return undefined;
	}
	const [first, second] = segments;
	const workspace = workspaces.find(({ name }) => name === first);
	const project = workspace?.projects.find(({ name }) => name === second);
	return workspace && project ? { workspace, project } : undefined;
}

// The body up to the limit, or undefined past it, read to its end either way.
function bodyOf(request: IncomingMessage): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let length = 0;
		request.on("data", (chunk: Buffer) => {
			length += chunk.length;
			if (length <= BODY_LIMIT) {
				chunks.push(chunk);
			}
		});
		request.on("end", () => {
			resolve(
				length > BODY_LIMIT
					? undefined
					: Buffer.concat(chunks).toString("utf8"),
			);
		});
		request.on("error", reject);
	});
}

// A star from the board's own page: the checks run in the order the
// specification gives, the first that fails deciding the answer. It reads
// nothing, checking the workstream against the document held.
async function setStar(
	request: IncomingMessage,
	response: ServerResponse,
	state: BoardState,
): Promise<void> {
	const target = projectAt(request.url ?? "", state.workspaces);
	if (target === undefined) {
		request.resume();
		answer(response, 404, renderNotFound());
		return;
	}
	const { host, origin } = request.headers;
	if (
		request.headers["sec-fetch-site"] !== "same-origin" ||
		origin !== `http://${host}`
	) {
		request.resume();
		answer(response, 403, renderNotFound());
		return;
	}
	const body = await bodyOf(request);
	if (body === undefined) {
		answer(response, 413, renderNotFound());
		return;
	}
	const fields = [...new URLSearchParams(body)];
	const [field] = fields;
	if (
		fields.length !== 1 ||
		field === undefined ||
		(field[0] !== "star" && field[0] !== "unstar")
	) {
		answer(response, 400, renderNotFound());
		return;
	}
	const [action, stream] = field;
	const { workspace, project } = target;
	const held = state.reads.get(workspace.name, project.name);
	const streams =
		held?.state === "read"
			? ((held.document.workstreams as { name: string }[] | undefined) ?? [])
			: [];
	if (!streams.some(({ name }) => name === stream)) {
		answer(response, 404, renderNotFound());
		return;
	}
	try {
		await (state.stars ?? NO_STARS).set(
			project.path,
			stream,
			action === "star",
		);
	} catch (error) {
		answer(
			response,
			500,
			renderStarFailed(
				workspace.name,
				project.name,
				error instanceof Error ? error.message : String(error),
			),
		);
		return;
	}
	const address = [workspace.name, project.name]
		.map(encodeURIComponent)
		.join("/");
	response.writeHead(303, {
		...HEADERS,
		location: `/${address}#${encodeURIComponent(stream)}`,
	});
	response.end();
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
		if (request.method === "POST") {
			await setStar(request, response, state);
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
