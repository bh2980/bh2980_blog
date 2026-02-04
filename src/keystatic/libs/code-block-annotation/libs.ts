import type { Break, Node, Root, Text } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { ANNOTATION_TYPE_DEFINITION } from "./constants";
import type { AnnotationConfig, AnnotationRegistry, AnnotationType } from "./types";

export const isText = (node: Node): node is Text => node.type === "text";
export const isBreak = (node: Node): node is Break => node.type === "break";
export const isMDXJSXTextElement = (node: Node): node is MdxJsxTextElement => node.type === "mdxJsxTextElement";

export const hasChildren = (node: Node | Root): node is Node & { children: Node[] } => "children" in node;

export function getTypePair<T extends AnnotationType>(type: T) {
	return { type, ...ANNOTATION_TYPE_DEFINITION[type] } as { type: T } & (typeof ANNOTATION_TYPE_DEFINITION)[T];
}

export const buildAnnotationRegistry = (annotationConfig?: AnnotationConfig) => {
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
