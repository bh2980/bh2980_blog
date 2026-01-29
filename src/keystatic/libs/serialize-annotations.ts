import type { Break, Code, Node, Root, Text } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { EDITOR_CODE_BLOCK_NAME, EDITOR_LANG_OPTIONS, type EditorCodeLang } from "../fields/mdx/components/code-block";

export type AnnotationSource = "mdast" | "mdx-text" | "mdx-flow";

export type AnnotationTag = "dec" | "line" | "mark" | "block";

export enum AnnotationType {
	BLOCK = 1,
	LINE = 2,
	MARK = 3,
	DECORATION = 4,
}

export const ANNOTATION_TAG_BY_TYPE: Record<AnnotationType, AnnotationTag> = {
	[AnnotationType.DECORATION]: "dec",
	[AnnotationType.LINE]: "line",
	[AnnotationType.MARK]: "mark",
	[AnnotationType.BLOCK]: "block",
};

export type AnnotationSpec = {
	name: string;
	source: AnnotationSource;
};

export interface AnnotationConfig {
	decoration?: AnnotationSpec[];
	line?: AnnotationSpec[];
	mark?: AnnotationSpec[];
	block?: AnnotationSpec[];
}

type AnnotationRegistryItem = {
	type: AnnotationType;
	name: string;
	source: AnnotationSource;
};

interface ExtractedAnnotation {
	type: AnnotationType;
	nodeType: string;
	name: string;
	start: number;
	end: number;
	attributes?: MdxJsxTextElement["attributes"];
}

interface LineMeta {
	value: string;
	annotations: ExtractedAnnotation[];
	start: number;
	end: number;
}

const isText = (node: Node): node is Text => node.type === "text";
const isBreak = (node: Node): node is Break => node.type === "break";
const isMDXJSXTextElement = (node: Node): node is MdxJsxTextElement => node.type === "mdxJsxTextElement";

export const hasChildren = (node: Node | Root): node is Node & { children: Node[] } => "children" in node;

let annotationHelperSingleton: {
	annotationMap: Map<string, AnnotationRegistryItem>;
	isAnnotation: (node: Node) => boolean;
};

const buildAnnotationHelper = (annotationConfig?: AnnotationConfig) => {
	if (annotationHelperSingleton) {
		return annotationHelperSingleton;
	}

	if (!annotationConfig) {
		throw new Error("[buildAnnotationHelper] ERROR : annotationConfig is required");
	}

	const annotationMap = new Map<string, AnnotationRegistryItem>();

	if (annotationConfig.decoration) {
		for (const d of annotationConfig.decoration) {
			annotationMap.set(d.name, { ...d, type: AnnotationType.DECORATION });
		}
	}
	if (annotationConfig.mark) {
		for (const d of annotationConfig.mark) {
			annotationMap.set(d.name, { ...d, type: AnnotationType.MARK });
		}
	}
	if (annotationConfig.line) {
		for (const d of annotationConfig.line) {
			annotationMap.set(d.name, { ...d, type: AnnotationType.LINE });
		}
	}
	if (annotationConfig.block) {
		for (const d of annotationConfig.block) {
			annotationMap.set(d.name, { ...d, type: AnnotationType.BLOCK });
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
				return;
			}

			const annoataion = {
				type,
				nodeType,
				name: nodeType,
				start,
				end,
			};

			annotations.push(annoataion);
			return;
		}
	}

	recursiveBuildAnnotationInfo(node);

	const sortedAnnotations = annotations.sort((a, b) => {
		if (a.type !== b.type) return a.type - b.type;
		if (a.name !== b.name) return a.name.localeCompare(b.name); // TODO 추후 우선순위가 생긴다면 우선순위 순으로 변경
		if (a.start !== b.start) return a.start - b.start;
		if (a.end !== b.end) return b.end - a.end;
		return 0;
	});

	return { code: pureCode, annotations: sortedAnnotations };
};

const injectAnnotationsIntoCode = (code: string, lang: EditorCodeLang, annotations: ExtractedAnnotation[]) => {
	// TODO : 추후 외부에서 받도록 수정
	const TAG_PREFIX = "@";
	const langOption = EDITOR_LANG_OPTIONS.find((option) => option.value === lang);
	const annotationPrefix = langOption?.commentPrefix ?? "//";
	const annotationPostfix = langOption && "commentPostfix" in langOption ? langOption.commentPostfix : "";

	const lines = code.split("\n").reduce<[string, LineMeta[]]>(
		(acc, line) => {
			const lineStart = acc[0].length;

			const lineWithNewLine = `${line}\n`;
			acc[0] += lineWithNewLine;

			const lineEnd = acc[0].length;
			const lineItem = { value: line, start: lineStart, end: lineEnd, annotations: [] };
			acc[1].push(lineItem);

			return acc;
		},
		["", []],
	)[1];

	for (const ann of annotations) {
		for (const line of lines) {
			const lineTextEnd = line.end - 1; // '\n' 제외
			const segStart = Math.max(ann.start, line.start);
			const segEnd = Math.min(ann.end, lineTextEnd);

			if (segStart < segEnd) {
				line.annotations.push({ ...ann, start: segStart, end: segEnd });
			}

			if (ann.end <= lineTextEnd) break;
			if (ann.start >= line.end) continue;
		}
	}

	const codeWithAnnotations = lines
		.map((line) => {
			if (line.annotations.length === 0) return line.value;

			const annotationText = line.annotations
				.map((annotation) => {
					const type = `${TAG_PREFIX}${ANNOTATION_TAG_BY_TYPE[annotation.type]}`;
					const name = annotation.name;

					if (!name) {
						return "";
					}

					const characterRange = `{${annotation.start - line.start}-${annotation.end - line.start}}`;
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

		return SKIP;
	});
}

export const annotationConfig: AnnotationConfig = {
	decoration: [
		{
			name: "strong",
			source: "mdast",
		},
		{
			name: "emphasis",
			source: "mdast",
		},
		{
			name: "delete",
			source: "mdast",
		},
		{
			name: "u",
			source: "mdx-text",
		},
	],
	mark: [
		{
			name: "Tooltip",
			source: "mdx-text",
		},
	],
	line: [],
	block: [],
};
