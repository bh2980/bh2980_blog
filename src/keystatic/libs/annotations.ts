import type { Break, Node, Root, Text } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";
import type { ComponentType } from "react";
import { SKIP, visit } from "unist-util-visit";
import { Tooltip_unstable } from "@/components/mdx/tooltip";
import { EDITOR_CODE_BLOCK_NAME } from "../fields/mdx/components/code-block";

type AnnotationType = "dec" | "line" | "mark" | "block";

export interface Decoration {
	name: string;
	class: string;
	type?: "dec";
}

export interface Line {
	name: string;
	class: string;
	type?: "line";
}

export interface Mark<TData = unknown> {
	name: string;
	Component: ComponentType<{ data: TData; children: React.ReactNode }>;
	type?: "mark";
}

export interface Block<TData = unknown> {
	name: string;
	Component: ComponentType<{ data: TData; children: React.ReactNode }>;
	type?: "block";
}

export type AnnotationSpec = Decoration | Line | Mark | Block;

export interface AnnotationConfig {
	decoration?: Decoration[];
	line?: Line[];
	mark?: Mark<any>[];
	block?: Block<any>[];
}

const isText = (node: Node): node is Text => node.type === "text";
const isBreak = (node: Node): node is Break => node.type === "break";
const isMDXJSXTextElement = (node: Node): node is MdxJsxTextElement => node.type === "mdxJsxTextElement";

export const hasChildren = (node: Node | Root): node is Node & { children: Node[] } => "children" in node;

interface Annotation {
	type: AnnotationType;
	nodeType: string;
	name: string;
	start: number;
	end: number;
	attributes?: MdxJsxTextElement["attributes"];
}

let annotationHelperSingleton: { annotationMap: Map<string, AnnotationSpec>; isAnnotation: (node: Node) => boolean };

const buildAnnotationHelper = (annotationConfig?: AnnotationConfig) => {
	if (annotationHelperSingleton) {
		return annotationHelperSingleton;
	}

	if (!annotationConfig) {
		throw new Error("[buildAnnotationHelper] ERROR : annotationConfig is required");
	}

	const annotationMap = new Map<string, AnnotationSpec>();

	if (annotationConfig.decoration) {
		for (const d of annotationConfig.decoration) {
			annotationMap.set(d.name, { ...d, type: "dec" });
		}
	}
	if (annotationConfig.line) {
		for (const d of annotationConfig.line) {
			annotationMap.set(d.name, { ...d, type: "line" });
		}
	}
	if (annotationConfig.mark) {
		for (const d of annotationConfig.mark) {
			annotationMap.set(d.name, { ...d, type: "mark" });
		}
	}
	if (annotationConfig.block) {
		for (const d of annotationConfig.block) {
			annotationMap.set(d.name, { ...d, type: "block" });
		}
	}

	const isAnnotation = (node: Node) => {
		if (isMDXJSXTextElement(node)) {
			return annotationMap.has(node.name ?? "");
		}

		return annotationMap.has(node.type);
	};

	annotationHelperSingleton = { annotationMap, isAnnotation };

	return { annotationMap, isAnnotation };
};

const extractAnnotationsFromAst = (node: Node, annotationConfig: AnnotationConfig) => {
	const helper = buildAnnotationHelper(annotationConfig);

	if (!helper) {
		return;
	}

	const { isAnnotation, annotationMap } = helper;

	const annotations: Annotation[] = [];
	let pureCode = "";

	function recursiveBuildAnnotationInfo(node: Node) {
		if (isText(node)) {
			pureCode += node.value;
			return;
		}

		if (isBreak(node)) {
			pureCode += "\n";

			return;
		}

		if (hasChildren(node)) {
			const start = pureCode.length;

			for (const child of node.children) {
				recursiveBuildAnnotationInfo(child);
			}

			const end = pureCode.length;
			const nodeType = node.type;

			if (!isAnnotation(node)) {
				return;
			}

			const annotationKey = (isMDXJSXTextElement(node) ? node.name : nodeType) ?? "";
			const type = annotationMap.get(annotationKey)?.type;
			if (!type) {
				return;
			}

			// TODO : 추후 block이 들어올 경우 isMDXJSXFlowElement 대응해야함.
			if (isMDXJSXTextElement(node)) {
				if (!node.name) {
					return;
				}

				const annoataion = {
					type,
					nodeType,
					name: node.name,
					start,
					end,
					// TODO : [WARNING] attributes가 원소가 1개인 배열로 들어오는데 [0]을 해도 상관 없는지 확인할 것
					attributes: node.attributes,
				};

				annotations.push(annoataion);
			} else {
				const annoataion = {
					type,
					nodeType,
					name: nodeType,
					start,
					end,
				};

				annotations.push(annoataion);
			}
		}
	}

	recursiveBuildAnnotationInfo(node);

	const sortedAnnotations = annotations.sort((a, b) => {
		if (a.start !== b.start) return a.start - b.start;
		if (a.end !== b.end) return a.end - b.end;
		return 0;
	});

	return { code: pureCode, annotations: sortedAnnotations };
};

const injectAnnotationsIntoCode = (code: string, lang: string, annotations: Annotation[]) => {};

export function walkOnlyInsideCodeblock(mdxAst: Root, annotationConfig: AnnotationConfig) {
	visit(mdxAst, "mdxJsxFlowElement", (node) => {
		if (node.name !== EDITOR_CODE_BLOCK_NAME) return;

		const result = extractAnnotationsFromAst(node, annotationConfig);
		if (!result) return;

		const { code: pureCode, annotations } = result;

		console.log(pureCode);
		console.log(annotations);

		return SKIP;
	});
}

export const annotationConfig: AnnotationConfig = {
	decoration: [
		{
			name: "strong",
			class: "font-bold",
		},
		{
			name: "emphasis",
			class: "italic",
		},
		{
			name: "delete",
			class: "line-through",
		},
		{
			name: "u",
			class: "underline",
		},
	],
	mark: [
		{
			name: "Tooltip",
			Component: Tooltip_unstable,
		},
	],
	line: [],
	block: [],
};
