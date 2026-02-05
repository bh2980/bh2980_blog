import { parse } from "acorn";
import type { Break, Node, PhrasingContent, Root, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxAttributeValueExpression, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { ANNOTATION_TYPE_DEFINITION } from "./constants";
import type {
	Annotation,
	AnnotationAttr,
	AnnotationConfig,
	AnnotationEvent,
	AnnotationRegistry,
	AnnotationType,
} from "./types";

export const hasChildren = (node: Node | Root): node is Node & { children: Node[] } => "children" in node;

export function getTypePair<T extends AnnotationType>(type: T) {
	return { type, ...ANNOTATION_TYPE_DEFINITION[type] } as { type: T } & (typeof ANNOTATION_TYPE_DEFINITION)[T];
}

export const createAnnotationRegistry = (annotationConfig?: AnnotationConfig) => {
	if (!annotationConfig) {
		throw new Error("[buildAnnotationRegistry] ERROR : annotationConfig is required");
	}

	const registry: AnnotationRegistry = new Map();

	if (annotationConfig.inlineClass) {
		annotationConfig.inlineClass.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("inlineClass"), priority: idx });
		});
	}

	if (annotationConfig.inlineWrap) {
		annotationConfig.inlineWrap.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("inlineWrap"), priority: idx });
		});
	}

	if (annotationConfig.lineClass) {
		annotationConfig.lineClass.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("lineClass"), priority: idx });
		});
	}

	if (annotationConfig.lineWrap) {
		annotationConfig.lineWrap.forEach((d, idx) => {
			registry.set(d.name, { ...d, ...getTypePair("lineWrap"), priority: idx });
		});
	}

	return registry;
};

export const isText = (node: Node): node is Text => node.type === "text";
export const isBreak = (node: Node): node is Break => node.type === "break";
export const isMDXJSXTextElement = (node: Node): node is MdxJsxTextElement => node.type === "mdxJsxTextElement";

export const createBreakNode = (): Break => ({
	type: "break",
});

export const createTextNode = (value: string): Text => ({
	type: "text",
	value,
});

export const createMdastNode = (name: string, children: PhrasingContent[] = []) =>
	({ type: name, children }) as PhrasingContent;

const createMdxJsxAttribute = (name: string, value: any): MdxJsxAttribute => ({
	type: "mdxJsxAttribute",
	name,
	value,
});

export const createMdxJsxTextElementNode = (
	name: string,
	attributes: AnnotationAttr[] = [],
	children: PhrasingContent[] = [],
): MdxJsxTextElement => {
	return {
		type: "mdxJsxTextElement",
		name,
		attributes: attributes.map((attr) => createMdxJsxAttribute(attr.name, attr.value)),
		children,
	};
};

export const createMdxJsxAttributeValueExpression = (value: unknown): MdxJsxAttributeValueExpression => {
	const json = JSON.stringify(value);

	const program = parse(`(${json})`, {
		ecmaVersion: "latest",
		sourceType: "module",
	});

	const firstStmt = program.body[0];
	if (!firstStmt || firstStmt.type !== "ExpressionStatement") {
		throw new Error("Failed to parse expression: not an ExpressionStatement");
	}

	const expression = firstStmt.expression;

	return {
		type: "mdxJsxAttributeValueExpression",
		value: json,
		data: {
			estree: {
				type: "Program",
				sourceType: "module",
				body: [
					{
						type: "ExpressionStatement",
						expression,
					},
				] as any,
			},
		},
	};
};

export const createEvents = (annotations: Annotation[]) => {
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
