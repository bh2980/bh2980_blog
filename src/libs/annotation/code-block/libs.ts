import { ANNOTATION_TYPE_DEFINITION } from "./constants";
import type {
	Annotation,
	AnnotationConfig,
	AnnotationEvent,
	AnnotationRegistry,
	AnnotationType,
} from "./types";

type ResolvedAnnotationTypeDefinition = {
	[K in keyof typeof ANNOTATION_TYPE_DEFINITION]: {
		typeId: (typeof ANNOTATION_TYPE_DEFINITION)[K]["typeId"];
		tag: string;
	};
};

const TAG_FORMAT_RE = /^[A-Za-z][\w-]*$/;

export const resolveAnnotationTypeDefinition = (
	annotationConfig: AnnotationConfig,
): ResolvedAnnotationTypeDefinition => {
	const overrides = annotationConfig.tagOverrides ?? {};
	const resolved: ResolvedAnnotationTypeDefinition = {
		inlineClass: {
			typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
			tag: overrides.inlineClass ?? ANNOTATION_TYPE_DEFINITION.inlineClass.tag,
		},
		inlineWrap: {
			typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
			tag: overrides.inlineWrap ?? ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
		},
		lineClass: {
			typeId: ANNOTATION_TYPE_DEFINITION.lineClass.typeId,
			tag: overrides.lineClass ?? ANNOTATION_TYPE_DEFINITION.lineClass.tag,
		},
		lineWrap: {
			typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
			tag: overrides.lineWrap ?? ANNOTATION_TYPE_DEFINITION.lineWrap.tag,
		},
	};

	const usedTags = new Map<string, AnnotationType>();

	for (const [type, info] of Object.entries(resolved) as [AnnotationType, { typeId: number; tag: string }][]) {
		const tag = info.tag.trim();

		if (!TAG_FORMAT_RE.test(tag)) {
			throw new Error(`[createAnnotationRegistry] ERROR : invalid annotation tag "${info.tag}" for type "${type}"`);
		}

		const existingType = usedTags.get(tag);
		if (existingType && existingType !== type) {
			throw new Error(`[createAnnotationRegistry] ERROR : duplicated annotation tag "${tag}"`);
		}

		usedTags.set(tag, type);
		info.tag = tag;
	}

	return resolved;
};

const getTypePair = <T extends AnnotationType>(type: T, definition: ResolvedAnnotationTypeDefinition) => {
	return { type, ...definition[type] } as { type: T } & ResolvedAnnotationTypeDefinition[T];
};

export const createAnnotationRegistry = (annotationConfig?: AnnotationConfig) => {
	if (!annotationConfig) {
		throw new Error("[createAnnotationRegistry] ERROR : annotationConfig is required");
	}

	const definition = resolveAnnotationTypeDefinition(annotationConfig);
	const registry: AnnotationRegistry = new Map();

	if (annotationConfig.inlineClass) {
		annotationConfig.inlineClass.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("inlineClass", definition), priority: idx });
		});
	}

	if (annotationConfig.inlineWrap) {
		annotationConfig.inlineWrap.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("inlineWrap", definition), priority: idx });
		});
	}

	if (annotationConfig.lineClass) {
		annotationConfig.lineClass.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("lineClass", definition), priority: idx });
		});
	}

	if (annotationConfig.lineWrap) {
		annotationConfig.lineWrap.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("lineWrap", definition), priority: idx });
		});
	}

	return registry;
};

export const fromAnnotationsToEvents = (annotations: Annotation[]) => {
	const event = annotations
		.flatMap((anntation) => {
			const startEvent: AnnotationEvent = { kind: "open", anno: anntation, pos: anntation.range.start };
			const endEvent: AnnotationEvent = { kind: "close", anno: anntation, pos: anntation.range.end };

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
				return a.kind.localeCompare(b.kind);
			}

			if (a.kind === "open" && a.anno.range.end !== b.anno.range.end) {
				return b.anno.range.end - a.anno.range.end;
			}

			if (a.kind === "close" && a.anno.range.start !== b.anno.range.start) {
				return b.anno.range.start - a.anno.range.start;
			}

			if (a.anno.typeId !== b.anno.typeId) {
				return a.anno.typeId - b.anno.typeId;
			}

			return a.anno.order - b.anno.order;
		});

	return event;
};

export const __testable__ = {
	getTypePair,
	createAnnotationRegistry,
	resolveAnnotationTypeDefinition,
	fromAnnotationsToEvents,
};
