import type {
	AnnotationConfig,
	AnnotationConfigItem,
	AnnotationEvent,
	AnnotationKind,
	AnnotationRegistry,
	AnnotationRegistryItem,
	AnnotationScope,
	CodeBlockAnnotation,
} from "./types";

const ANNOTATION_NAME_RE = /^[A-Za-z_][\w-]*$/;
const DEFAULT_SOURCE = "mdx-text" as const;
const ALL_SCOPES: AnnotationScope[] = ["char", "line", "document"];

const createScopePriorityCounter = () => {
	const counter: Record<AnnotationScope, Record<AnnotationKind, number>> = {
		char: { class: 0, render: 0 },
		line: { class: 0, render: 0 },
		document: { class: 0, render: 0 },
	};

	return counter;
};

const normalizeScopes = (scopes?: AnnotationScope[]) => {
	if (!scopes || scopes.length === 0) return [...ALL_SCOPES];
	const unique = [...new Set(scopes)];

	for (const scope of unique) {
		if (!ALL_SCOPES.includes(scope)) {
			throw new Error(`[createAnnotationRegistry] ERROR : invalid annotation scope "${scope}"`);
		}
	}

	return unique;
};

const normalizeConfigItems = (annotationConfig: AnnotationConfig): AnnotationRegistryItem[] => {
	const items: AnnotationConfigItem[] = annotationConfig.annotations ?? [];

	const seenNames = new Set<string>();
	const normalized: AnnotationRegistryItem[] = [];
	const priorityCounterByScope = createScopePriorityCounter();

	items.forEach((item) => {
		const name = item.name?.trim();
		if (!name || !ANNOTATION_NAME_RE.test(name)) {
			throw new Error(`[createAnnotationRegistry] ERROR : invalid annotation name "${item.name}"`);
		}

		if (seenNames.has(name)) {
			throw new Error(`[createAnnotationRegistry] ERROR : duplicated annotation name "${name}"`);
		}
		seenNames.add(name);

		const scopes = normalizeScopes(item.scopes);
		const source = item.source ?? DEFAULT_SOURCE;
		const primaryScope = scopes[0] ?? "char";
		const priority = priorityCounterByScope[primaryScope][item.kind];
		priorityCounterByScope[primaryScope][item.kind] += 1;

		if (item.kind === "class") {
			if (typeof item.class !== "string") {
				throw new Error(`[createAnnotationRegistry] ERROR : class annotation "${name}" requires class`);
			}

			normalized.push({
				name,
				kind: "class",
				class: item.class,
				source,
				scopes,
				priority,
			});
			return;
		}

		if (typeof item.render !== "string") {
			throw new Error(`[createAnnotationRegistry] ERROR : render annotation "${name}" requires render`);
		}

		normalized.push({
			name,
			kind: "render",
			render: item.render,
			source,
			scopes,
			priority,
		});
	});

	return normalized;
};

export const supportsAnnotationScope = (item: AnnotationRegistryItem, scope: AnnotationScope): boolean => {
	return item.scopes.includes(scope);
};

export const createAnnotationRegistry = (annotationConfig?: AnnotationConfig) => {
	if (!annotationConfig) {
		throw new Error("[createAnnotationRegistry] ERROR : annotationConfig is required");
	}

	const registry: AnnotationRegistry = new Map();
	const items = normalizeConfigItems(annotationConfig);

	for (const item of items) {
		registry.set(item.name, item);
	}

	return registry;
};

export const fromAnnotationsToEvents = (annotations: CodeBlockAnnotation[]) => {
	return annotations
		.flatMap((annotation) => {
			const startEvent: AnnotationEvent = { kind: "open", anno: annotation, pos: annotation.range.start };
			const endEvent: AnnotationEvent = { kind: "close", anno: annotation, pos: annotation.range.end };

			if (startEvent.pos === endEvent.pos) {
				return [];
			}

			return [startEvent, endEvent];
		})
		.sort((a, b) => {
			if (a.pos !== b.pos) {
				return a.pos - b.pos;
			}

			if (a.kind !== b.kind) {
				return a.kind === "close" ? -1 : 1;
			}

			return a.kind === "open" ? a.anno.order - b.anno.order : b.anno.order - a.anno.order;
		});
};

export const __testable__ = {
	normalizeConfigItems,
	supportsAnnotationScope,
	createAnnotationRegistry,
	fromAnnotationsToEvents,
};
