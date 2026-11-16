// Tests derived from the delta spec of `star-without-reloading`
// (openspec/changes/star-without-reloading/specs/board-pages/spec.md): the
// script a project's page carries, run as the page carries it. Each page is
// taken from the server, as served, and fed part by part into a happy-dom
// window, so that the script under test is the one in the markup; `fetch`,
// `sessionStorage`, the page's height and the browser's scroll events are
// under the test's control. Each assertion's classification is in that
// change's test-plan.md.
import { request as httpRequest } from "node:http";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startServer } from "../src/server.js";
import { fullDocument, step, task, workstream } from "./support/document.js";

vi.setConfig({ testTimeout: 20_000 });

// Declared here, not in tests/support/: see test-plan.md, "Missing shared
// arrangement".

// The `Stars` port as star-workstreams' design.md D10 gives it, in memory.
function stubStars(initial: string[] = []) {
	const held = new Map<string, Set<string>>([["/srv/one", new Set(initial)]]);
	return {
		starred: (projectPath: string) => new Set(held.get(projectPath) ?? []),
		set: async (projectPath: string, name: string, on: boolean) => {
			const names = held.get(projectPath) ?? new Set<string>();
			if (on) names.add(name);
			else names.delete(name);
			held.set(projectPath, names);
		},
	};
}

// The `reads` port holding one project. It starts as `initial` gives (read,
// or still being read) and holds `document` once a refresh has run; `reset`
// returns it to `initial` for the next request.
function stubReads(document: unknown, initial: "read" | "reading" = "read") {
	const read = { state: "read", document, readAt: "2026-11-01T22:18:00Z" };
	const start = () => (initial === "read" ? read : { state: "reading" });
	let current: unknown = start();
	return {
		get: () => current,
		quick: async () => undefined,
		refresh: async () => {
			current = read;
		},
		reset: () => {
			current = start();
		},
	};
}

function inactive(name: string, steps: string[]) {
	return { ...workstream(name, steps), active: false };
}

const OLDER = 1_793_000_000;
const NEWER = 1_793_500_000;

// Active `gamma`; inactive `beta` and `alpha`, `beta` the newer and so listed
// first among the other workstreams; and a task in no workstream. Each task
// has a body, so that its row is a block that opens to it.
const mainDocument = fullDocument({
	workstreams: [
		workstream("gamma", ["g-1"]),
		inactive("alpha", ["a-1"]),
		inactive("beta", ["b-1"]),
	],
	tasks: [
		step("g-1", "gamma", { body: "the body of g-1" }),
		step("a-1", "alpha", { last_commit: OLDER, body: "the body of a-1" }),
		step("b-1", "beta", { last_commit: NEWER, body: "the body of b-1" }),
		task("loose-1", { body: "the body of loose-1" }),
	],
});

// No workstreams: its group of tasks in no workstream is rendered open.
const looseDocument = fullDocument({
	tasks: [task("loose-1", { body: "the body of loose-1" })],
});

type Served = {
	port: number;
	stars: ReturnType<typeof stubStars>;
	reads: ReturnType<typeof stubReads>;
};

async function serve(
	document: unknown,
	options: { starred?: string[]; initial?: "read" | "reading" } = {},
): Promise<Served> {
	const reads = stubReads(document, options.initial);
	const stars = stubStars(options.starred);
	const port = await startServer(
		{
			workspaces: [
				{ name: "work", projects: [{ name: "one", path: "/srv/one" }] },
			],
			reads,
			stars,
		} as unknown as Parameters<typeof startServer>[0],
		0,
	);
	return { port, stars, reads };
}

type Answered = { status: number; location: string | undefined; body: string };

// fetch cannot set Host or Sec-Fetch-Site.
function send(
	port: number,
	method: string,
	path: string,
	headers: Record<string, string> = {},
	body?: string,
): Promise<Answered> {
	const sent: Record<string, string> = {
		Host: `127.0.0.1:${port}`,
		...headers,
	};
	if (body !== undefined) {
		sent["Content-Length"] = String(Buffer.byteLength(body));
	}
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				host: "127.0.0.1",
				port,
				method,
				path,
				headers: sent,
				agent: false,
				timeout: 15_000,
			},
			(response) => {
				let text = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					text += chunk;
				});
				response.on("end", () => {
					resolve({
						status: response.statusCode ?? 0,
						location: response.headers.location,
						body: text,
					});
				});
			},
		);
		outgoing.on("timeout", () => {
			outgoing.destroy(new Error(`no answer for ${method} ${path}`));
		});
		outgoing.on("error", reject);
		outgoing.end(body);
	});
}

async function pageHtml(port: number, path = "/work/one"): Promise<string> {
	const answer = await send(port, "GET", path);
	expect(answer.status).toBe(200);
	return answer.body;
}

const phaseTag =
	/<section\b[^>]*\bclass=["'](?:[^"']*\s)?phase(?:\s[^"']*)?["'][^>]*>/g;

// The page as it is sent: what precedes the first part, then each part with
// whatever follows it up to the next.
function split(html: string): { head: string; parts: string[] } {
	const starts = [...html.matchAll(phaseTag)].map((match) => match.index ?? 0);
	expect(starts.length).toBeGreaterThan(0);
	return {
		head: html.slice(0, starts[0]),
		parts: starts.map((start, i) => html.slice(start, starts[i + 1])),
	};
}

// A browser tab: what its session storage holds across the pages loaded in it.
type Tab = { storage: Map<string, string> };

function newTab(): Tab {
	return { storage: new Map() };
}

type Call = {
	url: string;
	init: {
		method?: string;
		body?: unknown;
		redirect?: string;
	};
	resolve: (response: unknown) => void;
	reject: (error: unknown) => void;
};

type Element = ReturnType<Window["document"]["createElement"]>;
type Details = Element & { open: boolean };

// What a browser answers a fetch whose answer is a 303: with `redirect:
// "manual"` an opaque redirect, with "error" a network error, and otherwise
// the page it redirects to, followed.
function redirected(call: Call): void {
	if (call.init.redirect === "manual") {
		call.resolve({
			type: "opaqueredirect",
			status: 0,
			ok: false,
			redirected: false,
			url: "",
			headers: new Headers(),
			text: async () => "",
		});
	} else if (call.init.redirect === "error") {
		call.reject(new TypeError("Failed to fetch"));
	} else {
		call.resolve({
			type: "basic",
			status: 200,
			ok: true,
			redirected: true,
			url: call.url,
			headers: new Headers(),
			text: async () => "<!doctype html>",
		});
	}
}

function answered(call: Call, status: number): void {
	call.resolve({
		type: "basic",
		status,
		ok: status >= 200 && status < 300,
		redirected: false,
		url: call.url,
		headers: new Headers(),
		text: async () => "the star could not be saved",
	});
}

function unreachable(call: Call): void {
	call.reject(new TypeError("Failed to fetch"));
}

type Options = {
	tab?: Tab;
	port: number;
	path?: string;
	// Sends each request on to the board, as the browser would, and answers
	// as the browser would, instead of leaving it to the test.
	forward?: boolean;
	storageThrows?: boolean;
	// The furthest the page can be scrolled, given how many parts have arrived.
	reach?: (arrived: number) => number;
};

const opened: Window[] = [];

async function settle(): Promise<void> {
	for (let i = 0; i < 5; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

// Loads `html` into a window part by part. The first part arrives at once;
// the rest as `arrive` is called.
async function load(html: string, options: Options) {
	const tab = options.tab ?? newTab();
	const path = options.path ?? "/work/one";
	const origin = `http://127.0.0.1:${options.port}`;
	const window = new Window({
		url: `${origin}${path}`,
		settings: {
			enableJavaScriptEvaluation: true,
			suppressInsecureJavaScriptEnvironmentWarning: true,
		},
	});
	opened.push(window);
	const document = window.document;
	const calls: Call[] = [];
	const submits: { form: Element; submitter: Element | null }[] = [];
	const errors: unknown[] = [];
	const forwarded: Promise<unknown>[] = [];
	const { head, parts } = split(html);
	let arrived = 0;
	let seenY = 0;

	const fetch = (url: unknown, init: Call["init"] = {}) =>
		new Promise((resolve, reject) => {
			const call: Call = { url: String(url), init, resolve, reject };
			calls.push(call);
			if (options.forward) {
				const target = new URL(call.url, window.location.href);
				const sending = send(
					options.port,
					init.method ?? "GET",
					target.pathname,
					{
						Origin: origin,
						"Sec-Fetch-Site": "same-origin",
						"Content-Type": "application/x-www-form-urlencoded",
					},
					init.body === undefined ? undefined : String(init.body),
				).then((answer) => {
					if (answer.status === 303) redirected(call);
					else answered(call, answer.status);
				}, reject);
				forwarded.push(sending.catch(() => {}));
			}
		});
	Object.assign(window, { fetch });

	if (options.storageThrows) {
		const refuse = () => {
			throw new Error("SecurityError: storage is not available");
		};
		const storage = {
			getItem: refuse,
			setItem: refuse,
			removeItem: refuse,
			key: refuse,
			clear: refuse,
			get length(): number {
				return refuse();
			},
		};
		Object.defineProperty(window, "sessionStorage", {
			configurable: true,
			get: () => storage,
		});
	} else {
		for (const [key, value] of tab.storage) {
			window.sessionStorage.setItem(key, value);
		}
	}

	// happy-dom lays nothing out, so nothing bounds a scroll: bound it as a page
	// of the given height would.
	const reach = options.reach ?? (() => Number.POSITIVE_INFINITY);
	const bounded =
		(scroll: (x: number, y: number) => void, relative: boolean) =>
		(first?: unknown, second?: unknown) => {
			let y: number;
			if (typeof first === "object" && first !== null) {
				y = Number((first as { top?: number }).top ?? window.scrollY);
			} else {
				y = Number(second ?? 0);
			}
			if (relative) y += window.scrollY;
			scroll(0, Math.max(0, Math.min(y, reach(arrived))));
		};
	// happy-dom's own scrolling methods call one another, so the position is
	// set beneath them.
	const scrollTo = (_x: number, y: number) => {
		document.documentElement.scrollTop = y;
	};
	Object.assign(window, {
		scrollTo: bounded(scrollTo, false),
		scroll: bounded(scrollTo, false),
		scrollBy: bounded(scrollTo, true),
	});

	window.addEventListener("error", (event) => {
		errors.push((event as unknown as { error?: unknown }).error ?? event);
	});

	// A browser fires `scroll`, after the fact, whenever the position changed,
	// whoever changed it; happy-dom does not.
	async function afterwards(): Promise<void> {
		await settle();
		if (window.scrollY !== seenY) {
			seenY = window.scrollY;
			document.dispatchEvent(new window.Event("scroll", { bubbles: true }));
			await settle();
		}
	}

	function phasesShown(): Element[] {
		return [...document.querySelectorAll("section.phase")] as Element[];
	}

	async function arrive(): Promise<void> {
		const part = parts[arrived];
		if (part === undefined) throw new Error("every part has arrived");
		const phases = phasesShown();
		const parent = phases.at(-1)?.parentNode;
		if (parent === undefined || parent === null) {
			throw new Error("no part to follow");
		}
		const template = document.createElement("template");
		template.innerHTML = part;
		// A script parsed into a template does not run; one the document made
		// does, once connected, as a script the parser reaches would.
		for (const old of [...template.content.querySelectorAll("script")]) {
			const fresh = document.createElement("script");
			for (const name of old.getAttributeNames()) {
				fresh.setAttribute(name, old.getAttribute(name) ?? "");
			}
			fresh.textContent = old.textContent;
			old.replaceWith(fresh);
		}
		arrived += 1;
		for (const node of [...template.content.childNodes]) {
			parent.appendChild(node);
		}
		await afterwards();
	}

	async function arriveAll(): Promise<void> {
		while (arrived < parts.length) await arrive();
	}

	// A click as a browser makes it: listeners first, then, unless a listener
	// prevented it, the default. happy-dom toggles a summary's block while the
	// click is still on its way and whether or not it is prevented, so that is
	// undone before any listener above the block hears the click.
	async function click(target: Element): Promise<void> {
		const summary = target.closest("summary");
		const block =
			summary?.parentElement?.tagName === "DETAILS"
				? (summary.parentElement as Details)
				: null;
		const before = block?.open ?? false;
		const undo = () => {
			if (block !== null && block.open !== before) block.open = before;
		};
		const above = block?.parentNode ?? null;
		above?.addEventListener("click", undo);
		const event = new window.MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			composed: true,
		});
		target.dispatchEvent(event);
		above?.removeEventListener("click", undo);
		if (block !== null && !event.defaultPrevented) block.open = !block.open;
		await afterwards();
	}

	function shown(): Element {
		const last = phasesShown().at(-1);
		if (last === undefined) throw new Error("no part has arrived");
		return last;
	}

	function block(key: string, part: Element = shown()): Details {
		const found = part.querySelector(`details[data-key="${key}"]`);
		if (found === null) throw new Error(`no block keyed ${key}`);
		return found as Details;
	}

	function keyed(part: Element = shown()): Map<string, boolean> {
		return new Map(
			[...part.querySelectorAll("details[data-key]")].map((each) => [
				each.getAttribute("data-key") ?? "",
				(each as Details).open,
			]),
		);
	}

	async function toggle(key: string, part: Element = shown()): Promise<void> {
		const summary = block(key, part).querySelector(":scope > summary");
		if (summary === null) throw new Error(`the block ${key} has no summary`);
		await click(summary as Element);
	}

	async function setOpen(key: string, open: boolean): Promise<void> {
		if (block(key).open !== open) await toggle(key);
		expect(block(key).open).toBe(open);
	}

	// The operator scrolls the page, by whatever means.
	async function scroll(y: number): Promise<void> {
		window.scrollTo(0, y);
		await afterwards();
	}

	// Waits until every request sent on to the board is answered, and the page
	// has heard the answer.
	async function responded(): Promise<void> {
		await Promise.all(forwarded);
		await settle();
	}

	async function leave(): Promise<void> {
		window.dispatchEvent(new window.Event("pagehide"));
		await settle();
		if (!options.storageThrows) {
			tab.storage.clear();
			const storage = window.sessionStorage;
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i);
				if (key !== null) tab.storage.set(key, storage.getItem(key) ?? "");
			}
		}
		await window.happyDOM.close();
	}

	document.write(head + (parts[0] ?? ""));
	arrived = 1;
	// happy-dom does not carry a form's submit event to the document, so it is
	// heard on each form the page holds.
	for (const form of [...document.querySelectorAll("form")]) {
		form.addEventListener("submit", (event) => {
			const submitted = event as unknown as { submitter?: Element | null };
			submits.push({
				form: form as Element,
				submitter: submitted.submitter ?? null,
			});
			// Leaving the page is not followed here; that the form was submitted
			// is what is observed.
			event.preventDefault();
		});
	}
	await afterwards();

	return {
		window,
		document,
		tab,
		calls,
		submits,
		responded,
		errors,
		parts: parts.length,
		arrived: () => arrived,
		arrive,
		arriveAll,
		click,
		shown,
		phases: phasesShown,
		block,
		keyed,
		toggle,
		setOpen,
		scroll,
		leave,
	};
}

type Loaded = Awaited<ReturnType<typeof load>>;

function starButton(part: Element, name: string): Element {
	const found = [...part.querySelectorAll("button")].filter(
		(button) =>
			["star", "unstar"].includes(button.getAttribute("name") ?? "") &&
			button.getAttribute("value") === name,
	);
	expect(found).toHaveLength(1);
	return found[0] as Element;
}

// The workstreams in the order the part lists their stars.
function order(part: Element): string[] {
	return [...part.querySelectorAll("button")]
		.filter((button) =>
			["star", "unstar"].includes(button.getAttribute("name") ?? ""),
		)
		.map((button) => button.getAttribute("value") ?? "");
}

type Shown = {
	name: string | null;
	mark: string;
	accessibleName: string;
	pressed: string | null;
};

// What a star button shows: its name, its mark, what it is called (its
// aria-label, or else its text less what is hidden from assistive
// technology) and aria-pressed.
function showing(button: Element): Shown {
	const text = button.textContent ?? "";
	const copy = button.cloneNode(true) as Element;
	for (const hidden of [...copy.querySelectorAll('[aria-hidden="true"]')]) {
		hidden.remove();
	}
	return {
		name: button.getAttribute("name"),
		mark: [...text].filter((c) => c === "★" || c === "☆").join(""),
		accessibleName: (
			button.getAttribute("aria-label") ??
			copy.textContent ??
			""
		).trim(),
		pressed: button.getAttribute("aria-pressed"),
	};
}

// What alpha's button shows on a page rendered with alpha starred or not.
async function rendered(starred: boolean): Promise<Shown> {
	const { port } = await serve(mainDocument, {
		starred: starred ? ["alpha"] : [],
	});
	const view = await load(await pageHtml(port), { port });
	await view.arriveAll();
	return showing(starButton(view.shown(), "alpha"));
}

function openStates(view: Loaded): boolean[] {
	return [...view.document.querySelectorAll("details")].map(
		(each) => (each as Details).open,
	);
}

// The one request sent: a POST of `body` to the project's address, not
// following its redirect.
function expectStarRequest(view: Loaded, body: string): Call {
	expect(view.calls).toHaveLength(1);
	const [call] = view.calls as [Call];
	const target = new URL(call.url, view.window.location.href);
	expect(target.origin).toBe(new URL(view.window.location.href).origin);
	expect(target.pathname).toBe("/work/one");
	expect((call.init.method ?? "GET").toUpperCase()).toBe("POST");
	expect(String(call.init.body)).toBe(body);
	expect(["manual", "error"]).toContain(call.init.redirect);
	return call;
}

afterEach(async () => {
	await Promise.all(opened.splice(0).map((window) => window.happyDOM.close()));
});

describe("A star is set in place", () => {
	describe("Starring in place", () => {
		it("sends one POST of star=alpha, leaves the page as it was, and turns alpha's star over", async () => {
			const { port } = await serve(mainDocument);
			const view = await load(await pageHtml(port), { port });
			await view.arriveAll();
			const document = view.document;
			const href = view.window.location.href;
			await view.setOpen("other", true);
			await view.scroll(250);
			const before = { open: openStates(view), order: order(view.shown()) };
			expect(before.order.indexOf("beta")).toBeLessThan(
				before.order.indexOf("alpha"),
			);
			const asStarred = await rendered(true);

			await view.click(starButton(view.shown(), "alpha"));
			redirected(expectStarRequest(view, "star=alpha"));
			await settle();

			expect(view.calls).toHaveLength(1);
			expect(view.submits).toEqual([]);
			expect(view.window.document).toBe(document);
			expect(view.window.location.href).toBe(href);
			const shown = showing(starButton(view.shown(), "alpha"));
			expect(shown).toMatchObject({
				name: "unstar",
				mark: "★",
				accessibleName: "Unstar alpha",
			});
			expect(shown.pressed).toBe(asStarred.pressed);
			expect(view.block("other").open).toBe(true);
			expect(openStates(view)).toEqual(before.open);
			expect(view.window.scrollY).toBe(250);
			expect(order(view.shown())).toEqual(before.order);
		});
	});

	describe("Unstarring in place", () => {
		it("sends one POST of unstar=alpha, and turns alpha's star back", async () => {
			const { port } = await serve(mainDocument, { starred: ["alpha"] });
			const view = await load(await pageHtml(port), { port });
			await view.arriveAll();
			expect(showing(starButton(view.shown(), "alpha")).name).toBe("unstar");
			const asNotStarred = await rendered(false);

			await view.click(starButton(view.shown(), "alpha"));
			redirected(expectStarRequest(view, "unstar=alpha"));
			await settle();

			const shown = showing(starButton(view.shown(), "alpha"));
			expect(shown).toMatchObject({
				name: "star",
				mark: "☆",
				accessibleName: "Star alpha",
			});
			expect(shown.pressed).toBe(asNotStarred.pressed);
			expect(view.submits).toEqual([]);
		});
	});

	describe("Pressed twice before the answer", () => {
		it("sends one POST, and shows alpha starred once it is answered", async () => {
			const { port } = await serve(mainDocument);
			const view = await load(await pageHtml(port), { port });
			await view.arriveAll();

			await view.click(starButton(view.shown(), "alpha"));
			await view.click(starButton(view.shown(), "alpha"));
			expect(view.calls).toHaveLength(1);
			redirected(expectStarRequest(view, "star=alpha"));
			await settle();

			expect(view.calls).toHaveLength(1);
			expect(view.submits).toEqual([]);
			expect(showing(starButton(view.shown(), "alpha"))).toMatchObject({
				name: "unstar",
				mark: "★",
			});
		});
	});

	describe("A part drawn while the request was on its way", () => {
		it("shows alpha starred in the shown part once answered", async () => {
			const { port } = await serve(mainDocument);
			const view = await load(await pageHtml(port), { port });
			expect(view.parts).toBeGreaterThan(1);

			await view.click(starButton(view.shown(), "alpha"));
			const call = expectStarRequest(view, "star=alpha");
			await view.arriveAll();
			expect(showing(starButton(view.shown(), "alpha")).mark).toBe("☆");
			redirected(call);
			await settle();

			expect(showing(starButton(view.shown(), "alpha"))).toMatchObject({
				name: "unstar",
				mark: "★",
				accessibleName: "Unstar alpha",
			});
		});
	});

	describe("The block stays as it was", () => {
		it("leaves alpha's closed block closed when its star is pressed", async () => {
			const { port } = await serve(mainDocument);
			const view = await load(await pageHtml(port), { port });
			await view.arriveAll();
			await view.setOpen("other", true);
			await view.setOpen("workstream:alpha", false);

			await view.click(starButton(view.shown(), "alpha"));
			expect(view.block("workstream:alpha").open).toBe(false);
			redirected(expectStarRequest(view, "star=alpha"));
			await settle();

			expect(view.block("workstream:alpha").open).toBe(false);
		});
	});

	describe("A star that is refused", () => {
		it.each([
			["answered 500", (call: Call) => answered(call, 500)],
			["that cannot reach the board", unreachable],
		])(
			"submits the form with alpha's button, not turning it over, for a request %s",
			async (_name, answer) => {
				const { port } = await serve(mainDocument);
				const view = await load(await pageHtml(port), { port });
				await view.arriveAll();
				const button = starButton(view.shown(), "alpha");

				await view.click(button);
				answer(expectStarRequest(view, "star=alpha"));
				await settle();

				expect(view.submits).toHaveLength(1);
				const [submitted] = view.submits;
				expect(submitted?.form.getAttribute("id")).toBe("stars");
				expect(submitted?.submitter).toBe(button);
				expect(showing(starButton(view.shown(), "alpha"))).toMatchObject({
					name: "star",
					mark: "☆",
					accessibleName: "Star alpha",
				});
			},
		);
	});

	describe("Sorted on the next load", () => {
		it("keeps beta first after alpha is starred in place, and lists alpha first once loaded again", async () => {
			const { port, stars } = await serve(mainDocument);
			const tab = newTab();
			const view = await load(await pageHtml(port), {
				port,
				tab,
				forward: true,
			});
			await view.arriveAll();
			expect(order(view.shown())).toEqual(["gamma", "beta", "alpha"]);

			await view.click(starButton(view.shown(), "alpha"));
			await view.responded();
			expect(view.calls).toHaveLength(1);
			expect([...stars.starred("/srv/one")]).toEqual(["alpha"]);
			expect(showing(starButton(view.shown(), "alpha")).name).toBe("unstar");
			expect(order(view.shown())).toEqual(["gamma", "beta", "alpha"]);
			await view.leave();

			const again = await load(await pageHtml(port), { port, tab });
			await again.arriveAll();

			expect(order(again.shown())).toEqual(["gamma", "alpha", "beta"]);
		});
	});
});

describe("A project's page reopens what was open", () => {
	describe("Reloaded again before the position was reached", () => {
		it("still remembers the first position, and returns to it", async () => {
			const { port } = await serve(mainDocument);
			const tab = newTab();
			const first = await load(await pageHtml(port), { port, tab });
			await first.arriveAll();
			await first.scroll(600);
			await first.leave();

			// The first part reaches only 100; the page is left before more arrives.
			const short = await load(await pageHtml(port), {
				port,
				tab,
				reach: (arrived) => (arrived <= 1 ? 100 : Number.POSITIVE_INFINITY),
			});
			expect(short.parts).toBeGreaterThan(1);
			expect(short.window.scrollY).toBe(100);
			await short.leave();

			const third = await load(await pageHtml(port), { port, tab });
			await third.arriveAll();

			expect(third.window.scrollY).toBe(600);
		});
	});

	describe("A reload reopens the blocks", () => {
		it("opens the group and alpha in each part, closes everything else, and returns to the position", async () => {
			const { port } = await serve(mainDocument);
			const tab = newTab();
			const first = await load(await pageHtml(port), { port, tab });
			await first.arriveAll();
			const keys = [...first.keyed().keys()];
			expect(keys).toEqual(
				expect.arrayContaining([
					"other",
					"loose",
					"workstream:alpha",
					"workstream:beta",
					"workstream:gamma",
					"task:alpha:a-1",
				]),
			);
			for (const key of keys) {
				await first.setOpen(key, key === "other" || key === "workstream:alpha");
			}
			await first.scroll(300);
			await first.leave();

			const again = await load(await pageHtml(port), { port, tab });
			const seen: Map<string, boolean>[] = [again.keyed()];
			while (again.arrived() < again.parts) {
				await again.arrive();
				seen.push(again.keyed());
			}

			expect(seen.length).toBeGreaterThan(1);
			for (const part of seen) {
				expect(part.size).toBeGreaterThan(0);
				for (const [key, open] of part) {
					expect([key, open]).toEqual([
						key,
						key === "other" || key === "workstream:alpha",
					]);
				}
			}
			expect(again.window.scrollY).toBe(300);
		});
	});

	describe("A block found after the sort moved it", () => {
		it("opens alpha, now listed first", async () => {
			const { port } = await serve(mainDocument);
			const tab = newTab();
			const first = await load(await pageHtml(port), {
				port,
				tab,
				forward: true,
			});
			await first.arriveAll();
			await first.setOpen("other", true);
			await first.setOpen("workstream:alpha", true);
			await first.setOpen("workstream:beta", false);
			await first.click(starButton(first.shown(), "alpha"));
			await first.responded();
			expect(showing(starButton(first.shown(), "alpha")).name).toBe("unstar");
			await first.leave();

			const again = await load(await pageHtml(port), { port, tab });
			await again.arriveAll();

			expect(order(again.shown())).toEqual(["gamma", "alpha", "beta"]);
			expect(again.block("workstream:alpha").open).toBe(true);
			expect(again.block("workstream:beta").open).toBe(false);
		});
	});

	describe("A block closed that is rendered open", () => {
		it("keeps the group of tasks in no workstream closed on the next load", async () => {
			const { port } = await serve(looseDocument);
			const tab = newTab();
			const first = await load(await pageHtml(port), { port, tab });
			await first.arriveAll();
			expect(first.block("loose").open).toBe(true);
			await first.setOpen("loose", false);
			await first.leave();

			const again = await load(await pageHtml(port), { port, tab });
			expect(again.block("loose").open).toBe(false);
			await again.arriveAll();

			expect(again.block("loose").open).toBe(false);
		});
	});

	describe("Changed while the page arrives", () => {
		it("carries alpha closed and beta opened into the next part", async () => {
			const { port } = await serve(mainDocument);
			const tab = newTab();
			const first = await load(await pageHtml(port), { port, tab });
			await first.arriveAll();
			await first.setOpen("other", true);
			await first.setOpen("workstream:alpha", true);
			await first.setOpen("workstream:beta", false);
			await first.leave();

			const again = await load(await pageHtml(port), { port, tab });
			expect(again.parts).toBeGreaterThan(1);
			expect(again.block("workstream:alpha").open).toBe(true);
			await again.toggle("workstream:alpha");
			await again.toggle("workstream:beta");
			expect(again.block("workstream:alpha").open).toBe(false);
			expect(again.block("workstream:beta").open).toBe(true);
			await again.arrive();

			expect(again.block("workstream:alpha").open).toBe(false);
			expect(again.block("workstream:beta").open).toBe(true);
		});
	});

	describe("A first part that holds nothing", () => {
		it("opens alpha in the full part, and returns to the remembered position", async () => {
			const served = await serve(mainDocument, { initial: "reading" });
			const tab = newTab();
			{
				const first = await load(await pageHtml(served.port), {
					port: served.port,
					tab,
				});
				await first.arriveAll();
				await first.setOpen("other", true);
				await first.setOpen("workstream:alpha", true);
				await first.scroll(400);
				await first.leave();
			}
			served.reads.reset();

			const again = await load(await pageHtml(served.port), {
				port: served.port,
				tab,
				reach: (arrived) => (arrived <= 1 ? 50 : Number.POSITIVE_INFINITY),
			});
			expect(again.keyed().size).toBe(0);
			await again.arriveAll();

			expect(again.block("workstream:alpha").open).toBe(true);
			expect(again.window.scrollY).toBe(400);
		});

		it("opens alpha in the full part, and leaves the position where the operator scrolled meanwhile", async () => {
			const served = await serve(mainDocument, { initial: "reading" });
			const tab = newTab();
			{
				const first = await load(await pageHtml(served.port), {
					port: served.port,
					tab,
				});
				await first.arriveAll();
				await first.setOpen("other", true);
				await first.setOpen("workstream:alpha", true);
				await first.scroll(400);
				await first.leave();
			}
			served.reads.reset();

			const again = await load(await pageHtml(served.port), {
				port: served.port,
				tab,
			});
			expect(again.keyed().size).toBe(0);
			await again.scroll(30);
			await again.arriveAll();

			expect(again.block("workstream:alpha").open).toBe(true);
			expect(again.window.scrollY).toBe(30);
		});
	});

	describe("Nothing remembered, a block rendered open", () => {
		it("shows the group of tasks in no workstream open, as rendered, once the full part arrives", async () => {
			const { port } = await serve(looseDocument, { initial: "reading" });
			const view = await load(await pageHtml(port), { port });
			expect(view.keyed().size).toBe(0);

			await view.arriveAll();

			expect(view.block("loose").open).toBe(true);
		});
	});

	describe("Nothing remembered", () => {
		it("shows every block open or closed as rendered, in each part, at the top", async () => {
			const { port } = await serve(mainDocument);
			const html = await pageHtml(port);
			const asRendered = renderedOpen(html);
			const view = await load(html, { port });
			const seen: Map<string, boolean>[] = [view.keyed()];
			while (view.arrived() < view.parts) {
				await view.arrive();
				seen.push(view.keyed());
			}

			for (const [index, part] of seen.entries()) {
				expect(part.size).toBeGreaterThan(0);
				expect(part).toEqual(asRendered[index]);
			}
			expect(view.window.scrollY).toBe(0);
		});
	});

	describe("Storage that cannot be used", () => {
		it("shows the page as rendered after it is left and loaded again, and its stars still work", async () => {
			const { port } = await serve(mainDocument);
			const tab = newTab();
			const html = await pageHtml(port);
			const asRendered = renderedOpen(html);
			const first = await load(html, { port, tab, storageThrows: true });
			await first.arriveAll();
			for (const [key, open] of first.keyed()) {
				await first.setOpen(key, !open);
			}
			await first.scroll(300);
			await first.leave();

			const again = await load(html, { port, tab, storageThrows: true });
			await again.arriveAll();

			expect(again.keyed()).toEqual(asRendered.at(-1));
			expect(again.window.scrollY).toBe(0);
			await again.click(starButton(again.shown(), "alpha"));
			redirected(expectStarRequest(again, "star=alpha"));
			await settle();
			expect(showing(starButton(again.shown(), "alpha"))).toMatchObject({
				name: "unstar",
				mark: "★",
			});
			expect(again.submits).toEqual([]);
		});
	});
});

describe("A page shows what was read for it", () => {
	describe("Only a project's page has a script", () => {
		it("lets the project's script start no read and request no page, through loading, opening a block, scrolling and leaving", async () => {
			const { port } = await serve(mainDocument);
			const tab = newTab();
			const view = await load(await pageHtml(port), { port, tab });
			await view.arriveAll();
			await view.setOpen("other", true);
			await view.scroll(120);
			const href = view.window.location.href;
			const document = view.document;
			await settle();

			expect(view.calls).toEqual([]);
			expect(view.submits).toEqual([]);
			expect(view.window.location.href).toBe(href);
			expect(view.window.document).toBe(document);
			await view.leave();
			expect(view.calls).toEqual([]);
		});
	});
});

// Each part's keyed blocks as the markup renders them, with no script run.
function renderedOpen(html: string): Map<string, boolean>[] {
	const window = new Window({ url: "http://127.0.0.1:1/work/one" });
	opened.push(window);
	window.document.write(html);
	return [...window.document.querySelectorAll("section.phase")].map(
		(part) =>
			new Map(
				[...part.querySelectorAll("details[data-key]")].map((each) => [
					each.getAttribute("data-key") ?? "",
					each.hasAttribute("open"),
				]),
			),
	);
}
