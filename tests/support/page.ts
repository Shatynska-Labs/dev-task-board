// Reading what a rendered page shows, promoted from the tests of
// `show-a-tasks-kind-and-wait`.
import { expect } from "vitest";

export function decode(text: string): string {
	return text
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, decimal: string) =>
			String.fromCodePoint(Number(decimal)),
		)
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

// What a reader sees: inline CSS may carry any of these words as a class.
export function textOf(html: string): string {
	return decode(
		html
			.replace(/<style[\s\S]*?<\/style>/g, " ")
			.replace(/<[^>]*>/g, " ")
			.replace(/\s+/g, " "),
	);
}

export function expectInOrder(text: string, parts: string[]): void {
	const positions = parts.map((part) => text.indexOf(part));
	expect(positions).not.toContain(-1);
	expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The position of `text` as a whole text node, or -1.
export function textNodeAt(html: string, text: string, from = 0): number {
	const pattern = new RegExp(`>\\s*(${escapeRegExp(text)})\\s*<`, "g");
	pattern.lastIndex = from;
	const match = pattern.exec(html);
	if (match === null) return -1;
	return match.index + match[0].indexOf(text);
}

export type Block = { start: number; end: number };

export function blocks(html: string, tag: string): Block[] {
	const found: Block[] = [];
	const open: number[] = [];
	const pattern = new RegExp(`<${tag}\\b|</${tag}>`, "g");
	for (const match of html.matchAll(pattern)) {
		if (match[0] === `</${tag}>`) {
			const start = open.pop();
			if (start !== undefined) {
				found.push({ start, end: match.index + match[0].length });
			}
		} else {
			open.push(match.index);
		}
	}
	return found;
}

// The task's row: the smallest <li> holding its name as a text node.
export function rowOf(html: string, name: string): Block & { html: string } {
	const at = textNodeAt(html, name);
	if (at === -1) throw new Error(`no text node reads ${name}`);
	const [row] = blocks(html, "li")
		.filter((block) => block.start < at && at < block.end)
		.sort((a, b) => a.end - a.start - (b.end - b.start));
	if (row === undefined) throw new Error(`no <li> holds ${name}`);
	return { ...row, html: html.slice(row.start, row.end) };
}

export function rowText(html: string, name: string): string {
	return textOf(rowOf(html, name).html);
}

export type Element = {
	tag: string;
	classes: string[];
	title: string | null;
	style: string;
};

export const VOID = new Set([
	"br",
	"hr",
	"img",
	"input",
	"meta",
	"link",
	"wbr",
]);

export function attribute(attributes: string, name: string): string | null {
	const match = new RegExp(
		`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
		"i",
	).exec(attributes);
	if (match === null) return null;
	return decode(match[1] ?? match[2] ?? "");
}

// The elements open at a position of the page, outermost first.
export function enclosing(html: string, at: number): Element[] {
	const stack: Element[] = [];
	const pattern = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
	for (const match of html.slice(0, at).matchAll(pattern)) {
		const [, closing, rawTag, attributes = ""] = match;
		const tag = (rawTag ?? "").toLowerCase();
		if (closing) {
			const index = stack.map((element) => element.tag).lastIndexOf(tag);
			if (index !== -1) stack.splice(index);
		} else if (!VOID.has(tag) && !attributes.trimEnd().endsWith("/")) {
			stack.push({
				tag,
				classes: (attribute(attributes, "class") ?? "")
					.split(/\s+/)
					.filter(Boolean),
				title: attribute(attributes, "title"),
				style: attribute(attributes, "style") ?? "",
			});
		}
	}
	return stack;
}

export type Compound = { tag: string | null; classes: string[] };

// Selectors of the page's own rules whose declarations hold `property`,
// each as its compounds, outermost first. Selectors with a pseudo-class are
// left out, since they do not hold at rest.
export function selectorsDeclaring(
	html: string,
	property: RegExp,
): Compound[][] {
	const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
		.map((match) => match[1] ?? "")
		.join("\n");
	const selectors: Compound[][] = [];
	for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		if (!property.test(rule[2] ?? "")) continue;
		for (const selector of (rule[1] ?? "").split(",")) {
			if (selector.includes(":") || selector.includes("[")) continue;
			const compounds = selector
				.trim()
				.split(/\s*[>+~]\s*|\s+/)
				.filter(Boolean)
				.map((part) => ({
					tag: /^[a-zA-Z][\w-]*/.exec(part)?.[0].toLowerCase() ?? null,
					classes: [...part.matchAll(/\.([\w-]+)/g)].map((m) => m[1] ?? ""),
				}));
			if (compounds.length > 0) selectors.push(compounds);
		}
	}
	return selectors;
}

export function matches(element: Element, compound: Compound): boolean {
	if (compound.tag === null && compound.classes.length === 0) return false;
	if (compound.tag !== null && compound.tag !== element.tag) return false;
	return compound.classes.every((name) => element.classes.includes(name));
}

// Whether an element open at the position takes a rule the page declares,
// matched with descendant semantics against the elements open there.
export function takesRule(
	stack: Element[],
	selectors: Compound[][],
	inline: RegExp,
): boolean {
	return stack.some((element, index) => {
		if (inline.test(element.style)) return true;
		return selectors.some((compounds) => {
			const subject = compounds[compounds.length - 1];
			if (subject === undefined || !matches(element, subject)) return false;
			let ancestor = index - 1;
			for (let c = compounds.length - 2; c >= 0; c--) {
				const compound = compounds[c];
				if (compound === undefined) return false;
				while (ancestor >= 0) {
					const candidate = stack[ancestor];
					if (candidate !== undefined && matches(candidate, compound)) break;
					ancestor--;
				}
				if (ancestor < 0) return false;
				ancestor--;
			}
			return true;
		});
	});
}

// Whether the text node `text` in the task's row is struck through: inside
// <s>, <del> or <strike>, or inside an element the page's CSS or its own style
// gives `line-through`.
export function struckThrough(
	html: string,
	name: string,
	text: string,
): boolean {
	const row = rowOf(html, name);
	const at = textNodeAt(row.html, text);
	if (at === -1) throw new Error(`the row of ${name} shows no ${text}`);
	const stack = enclosing(html, row.start + at);
	if (stack.some((element) => ["s", "del", "strike"].includes(element.tag))) {
		return true;
	}
	return takesRule(
		stack,
		selectorsDeclaring(html, /line-through/),
		/line-through/,
	);
}

// The titles of the elements enclosing the text node `text` in the row.
export function titlesAround(
	html: string,
	name: string,
	text: string,
): string[] {
	const row = rowOf(html, name);
	const at = textNodeAt(row.html, text);
	if (at === -1) throw new Error(`the row of ${name} shows no ${text}`);
	return enclosing(html, row.start + at)
		.map((element) => element.title)
		.filter((title): title is string => title !== null);
}

export function titlesIn(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<[a-zA-Z][^>]*>/g)]
		.map((match) => attribute(match[0].replace(/^<[\w-]+/, ""), "title"))
		.filter((title): title is string => title !== null);
}

// The row's markup up to and including its name: where a mark on the row, or
// on its name, would be.
export function rowUpToName(html: string, name: string): string {
	const row = rowOf(html, name);
	const at = textNodeAt(row.html, name);
	return row.html.slice(0, at + name.length);
}

// The text a workstream shows before its first step: its name, summary and
// whatever it counts.
export function streamHead(
	html: string,
	stream: string,
	firstStep: string,
): string {
	const text = textOf(html);
	const start = text.indexOf(stream, text.indexOf("Active workstreams"));
	const end = text.indexOf(firstStep, start);
	expect(start).toBeGreaterThan(-1);
	expect(end).toBeGreaterThan(start);
	return text.slice(start, end);
}
