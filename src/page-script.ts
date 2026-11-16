// The one script a project's page carries, embedded as this function's source:
// it sets a star in place, and keeps which blocks are open, and how far the page
// is scrolled, across a reload. It reads nothing and starts no read. It closes
// over nothing from this module, so that its source runs on its own.
export function pageScript(win: Window & typeof globalThis): void {
	const doc = win.document;
	const storeKey = `dev-task-board:view:${win.location.pathname}`;

	// What was remembered when the page was last left in this tab, or null.
	let remembered: { open: Record<string, boolean>; y: number } | null = null;
	try {
		const text = win.sessionStorage.getItem(storeKey);
		const saved = text === null ? null : JSON.parse(text);
		if (
			saved !== null &&
			typeof saved === "object" &&
			typeof saved.open === "object" &&
			saved.open !== null &&
			typeof saved.y === "number"
		) {
			const open: Record<string, boolean> = {};
			for (const [key, value] of Object.entries(saved.open)) {
				if (typeof value === "boolean") open[key] = value;
			}
			remembered = { open, y: saved.y };
		}
	} catch {
		remembered = null;
	}
	try {
		win.history.scrollRestoration = "manual";
	} catch {
		// The browser's own restoring stays; the page still works.
	}

	// Blocks the operator opened or closed since this load began.
	const changed = new Map<string, boolean>();
	// Whether the operator has scrolled, and where the script last scrolled to.
	let scrolled = false;
	let reached: number | null = null;
	// Workstreams whose star request is on its way.
	const pending = new Set<string>();

	const shownPart = (): Element | null => {
		const parts = doc.querySelectorAll("section.phase");
		return parts[parts.length - 1] ?? null;
	};
	const blocksIn = (part: Element): HTMLDetailsElement[] =>
		Array.from(part.querySelectorAll<HTMLDetailsElement>("details[data-key]"));
	const has = (record: Record<string, boolean>, key: string): boolean =>
		Object.hasOwn(record, key);

	const showStar = (button: HTMLButtonElement, on: boolean): void => {
		const name = button.value;
		button.name = on ? "unstar" : "star";
		button.textContent = on ? "★" : "☆";
		button.classList.toggle("on", on);
		button.setAttribute("aria-pressed", String(on));
		button.setAttribute("aria-label", `${on ? "Unstar" : "Star"} ${name}`);
	};

	const setStar = async (button: HTMLButtonElement): Promise<void> => {
		const name = button.value;
		const field = button.name;
		const form = doc.getElementById("stars") as HTMLFormElement | null;
		if (form === null || pending.has(name)) return;
		pending.add(name);
		let set = false;
		try {
			const answer = await win.fetch(form.action, {
				method: "POST",
				body: new URLSearchParams([[field, name]]),
				redirect: "manual",
			});
			set = answer.type === "opaqueredirect" || answer.status === 303;
		} catch {
			set = false;
		}
		pending.delete(name);
		if (!set) {
			form.requestSubmit(button);
			return;
		}
		for (const each of Array.from(
			doc.querySelectorAll<HTMLButtonElement>("button.star"),
		)) {
			if (each.value === name) showStar(each, field === "star");
		}
	};

	doc.addEventListener("click", (event) => {
		const target = event.target as Element | null;
		if (target === null || typeof target.closest !== "function") return;
		const button = target.closest<HTMLButtonElement>("button.star");
		if (button !== null) {
			event.preventDefault();
			void setStar(button);
			return;
		}
		const summary = target.closest("summary");
		const block = summary?.parentElement;
		if (
			summary &&
			block &&
			block.tagName === "DETAILS" &&
			block.firstElementChild === summary
		) {
			const key = block.getAttribute("data-key");
			if (key !== null) {
				changed.set(key, !(block as HTMLDetailsElement).open);
			}
		}
	});

	doc.addEventListener("scroll", () => {
		if (reached === null || win.scrollY !== reached) scrolled = true;
	});

	// Called after each part arrives: sets its blocks as the operator left them,
	// else as remembered, and returns to the remembered position until the
	// operator scrolls.
	(win as unknown as { dtbRestore: () => void }).dtbRestore = () => {
		const part = shownPart();
		if (part === null) return;
		for (const block of blocksIn(part)) {
			const key = block.getAttribute("data-key") ?? "";
			const open = changed.has(key)
				? changed.get(key)
				: remembered !== null && has(remembered.open, key)
					? remembered.open[key]
					: undefined;
			if (open !== undefined && block.open !== open) block.open = open;
		}
		if (remembered !== null && !scrolled) {
			win.scrollTo(0, remembered.y);
			reached = win.scrollY;
		}
	};

	win.addEventListener("pagehide", () => {
		const open: Record<string, boolean> = {};
		if (remembered !== null) Object.assign(open, remembered.open);
		for (const [key, value] of changed) open[key] = value;
		const part = shownPart();
		if (part !== null) {
			for (const block of blocksIn(part)) {
				open[block.getAttribute("data-key") ?? ""] = block.open;
			}
		}
		const y = remembered !== null && !scrolled ? remembered.y : win.scrollY;
		try {
			win.sessionStorage.setItem(storeKey, JSON.stringify({ open, y }));
		} catch {
			// Nothing is remembered; the next load shows as rendered.
		}
	});
}
