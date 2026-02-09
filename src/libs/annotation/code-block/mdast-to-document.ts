import type { Node, Paragraph, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { createAnnotationRegistry } from "./libs";
import type {
	AnnotationAttr,
	AnnotationConfig,
	AnnotationRegistry,
	CodeBlockDocument,
	CodeBlockMetaValue,
	InlineAnnotation,
	Line,
	LineAnnotation,
} from "./types";

const DEFAULT_CODE_LANG = "text";

const hasChildren = (node: Node): node is Node & { children: Node[] } => "children" in node;
const isText = (node: Node): node is Text => node.type === "text";
const isMDXJSXTextElement = (node: Node): node is MdxJsxTextElement => node.type === "mdxJsxTextElement";

const toDocAttrValue = (value: MdxJsxAttribute["value"]): unknown => {
	if (value === null) return true;
	if (value == null || typeof value === "string") return value;
	if (typeof value !== "object") return value;
	if (value.type !== "mdxJsxAttributeValueExpression" || typeof value.value !== "string") return value;

	try {
		return JSON.parse(value.value);
	} catch {
		return value.value;
	}
};

const fromParagraphToLine = (p: Paragraph, registry: AnnotationRegistry): Line => {
	let pureCode = "";
	const annotations: InlineAnnotation[] = [];

	function recursiveBuildAnnotationInfo(node: Node) {
		if (isText(node)) {
			pureCode += node.value;
			return;
		}

		if (hasChildren(node)) {
			const start = pureCode.length;

			for (const child of node.children) {
				recursiveBuildAnnotationInfo(child);
			}

			const end = pureCode.length;
			const nodeType = node.type;

			const annotationKey = (isMDXJSXTextElement(node) ? node.name : nodeType) ?? "";
			const anno = registry.get(annotationKey);
			if (!anno || anno.type === "lineClass" || anno.type === "lineWrap") {
				return;
			}

			if (isMDXJSXTextElement(node)) {
				if (!node.name) {
					return;
				}

				const annoataion = {
					...anno,
					name: node.name,
					range: { start, end },
					order: annotations.length,
					attributes: node.attributes
						.filter((attr): attr is MdxJsxAttribute & { name: string } => attr.type === "mdxJsxAttribute")
						.map<AnnotationAttr>((attr) => ({
							name: attr.name,
							value: toDocAttrValue(attr.value),
						})),
				};

				annotations.push(annoataion);
				return;
			}

			const annoataion = {
				...anno,
				name: nodeType,
				range: { start, end },
				order: annotations.length,
			};

			annotations.push(annoataion);
			return;
		}
	}

	recursiveBuildAnnotationInfo(p);

	return { value: pureCode, annotations };
};

const fromMdxFlowElementToCodeHeader = (mdxAst: MdxJsxFlowElement): Pick<CodeBlockDocument, "lang" | "meta"> => {
	const langAttr = mdxAst.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === "lang");
	const lang =
		langAttr?.type === "mdxJsxAttribute" && typeof langAttr.value === "string" ? langAttr.value : DEFAULT_CODE_LANG;
	const metaAttr = mdxAst.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === "meta");
	let meta: Record<string, CodeBlockMetaValue> = {};

	if (metaAttr?.type === "mdxJsxAttribute") {
		const rawMeta =
			typeof metaAttr.value === "string"
				? metaAttr.value
				: metaAttr.value && typeof metaAttr.value === "object" && "value" in metaAttr.value
					? metaAttr.value.value
					: undefined;

		if (typeof rawMeta === "string") {
			try {
				const parsed = JSON.parse(rawMeta);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					meta = parsed as Record<string, CodeBlockMetaValue>;
				}
			} catch {
				meta = {};
			}
		}
	}

	return { lang, meta };
};

const fromMdxFlowElementToCodeBody = (
	mdxAst: MdxJsxFlowElement,
	registry: AnnotationRegistry,
): Pick<CodeBlockDocument, "lines" | "annotations"> => {
	const lines: Line[] = [];
	const annotations: LineAnnotation[] = [];

	const visitFlowChildren = (nodes: MdxJsxFlowElement["children"]) => {
		nodes.forEach((childNode) => {
			if (childNode.type === "paragraph") {
				const line = fromParagraphToLine(childNode, registry);
				lines.push(line);
				return;
			}

			if (childNode.type !== "mdxJsxFlowElement") {
				return;
			}

			if (!childNode.name || childNode.children.length === 0) {
				return;
			}

			const config = registry.get(childNode.name);
			if (!config || config.type === "inlineClass" || config.type === "inlineWrap") {
				return;
			}

			const start = lines.length;
			const flowAttributes = childNode.attributes
				.filter((attr): attr is MdxJsxAttribute & { name: string } => attr.type === "mdxJsxAttribute")
				.map<AnnotationAttr>((attr) => ({
					name: attr.name,
					value: toDocAttrValue(attr.value),
				}));
			const annotation = {
				...config,
				range: {
					start,
					end: start,
				},
				order: annotations.length,
				attributes: flowAttributes.length > 0 ? flowAttributes : undefined,
			};

			annotations.push(annotation);
			visitFlowChildren(childNode.children as MdxJsxFlowElement["children"]);
			annotation.range.end = lines.length;
		});
	};

	visitFlowChildren(mdxAst.children);

	return { lines, annotations };
};

export const fromMdxFlowElementToCodeDocument = (
	mdxAst: MdxJsxFlowElement,
	annotationConfig: AnnotationConfig,
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const { lang, meta } = fromMdxFlowElementToCodeHeader(mdxAst);
	const { lines, annotations } = fromMdxFlowElementToCodeBody(mdxAst, registry);

	return { lang, meta, lines, annotations };
};

export const __testable__ = {
	fromParagraphToLine,
	fromMdxFlowElementToCodeHeader,
	fromMdxFlowElementToCodeBody,
	toDocAttrValue,
	fromMdxFlowElementToCodeDocument,
};
