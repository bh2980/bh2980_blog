import type { Break, Code, Node, Root, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { EDITOR_CODE_BLOCK_NAME, EDITOR_LANG_OPTIONS } from "../fields/mdx/components/code-block";
import type { EditorCodeLang } from "../fields/mdx/components/code-block/types";
import { EDITOR_MERMAID_NAME } from "../fields/mdx/components/mermaid";

export type AnnotationSource = "mdast" | "mdx-text" | "mdx-flow";

export type AnnotationTag = "dec" | "line" | "mark" | "block";

export enum AnnotationType {
	BLOCK = 1,
	LINE = 2,
	MARK = 3,
	DECORATION = 4,
}

export const ANNOTATION_TAG_PREFIX = "@";

export const ANNOTATION_TAG_BY_TYPE: Record<AnnotationType, AnnotationTag> = {
	[AnnotationType.DECORATION]: "dec",
	[AnnotationType.LINE]: "line",
	[AnnotationType.MARK]: "mark",
	[AnnotationType.BLOCK]: "block",
};

export const ANNOTATION_TYPE_BY_TAG: Record<AnnotationTag, AnnotationType> = {
	dec: AnnotationType.DECORATION,
	line: AnnotationType.LINE,
	mark: AnnotationType.MARK,
	block: AnnotationType.BLOCK,
};

export type AnnotationSpecBase = {
	name: string;
	source: AnnotationSource;
};

export type ClassAnnotationSpec = AnnotationSpecBase & {
	class: string;
};

export type RenderAnnotationSpec = AnnotationSpecBase & {
	render: string;
};

export type AnnotationSpec = ClassAnnotationSpec | RenderAnnotationSpec;

export interface AnnotationConfig {
	decoration?: ClassAnnotationSpec[];
	line?: ClassAnnotationSpec[];
	mark?: RenderAnnotationSpec[];
	block?: RenderAnnotationSpec[];
}

export type AnnotationRegistryItem = AnnotationSpec & {
	type: AnnotationType;
	tag: AnnotationTag;
	priority: number;
};

export type AnnotationRegistry = Map<string, AnnotationRegistryItem>;

export type AbsRange = {
	start: number;
	end: number;
};

export type AnnotationAttr = {
	name: string;
	value: any;
};

export type ExtractedAnnotation = {
	type: AnnotationType;
	name: string;
	range: AbsRange;
	attributes?: AnnotationAttr[];
};

interface LineMeta {
	value: string;
	annotations: ExtractedAnnotation[];
	range: AbsRange;
}

const isText = (node: Node): node is Text => node.type === "text";
const isBreak = (node: Node): node is Break => node.type === "break";
const isMDXJSXTextElement = (node: Node): node is MdxJsxTextElement => node.type === "mdxJsxTextElement";

export const hasChildren = (node: Node | Root): node is Node & { children: Node[] } => "children" in node;

// TODO : 웹 브라우저에서 저장 시와 편집 시 다른 config를 사용하는데 싱글톤으로 하니까 덮어씌워서 정상 동작이 안됨.
// 재사용하면서 환경별 config에 따라 변경되는 좋은 방법 생각하기
export const buildAnnotationHelper = (annotationConfig?: AnnotationConfig) => {
	if (!annotationConfig) {
		throw new Error("[buildAnnotationHelper] ERROR : annotationConfig is required");
	}

	const annotationMap = new Map<string, AnnotationRegistryItem>();

	if (annotationConfig.decoration) {
		annotationConfig.decoration.forEach((d, idx) => {
			annotationMap.set(d.name, { ...d, type: AnnotationType.DECORATION, tag: "dec", priority: idx });
		});
	}
	if (annotationConfig.mark) {
		annotationConfig.mark.forEach((d, idx) => {
			annotationMap.set(d.name, { ...d, type: AnnotationType.MARK, tag: "mark", priority: idx });
		});
	}
	if (annotationConfig.line) {
		annotationConfig.line.forEach((d, idx) => {
			annotationMap.set(d.name, { ...d, type: AnnotationType.LINE, tag: "line", priority: idx });
		});
	}
	if (annotationConfig.block) {
		annotationConfig.block.forEach((d, idx) => {
			annotationMap.set(d.name, { ...d, type: AnnotationType.BLOCK, tag: "block", priority: idx });
		});
	}

	const isAnnotationNode = (node: Node) => {
		if (isMDXJSXTextElement(node)) {
			return annotationMap.has(node.name ?? "");
		}

		return annotationMap.has(node.type);
	};

	return { annoRegistry: annotationMap, isAnnotationNode };
};

export const extractAnnotationsFromAst = (node: Node, annotationConfig: AnnotationConfig) => {
	const helper = buildAnnotationHelper(annotationConfig);

	if (!helper) {
		return;
	}

	const { isAnnotationNode, annoRegistry } = helper;

	const annotations: ExtractedAnnotation[] = [];
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

			if (!isAnnotationNode(node)) {
				return;
			}

			const annotationKey = (isMDXJSXTextElement(node) ? node.name : nodeType) ?? "";
			const anno = annoRegistry.get(annotationKey);
			if (!anno) {
				return;
			}

			// TODO : 추후 block이 들어올 경우 isMDXJSXFlowElement 대응해야함.
			if (isMDXJSXTextElement(node)) {
				if (!node.name) {
					return;
				}

				const annoataion = {
					...anno,
					type: anno.type,
					name: node.name,
					range: { start, end },
					// TODO : 추후 MdxJsxExpressionAttribute 대응(fields.object 쓸 경우에 들어올 것으로 보임. name이 없고 value만 존재
					attributes: node.attributes
						.filter(
							(attr): attr is MdxJsxAttribute => attr.type === "mdxJsxAttribute" && typeof attr.value === "string",
						)
						.map((attr) => ({ name: attr.name, value: attr.value })),
				};

				annotations.push(annoataion);
				return;
			}

			const annoataion = {
				...anno,
				type: anno.type,
				name: nodeType,
				range: { start, end },
			};

			annotations.push(annoataion);
			return;
		}
	}

	recursiveBuildAnnotationInfo(node);

	const sortedAnnotations = annotations.sort((a, b) => {
		if (a.type !== b.type) return a.type - b.type;
		if (a.name !== b.name) return a.name.localeCompare(b.name); // TODO 추후 name의 우선순위가 생긴다면 우선순위 순으로 변경
		if (a.range.start !== b.range.start) return a.range.start - b.range.start;
		if (a.range.end !== b.range.end) return a.range.end - b.range.end;
		return 0;
	});

	return { code: pureCode, annotations: sortedAnnotations };
};

const injectAnnotationsIntoCode = (code: string, lang: EditorCodeLang, annotations: ExtractedAnnotation[]) => {
	// TODO : 추후 외부에서 받도록 수정
	const langOption = EDITOR_LANG_OPTIONS.find((option) => option.value === lang);
	const annotationPrefix = langOption?.commentPrefix ?? "//";
	const annotationPostfix = langOption && "commentPostfix" in langOption ? langOption.commentPostfix : "";

	const lines = code.split("\n").reduce<[string, LineMeta[]]>(
		(acc, line) => {
			const lineStart = acc[0].length;

			const lineWithNewLine = `${line}\n`;
			acc[0] += lineWithNewLine;

			const lineEnd = acc[0].length;
			const range = { start: lineStart, end: lineEnd };
			const lineItem = { value: line, range, annotations: [] };
			acc[1].push(lineItem);

			return acc;
		},
		["", []],
	)[1];

	for (const ann of annotations) {
		for (const line of lines) {
			const lineTextEnd = line.range.end - 1; // '\n' 제외
			const { start, end } = ann.range;

			const segStart = Math.max(start, line.range.start);
			const segEnd = Math.min(end, lineTextEnd);

			if (segStart < segEnd) {
				line.annotations.push({ ...ann, range: { start: segStart, end: segEnd } });
			}

			if (end <= lineTextEnd) break;
			if (start >= line.range.end) continue;
		}
	}

	const codeWithAnnotations = lines
		.map((line) => {
			if (line.annotations.length === 0) return line.value;

			const annotationText = line.annotations
				.map((annotation) => {
					const type = `${ANNOTATION_TAG_PREFIX}${ANNOTATION_TAG_BY_TYPE[annotation.type]}`;
					const name = annotation.name;
					const { start, end } = annotation.range;

					if (!name) {
						return "";
					}

					const characterRange = `{${start - line.range.start}-${end - line.range.start}}`;
					const attributes =
						annotation.attributes
							?.map((attr) => ("name" in attr ? `${attr.name}=${JSON.stringify(attr.value)}` : ""))
							.filter(Boolean)
							.join(" ") ?? "";

					return [annotationPrefix, type, name, characterRange, attributes, annotationPostfix]
						.filter((info) => !!info)
						.join(" ");
				})
				.join("\n");

			return [annotationText, line.value].join("\n");
		})
		.join("\n");

	return codeWithAnnotations;
};

export function walkOnlyInsideCodeblock(mdxAst: Root, annotationConfig: AnnotationConfig) {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (node.name !== EDITOR_CODE_BLOCK_NAME) return;

		const metaAttr = node.attributes.find(
			(attr) => attr.type === "mdxJsxAttribute" && "name" in attr && attr.name === "meta",
		);

		// TODO 추후 parseAttr 로 리팩토링
		let meta: any;

		if (metaAttr && metaAttr.value) {
			if (typeof metaAttr.value === "string") {
				meta = metaAttr.value;
			} else if ("value" in metaAttr.value && typeof metaAttr.value.value === "string") {
				meta = metaAttr.value.value;
			}
		}

		if (typeof meta === "string") {
			try {
				const stringifedMeta = Array.from(Object.entries(JSON.parse(meta)))
					.filter(([_, value]) => !!value)
					.map(([key, value]) => (value === true ? key : `${key}=${JSON.stringify(value)}`))
					.join(" ");

				meta = stringifedMeta;
			} catch (e) {
				console.warn("meta JSON 파싱 오류:", e);
			}
		}

		const langAttr = node.attributes.find(
			(attr) => attr.type === "mdxJsxAttribute" && "name" in attr && attr.name === "lang",
		);
		const lang = ((langAttr?.value as string) ?? "text").trim() as EditorCodeLang;

		const result = extractAnnotationsFromAst(node, annotationConfig);
		if (!result) return;

		const { code, annotations } = result;

		const codeWithAnotations = injectAnnotationsIntoCode(code, lang, annotations);

		const codeNode: Code = {
			type: "code",
			lang,
			value: codeWithAnotations,
			meta,
		};

		if (parent && index !== undefined) parent.children.splice(index, 1, codeNode);

		return [SKIP, index];
	});
}

export function walkOnlyMermaid(mdxAst: Root) {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (node.name !== EDITOR_MERMAID_NAME) {
			return;
		}

		const result = extractAnnotationsFromAst(node, {});

		if (!result) return;

		const { code } = result;

		const codeNode: Code = {
			type: "code",
			lang: "mermaid",
			value: code,
		};

		if (parent && index !== undefined) parent.children.splice(index, 1, codeNode);

		return [SKIP, index];
	});
}

export const annotationConfig: AnnotationConfig = {
	decoration: [],
	mark: [
		{
			name: "Tooltip",
			source: "mdx-text",
			render: "Tooltip",
		},
		{
			name: "strong",
			source: "mdast",
			render: "strong",
		},
		{
			name: "emphasis",
			source: "mdast",
			render: "em",
		},
		{
			name: "delete",
			source: "mdast",
			render: "del",
		},
		{
			name: "u",
			source: "mdx-text",
			render: "u",
		},
	],
	line: [],
	block: [],
};
